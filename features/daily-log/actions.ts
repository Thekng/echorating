'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getActorContext } from '@/lib/supabase/actor-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { getAccessibleDepartmentIds } from '@/lib/rbac/department-access'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { dailyLogFormSchema } from './schemas'
import {
  type DailyLogActionState,
  type DailyLogMetricDataType,
} from './types'
import { parseBooleanInput, parseDurationToSeconds } from '@/lib/daily-log/value-parser'
import { booleanLabels, normalizeMetricSettings, type DurationFormat } from '@/lib/metrics/data-types'
import { enqueueCalculatedRecomputeJob } from './calculated-recompute'
import { triggerCalculatedRecomputeWorker } from '@/lib/jobs/calculated-recompute-trigger'
import { logAuditEvent } from '@/lib/audit/log'

const INITIAL_ERROR_STATE: DailyLogActionState = {
  status: 'error',
  message: 'Invalid request.',
  intent: null,
  entryStatus: null,
  savedAt: null,
  entryId: null,
}

const deleteDailyLogSchema = z.object({
  entryId: z.string().uuid('Invalid log entry.'),
})

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function optionalUuidField(formData: FormData, key: string) {
  const value = field(formData, key).trim()
  return value || undefined
}

function numericField(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: true as const, value: null as number | null }
  }

  const value = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(value)) {
    return { ok: false as const, message: 'Invalid numeric value.' }
  }

  return { ok: true as const, value }
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
}


async function isUserInDepartment(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  departmentId: string,
  userId: string,
) {
  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership) {
    return { ok: false as const, message: 'Agent not found in organization.' }
  }

  const { data: departmentMembership, error: departmentMembershipError } = await admin
    .from('department_members')
    .select('department_id')
    .eq('department_id', departmentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (departmentMembershipError) {
    return { ok: false as const, message: formatDatabaseError(departmentMembershipError.message) }
  }

  if (!departmentMembership) {
    return { ok: false as const, message: 'Agent is not active in this department.' }
  }

  return { ok: true as const }
}

async function getViewerDepartmentRole(
  admin: ReturnType<typeof createAdminClient>,
  departmentId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from('department_members')
    .select('role')
    .eq('department_id', departmentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return {
      ok: false as const,
      message: formatDatabaseError(error.message),
      memberRole: null as 'lead' | 'member' | null,
    }
  }

  return {
    ok: true as const,
    message: '',
    memberRole:
      data?.role === 'lead' || data?.role === 'member'
        ? data.role
        : null,
  }
}

async function resolveDailyLogTarget(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  departmentId: string,
  viewerUserId: string,
  viewerRole: Role,
  requestedUserId?: string,
) {
  const targetUserId = requestedUserId ?? viewerUserId

  // Self-log: any active company member can log their own entry in any department
  // of their company. Company membership was already validated by getActorContext.
  if (targetUserId === viewerUserId) {
    return { ok: true as const, message: '', targetUserId }
  }

  if (viewerRole === 'owner' || viewerRole === 'admin' || viewerRole === 'manager') {
    const targetValidation = await isUserInDepartment(admin, organizationId, departmentId, targetUserId)
    if (!targetValidation.ok) {
      return {
        ok: false as const,
        message: targetValidation.message,
        targetUserId: null as string | null,
      }
    }

    return { ok: true as const, message: '', targetUserId }
  }

  const viewerDepartmentRole = await getViewerDepartmentRole(admin, departmentId, viewerUserId)
  if (!viewerDepartmentRole.ok) {
    return {
      ok: false as const,
      message: viewerDepartmentRole.message,
      targetUserId: null as string | null,
    }
  }

  if (viewerDepartmentRole.memberRole !== 'lead') {
    return {
      ok: false as const,
      message: 'You can only write your own daily log.',
      targetUserId: null as string | null,
    }
  }

  const targetValidation = await isUserInDepartment(admin, organizationId, departmentId, targetUserId)
  if (!targetValidation.ok) {
    return {
      ok: false as const,
      message: targetValidation.message,
      targetUserId: null as string | null,
    }
  }

  return { ok: true as const, message: '', targetUserId }
}

