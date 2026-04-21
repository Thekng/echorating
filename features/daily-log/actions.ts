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
  type DailyLogKeyMetricsActionState,
  type DailyLogMetricDataType,
} from './types'
import { parseBooleanInput, parseDurationToSeconds } from '@/lib/daily-log/value-parser'
import { booleanLabels, normalizeMetricSettings, type DurationFormat } from '@/lib/metrics/data-types'
import { enqueueCalculatedRecomputeJob } from './calculated-recompute'
import { triggerCalculatedRecomputeWorker } from '@/lib/jobs/calculated-recompute-trigger'

const INITIAL_ERROR_STATE: DailyLogActionState = {
  status: 'error',
  message: 'Invalid request.',
  intent: null,
  entryStatus: null,
  savedAt: null,
  entryId: null,
}

const KEY_METRIC_ERROR_STATE: DailyLogKeyMetricsActionState = {
  status: 'error',
  message: 'Invalid request.',
}

const keyMetricsSchema = z.object({
  departmentId: z.string().uuid('Department is required.'),
  slot1: z.string().uuid().optional(),
  slot2: z.string().uuid().optional(),
  slot3: z.string().uuid().optional(),
})

const deleteDailyLogSchema = z.object({
  entryId: z.string().uuid('Invalid log entry.'),
})

function isMissingMetricsSettingsColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('column metrics.settings does not exist')
}

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
  companyId: string,
  departmentId: string,
  userId: string,
) {
  const { data: membership, error: membershipError } = await admin
    .from('company_members')
    .select('user_id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership) {
    return { ok: false as const, message: 'Agent not found in company.' }
  }

  const { data: departmentMembership, error: departmentMembershipError } = await admin
    .from('department_members')
    .select('department_id')
    .eq('department_id', departmentId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
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
    .select('member_role')
    .eq('department_id', departmentId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
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
      data?.member_role === 'lead' || data?.member_role === 'member'
        ? data.member_role
        : null,
  }
}

async function resolveDailyLogTarget(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  viewerUserId: string,
  viewerRole: Role,
  requestedUserId?: string,
) {
  if (viewerRole === 'owner' || viewerRole === 'manager') {
    if (!requestedUserId) {
      return {
        ok: false as const,
        message: 'Select an agent first.',
        targetUserId: null as string | null,
      }
    }

    const targetValidation = await isUserInDepartment(admin, companyId, departmentId, requestedUserId)
    if (!targetValidation.ok) {
      return {
        ok: false as const,
        message: targetValidation.message,
        targetUserId: null as string | null,
      }
    }

    return { ok: true as const, message: '', targetUserId: requestedUserId }
  }

  const viewerDepartmentRole = await getViewerDepartmentRole(admin, departmentId, viewerUserId)
  if (!viewerDepartmentRole.ok) {
    return {
      ok: false as const,
      message: viewerDepartmentRole.message,
      targetUserId: null as string | null,
    }
  }

  const targetUserId = requestedUserId ?? viewerUserId
  if (targetUserId === viewerUserId) {
    return { ok: true as const, message: '', targetUserId }
  }

  if (viewerDepartmentRole.memberRole !== 'lead') {
    return {
      ok: false as const,
      message: 'You can only write your own daily log.',
      targetUserId: null as string | null,
    }
  }

  const targetValidation = await isUserInDepartment(admin, companyId, departmentId, targetUserId)
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
  companyId: string,
  departmentId: string,
) {
  const withSettings = await admin
    .from('metrics')
    .select('metric_id, data_type, settings')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)

  if (!withSettings.error) {
    return {
      ok: true as const,
      metrics: (withSettings.data ?? []) as Array<{ metric_id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
    }
  }

  if (!isMissingMetricsSettingsColumn(withSettings.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(withSettings.error.message),
      metrics: [] as Array<{ metric_id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
    }
  }

  const fallback = await admin
    .from('metrics')
    .select('metric_id, data_type')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)

  if (fallback.error) {
    return {
      ok: false as const,
      message: formatDatabaseError(fallback.error.message),
      metrics: [] as Array<{ metric_id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
    }
  }

  const metrics = ((fallback.data ?? []) as Array<{ metric_id: string; data_type: DailyLogMetricDataType }>).map(
    (metric) => ({
      ...metric,
      settings: null,
    }),
  )

  return {
    ok: true as const,
    metrics,
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
  | { ok: true; hasValue: true; value_numeric: number | null; value_text: string | null; value_bool: boolean | null }
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
      value_numeric: null,
      value_text: null,
      value_bool: parsedBool,
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
      value_numeric: durationResult.value,
      value_text: null,
      value_bool: null,
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
          value_numeric: null,
          value_text: JSON.stringify(selected),
          value_bool: null,
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
      value_numeric: null,
      value_text: value,
      value_bool: null,
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
    value_numeric: parsedNumber.value,
    value_text: null,
    value_bool: null,
  }
}


export async function saveDailyLogAction(
  _prevState: DailyLogActionState,
  formData: FormData,
): Promise<DailyLogActionState> {
  const t0 = Date.now()
  let telemetryCompanyId: string | null = null
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

  telemetryCompanyId = context.companyId

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
    context.companyId,
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
    context.companyId,
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
    context.companyId,
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
    value_numeric: number | null
    value_text: string | null
    value_bool: boolean | null
  }> = []

  for (const metric of metricsResult.metrics) {
    const raw = field(formData, `metric_${metric.metric_id}`)
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
      metric_id: metric.metric_id,
      value_numeric: parsedValue.value_numeric,
      value_text: parsedValue.value_text,
      value_bool: parsedValue.value_bool,
    })
  }

  telemetryManualCount = valueRows.length

  const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null
  const now = new Date().toISOString()
  const submitting = parsed.data.intent === 'submit'

  const { data: existingEntryForDate, error: existingEntryError } = await context.admin
    .from('daily_entries')
    .select('entry_id, status, submitted_at')
    .eq('company_id', context.companyId)
    .eq('department_id', parsed.data.departmentId)
    .eq('user_id', targetUserId)
    .eq('entry_date', parsed.data.date)
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
      .from('daily_entries')
      .select('entry_id, status, submitted_at, company_id, department_id, user_id')
      .eq('entry_id', parsed.data.entryId)
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
      existingEntryById.company_id !== context.companyId ||
      existingEntryById.department_id !== parsed.data.departmentId ||
      existingEntryById.user_id !== targetUserId
    ) {
      return {
        ...INITIAL_ERROR_STATE,
        message: 'The log you are trying to edit no longer exists.',
        intent: parsed.data.intent,
      }
    }

    if (existingEntryForDate && existingEntryForDate.entry_id !== existingEntryById.entry_id) {
      return {
        ...INITIAL_ERROR_STATE,
        message: 'A log already exists for that date.',
        intent: parsed.data.intent,
        entryId: existingEntryById.entry_id,
      }
    }

    sourceEntry = {
      entry_id: existingEntryById.entry_id as string,
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
      p_entry_id: sourceEntry?.entry_id ?? null,
      p_company_id: context.companyId,
      p_department_id: parsed.data.departmentId,
      p_user_id: targetUserId,
      p_entry_date: parsed.data.date,
      p_status: nextEntryStatus,
      p_submitted_at: nextSubmittedAt,
      p_notes: notes,
      p_values: valueRows.length > 0 ? JSON.stringify(valueRows) : null,
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
    context.companyId,
    parsed.data.departmentId,
    savedEntryId,
  )

  if (!enqueueResult.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: enqueueResult.message,
      intent: parsed.data.intent,
      entryId: savedEntryId,
    }
  }

  telemetryHadEnqueue = true

  // Fire the worker after the response is flushed — the cron sweep is the
  // durable path; this is just the fast path for single-save recompute.
  after(() => triggerCalculatedRecomputeWorker())

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
    const companyId = telemetryCompanyId
    const departmentId = telemetryDepartmentId
    const entryId = telemetryEntryId
    const manualCount = telemetryManualCount
    const hadEnqueue = telemetryHadEnqueue
    const outcome = telemetryOutcome
    const durationMs = Date.now() - t0

    if (companyId && departmentId) {
      after(async () => {
        try {
          const admin = createAdminClient()
          const { count: calculatedCount } = await admin
            .from('metrics')
            .select('metric_id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('department_id', departmentId)
            .eq('is_active', true)
            .eq('input_mode', 'calculated')
            .is('deleted_at', null)

          await admin.from('daily_log_save_metrics').insert({
            company_id: companyId,
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
    .from('daily_entries')
    .select('entry_id, company_id, department_id, user_id')
    .eq('entry_id', parsed.data.entryId)
    .maybeSingle()

  if (entryError || !entry || entry.company_id !== context.companyId) {
    return
  }

  const targetResolution = await resolveDailyLogTarget(
    context.admin,
    context.companyId,
    entry.department_id as string,
    context.userId,
    context.role,
    entry.user_id as string,
  )

  if (!targetResolution.ok || targetResolution.targetUserId !== entry.user_id) {
    return
  }

  const { error: deleteError } = await context.admin
    .from('daily_entries')
    .delete()
    .eq('entry_id', parsed.data.entryId)
    .eq('company_id', context.companyId)

  if (deleteError) {
    return
  }

  revalidatePath(ROUTES.DAILY_LOG)
}

export async function updateDepartmentLogKeyMetricsAction(
  _prevState: DailyLogKeyMetricsActionState,
  formData: FormData,
): Promise<DailyLogKeyMetricsActionState> {
  const parsed = keyMetricsSchema.safeParse({
    departmentId: field(formData, 'departmentId'),
    slot1: optionalUuidField(formData, 'slot1'),
    slot2: optionalUuidField(formData, 'slot2'),
    slot3: optionalUuidField(formData, 'slot3'),
  })

  if (!parsed.success) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: zodMessage(parsed.error),
    }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: context.message,
    }
  }

  if (context.role !== 'owner' && context.role !== 'manager') {
    const viewerDepartmentRole = await getViewerDepartmentRole(
      context.admin,
      parsed.data.departmentId,
      context.userId,
    )

    if (!viewerDepartmentRole.ok) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: viewerDepartmentRole.message,
      }
    }

    if (viewerDepartmentRole.memberRole !== 'lead') {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: 'Insufficient permissions.',
      }
    }
  }

  const slotValues = [parsed.data.slot1, parsed.data.slot2, parsed.data.slot3].filter(Boolean) as string[]
  const uniqueMetricIds = new Set(slotValues)

  if (uniqueMetricIds.size !== slotValues.length) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: 'Choose different metrics for each slot.',
    }
  }

  const { data: department, error: departmentError } = await context.admin
    .from('departments')
    .select('department_id')
    .eq('department_id', parsed.data.departmentId)
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (departmentError || !department) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: formatDatabaseError(departmentError?.message ?? 'Department not found.'),
    }
  }

  if (slotValues.length > 0) {
    const { data: metrics, error: metricsError } = await context.admin
      .from('metrics')
      .select('metric_id')
      .eq('company_id', context.companyId)
      .eq('department_id', parsed.data.departmentId)
      .eq('is_active', true)
      .eq('input_mode', 'manual')
      .in('metric_id', slotValues)
      .is('deleted_at', null)

    if (metricsError) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: formatDatabaseError(metricsError.message),
      }
    }

    if ((metrics ?? []).length !== slotValues.length) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: 'One or more selected metrics are invalid for this department.',
      }
    }
  }

  const slots = [
    { slot: 1, metric_id: parsed.data.slot1 ?? null },
    { slot: 2, metric_id: parsed.data.slot2 ?? null },
    { slot: 3, metric_id: parsed.data.slot3 ?? null },
  ]

  const { error: saveError } = await context.admin.rpc('save_department_key_metrics', {
    p_company_id: context.companyId,
    p_department_id: parsed.data.departmentId,
    p_slots: slots,
  })

  if (saveError) {
    if (saveError.message.includes('save_department_key_metrics') && saveError.message.toLowerCase().includes('does not exist')) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: 'Database migration missing: run 2026-04-17_save_department_key_metrics_rpc.sql in Supabase.',
      }
    }
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: formatDatabaseError(saveError.message),
    }
  }

  revalidatePath(ROUTES.DAILY_LOG)

  return {
    status: 'success',
    message: 'History columns updated.',
  }
}
