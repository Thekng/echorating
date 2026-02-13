'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { dailyLogFormSchema } from './schemas'
import {
  type DailyLogActionState,
  type DailyLogKeyMetricsActionState,
  type DailyLogMetricDataType,
} from './types'
import { parseBooleanInput, parseDurationToSeconds } from '@/lib/daily-log/value-parser'

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

async function getActorContext() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false as const, message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.' }
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, message: 'Authentication required.' }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('company_id, role, is_active, deleted_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || !profile?.role || profile.is_active === false || profile.deleted_at) {
    return { ok: false as const, message: 'Active company profile not found.' }
  }

  return {
    ok: true as const,
    admin,
    userId: user.id,
    companyId: profile.company_id as string,
    role: profile.role as Role,
  }
}

async function getAccessibleDepartmentIds(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
  role: Role,
) {
  if (role === 'owner' || role === 'manager') {
    const { data, error } = await admin
      .from('departments')
      .select('department_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (error) {
      return { ok: false as const, message: formatDatabaseError(error.message), departmentIds: [] as string[] }
    }

    return {
      ok: true as const,
      departmentIds: (data ?? []).map((item) => item.department_id as string),
    }
  }

  const { data, error } = await admin
    .from('department_members')
    .select('department_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message), departmentIds: [] as string[] }
  }

  return {
    ok: true as const,
    departmentIds: (data ?? []).map((item) => item.department_id as string),
  }
}

async function isUserInDepartment(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  userId: string,
) {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile) {
    return { ok: false as const, message: 'Agent not found in company.' }
  }

  const { data: membership, error: membershipError } = await admin
    .from('department_members')
    .select('department_id')
    .eq('department_id', departmentId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership) {
    return { ok: false as const, message: 'Agent is not active in this department.' }
  }

  return { ok: true as const }
}

async function getManualMetricsForDepartment(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const { data, error } = await admin
    .from('metrics')
    .select('metric_id, data_type')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)

  if (error) {
    return {
      ok: false as const,
      message: formatDatabaseError(error.message),
      metrics: [] as Array<{ metric_id: string; data_type: DailyLogMetricDataType }>,
    }
  }

  return {
    ok: true as const,
    metrics: (data ?? []) as Array<{ metric_id: string; data_type: DailyLogMetricDataType }>,
  }
}