async function getManualMetricsForDepartment(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  departmentId: string,
) {
  const { data, error } = await admin
    .from('metrics')
    .select('id, data_type, settings')
    .eq('organization_id', organizationId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')

  if (error) {
    return {
      ok: false as const,
      message: formatDatabaseError(error.message),
      metrics: [] as Array<{ id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
    }
  }

  return {
    ok: true as const,
    metrics: (data ?? []) as Array<{ id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
  }
}

function durationToSeconds(rawValue: string, format: DurationFormat) {
  if (format === 'hh_mm_ss') {
    return parseDurationToSeconds(rawValue)
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return { ok: true as const, value: null as number | null }
  }

  const numberValue = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(numberValue) || numberValue < 0) {
    return { ok: false as const, message: 'Invalid duration value.' }
  }

  const multiplier = format === 'minutes' ? 60 : format === 'hours' ? 3600 : 86400
  return { ok: true as const, value: numberValue * multiplier }
}

function parseMetricValue(
  metricType: DailyLogMetricDataType,
  metricSettings: unknown,
  rawValue: string,
):
  | { ok: true; hasValue: false }
  | { ok: true; hasValue: true; value_number: number | null; value_text: string | null; value_boolean: boolean | null }
  | { ok: false; message: string } {
  const settings = normalizeMetricSettings(metricType, metricSettings)

  if (metricType === 'boolean') {
    const normalized = rawValue.trim()
    if (!normalized) {
      return { ok: true, hasValue: false }
    }

    const labels = booleanLabels(settings)
    const parsedBool = parseBooleanInput(normalized, labels)
    if (parsedBool === null) {
      return { ok: false, message: 'Invalid boolean value.' }
    }

    return {
      ok: true,
      hasValue: true,
      value_number: null,
      value_text: null,
      value_boolean: parsedBool,
    }
  }

  if (metricType === 'duration') {
    const durationResult = durationToSeconds(rawValue, settings.durationFormat ?? 'hh_mm_ss')
    if (!durationResult.ok) {
      return { ok: false, message: durationResult.message }
    }

    if (durationResult.value === null) {
      return { ok: true, hasValue: false }
    }

    return {
      ok: true,
      hasValue: true,
      value_number: durationResult.value,
      value_text: null,
      value_boolean: null,
    }
  }

  if (metricType === 'text' || metricType === 'datetime' || metricType === 'selection' || metricType === 'file') {
    const value = rawValue.trim()
    if (!value) {
      return { ok: true, hasValue: false }
    }

    if (metricType === 'text') {
      if (settings.textFormat === 'email') {
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        if (!validEmail) {
          return { ok: false, message: 'Invalid email format.' }
        }
      }

      if (settings.textFormat === 'url') {
        try {
          new URL(value)
        } catch {
          return { ok: false, message: 'Invalid URL format.' }
        }
      }
    }

    if (metricType === 'datetime') {
      if (settings.datetimeFormat === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { ok: false, message: 'Invalid date format.' }
      }
      if (settings.datetimeFormat === 'time' && !/^\d{2}:\d{2}$/.test(value)) {
        return { ok: false, message: 'Invalid time format.' }
      }
      if (settings.datetimeFormat === 'datetime' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
        return { ok: false, message: 'Invalid date/time format.' }
      }
    }

    if (metricType === 'selection') {
      const options = settings.selectionOptions ?? []
      if (options.length === 0) {
        return { ok: false, message: 'Selection metric has no options.' }
      }

      if (settings.selectionMode === 'multi') {
        let selected: string[] = []
        try {
          selected = JSON.parse(value) as string[]
        } catch {
          selected = value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        }

        if (selected.length === 0) {
          return { ok: true, hasValue: false }
        }

        if (selected.some((item) => !options.includes(item))) {
          return { ok: false, message: 'Invalid selection option.' }
        }

        return {
          ok: true,
          hasValue: true,
          value_number: null,
          value_text: JSON.stringify(selected),
          value_boolean: null,
        }
      }

      if (!options.includes(value)) {
        return { ok: false, message: 'Invalid selection option.' }
      }
    }

    if (metricType === 'file') {
      try {
        new URL(value)
      } catch {
        return { ok: false, message: 'Invalid file URL.' }
      }
    }

    return {
      ok: true,
      hasValue: true,
      value_number: null,
      value_text: value,
      value_boolean: null,
    }
  }

  const parsedNumber = numericField(rawValue)
  if (!parsedNumber.ok) {
    return { ok: false, message: parsedNumber.message }
  }

  if (parsedNumber.value === null) {
    return { ok: true, hasValue: false }
  }

  if (metricType === 'number' && settings.numberKind === 'integer' && !Number.isInteger(parsedNumber.value)) {
    return { ok: false, message: 'Only whole numbers are allowed.' }
  }

  return {
    ok: true,
    hasValue: true,
    value_number: parsedNumber.value,
    value_text: null,
    value_boolean: null,
  }
}


export async function saveDailyLogAction(
  _prevState: DailyLogActionState,
  formData: FormData,
): Promise<DailyLogActionState> {
  const t0 = Date.now()
  let telemetryOrganizationId: string | null = null
  let telemetryDepartmentId: string | null = null
  let telemetryEntryId: string | null = null
  let telemetryManualCount = 0
  let telemetryHadEnqueue = false
  let telemetryOutcome: 'success' | 'error' = 'error'

  try {
  const parsed = dailyLogFormSchema.safeParse({
    date: field(formData, 'date'),
    entryId: optionalUuidField(formData, 'entryId'),
    departmentId: field(formData, 'departmentId'),
    userId: optionalUuidField(formData, 'userId'),
    notes: field(formData, 'notes'),
    intent: field(formData, 'intent') || 'draft',
  })

  if (!parsed.success) {
    return {
      ...INITIAL_ERROR_STATE,
      message: zodMessage(parsed.error),
    }
  }

  telemetryDepartmentId = parsed.data.departmentId

  const context = await getActorContext()
  if (!context.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: context.message,
      intent: parsed.data.intent,
    }
  }

  telemetryOrganizationId = context.organizationId

  try {
    requireRole(context.role, 'member')
  } catch {
    return {
      ...INITIAL_ERROR_STATE,
      message: 'Insufficient permissions.',
      intent: parsed.data.intent,
    }
  }

  const accessibleDepartments = await getAccessibleDepartmentIds(
    context.admin,
    context.organizationId,
    context.userId,
    context.role,
  )

  if (!accessibleDepartments.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: accessibleDepartments.message,
      intent: parsed.data.intent,
    }
  }

  if (!accessibleDepartments.departmentIds.includes(parsed.data.departmentId)) {
    return {
      ...INITIAL_ERROR_STATE,
      message: 'You do not have access to this department.',
      intent: parsed.data.intent,
    }
  }

  const targetResolution = await resolveDailyLogTarget(
    context.admin,
    context.organizationId,
    parsed.data.departmentId,
    context.userId,
    context.role,
    parsed.data.userId,
  )

  if (!targetResolution.ok || !targetResolution.targetUserId) {
    return {
      ...INITIAL_ERROR_STATE,
      message: targetResolution.message,
      intent: parsed.data.intent,
    }
  }

  const targetUserId = targetResolution.targetUserId

  const metricsResult = await getManualMetricsForDepartment(
    context.admin,
    context.organizationId,
    parsed.data.departmentId,
  )

  if (!metricsResult.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: metricsResult.message,
      intent: parsed.data.intent,
    }
  }

  const valueRows: Array<{
    metric_id: string
    value_number: number | null
    value_text: string | null
    value_boolean: boolean | null
  }> = []

  for (const metric of metricsResult.metrics) {
    const raw = field(formData, `metric_${metric.id}`)
    const parsedValue = parseMetricValue(metric.data_type, metric.settings, raw)

    if (!parsedValue.ok) {
      return {
        ...INITIAL_ERROR_STATE,
        message: `${metric.data_type === 'duration' ? 'Duration' : 'Metric'}: ${parsedValue.message}`,
        intent: parsed.data.intent,
      }
    }

    if (!parsedValue.hasValue) {
      continue
    }

    valueRows.push({
      metric_id: metric.id,
      value_number: parsedValue.value_number,
      value_text: parsedValue.value_text,
      value_boolean: parsedValue.value_boolean,
    })
  }

  telemetryManualCount = valueRows.length

  const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null
  const now = new Date().toISOString()
  const submitting = parsed.data.intent === 'submit'

  const { data: existingEntryForDate, error: existingEntryError } = await context.admin
    .from('daily_reports')
    .select('id, status, submitted_at')
    .eq('organization_id', context.organizationId)
    .eq('department_id', parsed.data.departmentId)
    .eq('user_id', targetUserId)
    .eq('report_date', parsed.data.date)
    .maybeSingle()

  if (existingEntryError) {
    return {
      ...INITIAL_ERROR_STATE,
      message: formatDatabaseError(existingEntryError.message),
      intent: parsed.data.intent,
    }
  }

  let sourceEntry = existingEntryForDate

  if (parsed.data.entryId) {
    const { data: existingEntryById, error: existingEntryByIdError } = await context.admin
      .from('daily_reports')
      .select('id, status, submitted_at, organization_id, department_id, user_id')
      .eq('id', parsed.data.entryId)
      .maybeSingle()

    if (existingEntryByIdError) {
      return {
        ...INITIAL_ERROR_STATE,
        message: formatDatabaseError(existingEntryByIdError.message),
        intent: parsed.data.intent,
      }
    }

    if (
      !existingEntryById ||
      existingEntryById.organization_id !== context.organizationId ||
      existingEntryById.department_id !== parsed.data.departmentId ||
      existingEntryById.user_id !== targetUserId
    ) {
      return {
        ...INITIAL_ERROR_STATE,
        message: 'The log you are trying to edit no longer exists.',
        intent: parsed.data.intent,
      }
    }

    if (existingEntryForDate && existingEntryForDate.id !== existingEntryById.id) {
      return {
        ...INITIAL_ERROR_STATE,
        message: 'A log already exists for that date.',
        intent: parsed.data.intent,
        entryId: existingEntryById.id,
      }
    }

    sourceEntry = {
      id: existingEntryById.id as string,
      status: existingEntryById.status as 'draft' | 'submitted',
      submitted_at: existingEntryById.submitted_at as string | null,
    }
  }

  const nextEntryStatus = submitting || sourceEntry?.status === 'submitted' ? 'submitted' : 'draft'
  const nextSubmittedAt =
    submitting ? now : nextEntryStatus === 'submitted' ? (sourceEntry?.submitted_at ?? now) : null

  const { data: entryId, error: rpcError } = await context.admin.rpc(
    'save_daily_log_entry',
    {
      p_report_id: sourceEntry?.id ?? null,
      p_organization_id: context.organizationId,
      p_department_id: parsed.data.departmentId,
      p_user_id: targetUserId,
      p_report_date: parsed.data.date,
      p_status: nextEntryStatus,
      p_submitted_at: nextSubmittedAt,
      p_notes: notes,
      p_values: valueRows.length > 0 ? valueRows : null,
    },
  )

  if (rpcError || !entryId) {
    return {
      ...INITIAL_ERROR_STATE,
      message: formatDatabaseError(rpcError?.message ?? 'Failed to save entry.'),
      intent: parsed.data.intent,
    }
  }

  const savedEntryId = typeof entryId === 'string' ? entryId : String(entryId)
  telemetryEntryId = savedEntryId

  const enqueueResult = await enqueueCalculatedRecomputeJob(
    context.admin,
    context.organizationId,
    parsed.data.departmentId,
    savedEntryId,
  )

  telemetryHadEnqueue = enqueueResult.ok

  if (!enqueueResult.ok) {
    console.warn('[ENQUEUE_RECOMPUTE_FAILED]', enqueueResult.message)
  } else {
    after(() => triggerCalculatedRecomputeWorker())
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: submitting ? 'daily_report.submitted' : 'daily_report.saved',
    entityType: 'daily_report',
    entityId: savedEntryId,
    metadata: { date: parsed.data.date, departmentId: parsed.data.departmentId },
  })

  revalidatePath(ROUTES.DAILY_LOG)

  telemetryOutcome = 'success'

  return {
    status: 'success',
    message: submitting ? 'Log submitted successfully.' : 'Draft saved.',
    intent: parsed.data.intent,
    entryStatus: nextEntryStatus,
    savedAt: now,
    entryId: savedEntryId,
  }
  } finally {
    const organizationId = telemetryOrganizationId
    const departmentId = telemetryDepartmentId
    const entryId = telemetryEntryId
    const manualCount = telemetryManualCount
    const hadEnqueue = telemetryHadEnqueue
    const outcome = telemetryOutcome
    const durationMs = Date.now() - t0

    if (organizationId && departmentId) {
      after(async () => {
        try {
          const admin = createAdminClient()
          const { count: calculatedCount } = await admin
            .from('metrics')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('department_id', departmentId)
            .eq('is_active', true)
            .eq('input_mode', 'calculated')

          await admin.from('daily_log_save_metrics').insert({
            company_id: organizationId,
            department_id: departmentId,
            entry_id: entryId,
            duration_ms: durationMs,
            manual_metric_count: manualCount,
            calculated_metric_count: calculatedCount ?? 0,
            had_calculated_enqueue: hadEnqueue,
            commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
            outcome,
          })
        } catch {
          // Telemetry must never surface to the user.
        }
      })
    }
  }
}

export async function deleteDailyLogAction(formData: FormData): Promise<void> {
  const parsed = deleteDailyLogSchema.safeParse({
    entryId: field(formData, 'entryId'),
  })

  if (!parsed.success) {
    return
  }

  const context = await getActorContext()
  if (!context.ok) {
    return
  }

  const { data: entry, error: entryError } = await context.admin
    .from('daily_reports')
    .select('id, organization_id, department_id, user_id')
    .eq('id', parsed.data.entryId)
    .maybeSingle()

  if (entryError || !entry || entry.organization_id !== context.organizationId) {
    return
  }

  const targetResolution = await resolveDailyLogTarget(
    context.admin,
    context.organizationId,
    entry.department_id as string,
    context.userId,
    context.role,
    entry.user_id as string,
  )

  if (!targetResolution.ok || targetResolution.targetUserId !== entry.user_id) {
    return
  }

  const { error: deleteError } = await context.admin
    .from('daily_reports')
    .delete()
    .eq('id', parsed.data.entryId)
    .eq('organization_id', context.organizationId)

  if (deleteError) {
    return
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'daily_report.deleted',
    entityType: 'daily_report',
    entityId: parsed.data.entryId,
  })

  revalidatePath(ROUTES.DAILY_LOG)
}

