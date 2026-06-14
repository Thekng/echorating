import { after } from 'next/server'
import { z } from 'zod'
import { getActorContext, type ActorContextSuccess } from '@/lib/supabase/actor-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { log, getRequestId } from '@/lib/observability/logger'

export type ActionErrorKind =
  | 'validation'
  | 'auth'
  | 'permission'
  | 'database'
  | 'unknown'

export type ActionError = {
  ok: false
  kind: ActionErrorKind
  message: string
  fieldErrors?: Record<string, string>
}

export type ActionSuccess<T> = {
  ok: true
  data: T
}

export type ActionResult<T> = ActionSuccess<T> | ActionError

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export type WrapHandlerArgs<TInput> = {
  input: TInput
  context: ActorContextSuccess
  formData: FormData
}

export type WrapHandler<TInput, TData> = (
  args: WrapHandlerArgs<TInput>,
) => Promise<ActionResult<TData>>

export type WrapActionOptions<TInput, TData> = {
  name: string
  parse: (formData: FormData) => ParseResult<TInput>
  role?: Role
  handler: WrapHandler<TInput, TData>
}

export function formField(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export function optionalUuidField(formData: FormData, key: string): string | undefined {
  const value = formField(formData, key).trim()
  return value ? value : undefined
}

export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.'
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !errors[key]) {
      errors[key] = issue.message
    }
  }
  return errors
}

export function parseWithZod<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
): ParseResult<z.infer<T>> {
  const result = schema.safeParse(value)
  if (result.success) {
    return { ok: true, data: result.data }
  }
  return {
    ok: false,
    message: zodMessage(result.error),
    fieldErrors: zodFieldErrors(result.error),
  }
}

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data }
}

export function fail(
  kind: ActionErrorKind,
  message: string,
  fieldErrors?: Record<string, string>,
): ActionError {
  return fieldErrors ? { ok: false, kind, message, fieldErrors } : { ok: false, kind, message }
}

export function databaseFail(message: string, fieldErrors?: Record<string, string>): ActionError {
  return fail('database', formatDatabaseError(message), fieldErrors)
}

async function scheduleActionEvent(event: {
  name: string
  outcome: 'success' | ActionErrorKind
  durationMs: number
  userId?: string | null
  organizationId?: string | null
  errorMessage?: string | null
}) {
  const requestId = await getRequestId()

  after(async () => {
    try {
      const admin = createAdminClient()
      await admin.from('audit_logs').insert({
        action_name: event.name,
        outcome: event.outcome,
        duration_ms: event.durationMs,
        user_id: event.userId ?? null,
        organization_id: event.organizationId ?? null,
        error_message: event.errorMessage ?? null,
        commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      })
    } catch {
      // Telemetry must never surface to the user.
    }
  })

  const logFn =
    event.outcome === 'success'
      ? log.info
      : event.outcome === 'unknown'
        ? log.error
        : log.warn

  logFn(`action.${event.outcome}`, {
    actionName: event.name,
    outcome: event.outcome,
    durationMs: event.durationMs,
    requestId,
    userId: event.userId ?? null,
    organizationId: event.organizationId ?? null,
    errorMessage: event.errorMessage ?? null,
  })
}



export function wrapAction<TInput, TData>(
  options: WrapActionOptions<TInput, TData>,
): (formData: FormData) => Promise<ActionResult<TData>> {
  const { name, parse, role = 'member', handler } = options

  return async function wrappedAction(formData: FormData): Promise<ActionResult<TData>> {
    const t0 = Date.now()

    const parsed = parse(formData)
    if (!parsed.ok) {
      await scheduleActionEvent({
        name,
        outcome: 'validation',
        durationMs: Date.now() - t0,
        errorMessage: parsed.message,
      })
      return {
        ok: false,
        kind: 'validation',
        message: parsed.message,
        ...(parsed.fieldErrors ? { fieldErrors: parsed.fieldErrors } : {}),
      }
    }

    const context = await getActorContext()
    if (!context.ok) {
      await scheduleActionEvent({
        name,
        outcome: 'auth',
        durationMs: Date.now() - t0,
        errorMessage: context.message,
      })
      return { ok: false, kind: 'auth', message: context.message }
    }

    try {
      requireRole(context.role, role)
    } catch {
      await scheduleActionEvent({
        name,
        outcome: 'permission',
        durationMs: Date.now() - t0,
        userId: context.userId,
        organizationId: context.organizationId,
        errorMessage: `required=${role} actual=${context.role}`,
      })
      return { ok: false, kind: 'permission', message: 'Insufficient permissions.' }
    }

    try {
      const result = await handler({ input: parsed.data, context, formData })
      await scheduleActionEvent({
        name,
        outcome: result.ok ? 'success' : result.kind,
        durationMs: Date.now() - t0,
        userId: context.userId,
        organizationId: context.organizationId,
        errorMessage: result.ok ? null : result.message,
      })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      const requestId = await getRequestId()
      await scheduleActionEvent({
        name,
        outcome: 'unknown',
        durationMs: Date.now() - t0,
        userId: context.userId,
        organizationId: context.organizationId,
        errorMessage: message,
      })
      return {
        ok: false,
        kind: 'unknown',
        message: err instanceof Error ? formatDatabaseError(err.message) : 'An unexpected error occurred.',
      }
    }
  }
}