function parseMetricValue(
  metricType: DailyLogMetricDataType,
  rawValue: string,
):
  | { ok: true; hasValue: false }
  | { ok: true; hasValue: true; value_numeric: number | null; value_bool: boolean | null }
  | { ok: false; message: string } {
  if (metricType === 'boolean') {
    const normalized = rawValue.trim()
    if (!normalized) {
      return { ok: true, hasValue: false }
    }

    const parsedBool = parseBooleanInput(normalized)
    if (parsedBool === null) {
      return { ok: false, message: 'Invalid boolean value.' }
    }

    return {
      ok: true,
      hasValue: true,
      value_numeric: null,
      value_bool: parsedBool,
    }
  }

  if (metricType === 'duration') {
    const durationResult = parseDurationToSeconds(rawValue)
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

  return {
    ok: true,
    hasValue: true,
    value_numeric: parsedNumber.value,
    value_bool: null,
  }
}

export async function saveDailyLogAction(
  _prevState: DailyLogActionState,
  formData: FormData,
): Promise<DailyLogActionState> {
  const parsed = dailyLogFormSchema.safeParse({
    date: field(formData, 'date'),
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

  const context = await getActorContext()
  if (!context.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: context.message,
      intent: parsed.data.intent,
    }
  }

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

  const targetUserId =
    context.role === 'owner' || context.role === 'manager'
      ? (parsed.data.userId ?? '')
      : context.userId

  if (!targetUserId) {
    return {
      ...INITIAL_ERROR_STATE,
      message: 'Select an agent first.',
      intent: parsed.data.intent,
    }
  }

  if (context.role === 'owner' || context.role === 'manager') {
    const targetValidation = await isUserInDepartment(
      context.admin,
      context.companyId,
      parsed.data.departmentId,
      targetUserId,
    )

    if (!targetValidation.ok) {
      return {
        ...INITIAL_ERROR_STATE,
        message: targetValidation.message,
        intent: parsed.data.intent,
      }
    }
  }

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
    value_bool: boolean | null
  }> = []

  for (const metric of metricsResult.metrics) {
    const raw = field(formData, `metric_${metric.metric_id}`)
    const parsedValue = parseMetricValue(metric.data_type, raw)

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
      value_bool: parsedValue.value_bool,
    })
  }

  const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null
  const now = new Date().toISOString()
  const submitting = parsed.data.intent === 'submit'

  const { data: existingEntry, error: existingEntryError } = await context.admin
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

  const nextEntryStatus = submitting || existingEntry?.status === 'submitted' ? 'submitted' : 'draft'
  const nextSubmittedAt =
    submitting ? now : nextEntryStatus === 'submitted' ? (existingEntry?.submitted_at ?? now) : null

  const { data: entry, error: entryError } = await context.admin
    .from('daily_entries')
    .upsert(
      {
        company_id: context.companyId,
        department_id: parsed.data.departmentId,
        user_id: targetUserId,
        entry_date: parsed.data.date,
        status: nextEntryStatus,
        submitted_at: nextSubmittedAt,
        notes,
        updated_at: now,
      },
      { onConflict: 'company_id,department_id,user_id,entry_date' },
    )
    .select('entry_id')
    .maybeSingle()

  if (entryError || !entry?.entry_id) {
    return {
      ...INITIAL_ERROR_STATE,
      message: formatDatabaseError(entryError?.message ?? 'Failed to save entry.'),
      intent: parsed.data.intent,
    }
  }

  const { error: deleteValuesError } = await context.admin
    .from('entry_values')
    .delete()
    .eq('entry_id', entry.entry_id)
    .eq('value_source', 'manual')

  if (deleteValuesError) {
    return {
      ...INITIAL_ERROR_STATE,
      message: formatDatabaseError(deleteValuesError.message),
      intent: parsed.data.intent,
      entryId: entry.entry_id,
    }
  }

  if (valueRows.length > 0) {
    const { error: insertValuesError } = await context.admin.from('entry_values').insert(
      valueRows.map((row) => ({
        entry_id: entry.entry_id,
        metric_id: row.metric_id,
        value_numeric: row.value_numeric,
        value_bool: row.value_bool,
        value_text: null,
        value_source: 'manual',
      })),
    )

    if (insertValuesError) {
      return {
        ...INITIAL_ERROR_STATE,
        message: formatDatabaseError(insertValuesError.message),
        intent: parsed.data.intent,
        entryId: entry.entry_id,
      }
    }
  }

  revalidatePath(ROUTES.DAILY_LOG)

  return {
    status: 'success',
    message: submitting ? 'Log submitted successfully.' : 'Draft saved.',
    intent: parsed.data.intent,
    entryStatus: nextEntryStatus,
    savedAt: now,
    entryId: entry.entry_id,
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

  if (context.role === 'member' && entry.user_id !== context.userId) {
    return
  }

  if (context.role !== 'member') {
    const accessibleDepartments = await getAccessibleDepartmentIds(
      context.admin,
      context.companyId,
      context.userId,
      context.role,
    )

    if (!accessibleDepartments.ok || !accessibleDepartments.departmentIds.includes(entry.department_id as string)) {
      return
    }
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

  try {
    requireRole(context.role, 'manager')
  } catch {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: 'Insufficient permissions.',
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

  const { error: clearError } = await context.admin
    .from('department_log_key_metrics')
    .delete()
    .eq('department_id', parsed.data.departmentId)

  if (clearError) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: formatDatabaseError(clearError.message),
    }
  }

  const rows = [
    { slot: 1, metricId: parsed.data.slot1 },
    { slot: 2, metricId: parsed.data.slot2 },
    { slot: 3, metricId: parsed.data.slot3 },
  ].filter((item) => item.metricId)

  if (rows.length > 0) {
    const { error: insertError } = await context.admin.from('department_log_key_metrics').insert(
      rows.map((row) => ({
        department_id: parsed.data.departmentId,
        slot: row.slot,
        metric_id: row.metricId,
      })),
    )

    if (insertError) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: formatDatabaseError(insertError.message),
      }
    }
  }

  revalidatePath(ROUTES.DAILY_LOG)

  return {
    status: 'success',
    message: 'History columns updated.',
  }
}
