'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { dailyLogFilterSchema } from './schemas'
import {
  formatSecondsToDuration,
} from '@/lib/daily-log/value-parser'
import type {
  DailyLogAgentOption,
  DailyLogKeyMetric,
  DailyLogKeyMetricSlot,
  DailyLogMetric,
  DailyLogMetricDataType,
  DailyLogRecentEntry,
  DailyLogRecentMetricValue,
} from './types'

type DepartmentOption = {
  department_id: string
  name: string
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function getViewerContext() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.',
    }
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

async function getAccessibleDepartments(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
  role: Role,
) {
  if (role === 'owner' || role === 'manager') {
    const { data, error } = await admin
      .from('departments')
      .select('department_id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      return {
        ok: false as const,
        message: formatDatabaseError(error.message),
        departments: [] as DepartmentOption[],
      }
    }

    return { ok: true as const, departments: (data ?? []) as DepartmentOption[] }
  }

  const { data: memberships, error: membershipsError } = await admin
    .from('department_members')
    .select('department_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (membershipsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(membershipsError.message),
      departments: [] as DepartmentOption[],
    }
  }

  const departmentIds = (memberships ?? []).map((item) => item.department_id as string).filter(Boolean)
  if (departmentIds.length === 0) {
    return { ok: true as const, departments: [] as DepartmentOption[] }
  }

  const { data: departmentsData, error: departmentsError } = await admin
    .from('departments')
    .select('department_id, name')
    .eq('company_id', companyId)
    .in('department_id', departmentIds)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (departmentsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(departmentsError.message),
      departments: [] as DepartmentOption[],
    }
  }

  return { ok: true as const, departments: (departmentsData ?? []) as DepartmentOption[] }
}

async function getDepartmentAgents(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const { data: memberships, error: membershipsError } = await admin
    .from('department_members')
    .select('user_id')
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (membershipsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(membershipsError.message),
      agents: [] as DailyLogAgentOption[],
    }
  }

  const userIds = (memberships ?? []).map((item) => item.user_id as string).filter(Boolean)
  if (userIds.length === 0) {
    return { ok: true as const, agents: [] as DailyLogAgentOption[] }
  }

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('user_id, name, role')
    .eq('company_id', companyId)
    .in('user_id', userIds)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (profilesError) {
    return {
      ok: false as const,
      message: formatDatabaseError(profilesError.message),
      agents: [] as DailyLogAgentOption[],
    }
  }

  const agents = ((profiles ?? []) as DailyLogAgentOption[]).sort((a, b) => a.name.localeCompare(b.name))

  return { ok: true as const, agents }
}

function toDailyLogValue(metric: DailyLogMetric, row: { value_numeric: number | null; value_bool: boolean | null }) {
  if (metric.data_type === 'boolean') {
    if (row.value_bool === null) {
      return ''
    }

    return row.value_bool ? 'true' : 'false'
  }

  if (metric.data_type === 'duration') {
    return formatSecondsToDuration(row.value_numeric)
  }

  if (row.value_numeric === null || row.value_numeric === undefined) {
    return ''
  }

  return String(row.value_numeric)
}

async function getKeyMetrics(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  metrics: DailyLogMetric[],
) {
  const candidates = metrics
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  const { data: configuredRows, error: configuredRowsError } = await admin
    .from('department_log_key_metrics')
    .select('slot, metric_id')
    .eq('department_id', departmentId)

  if (configuredRowsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(configuredRowsError.message),
      keyMetrics: [] as DailyLogKeyMetric[],
      keyMetricsConfig: [] as DailyLogKeyMetricSlot[],
      keyMetricCandidates: [] as DailyLogMetric[],
    }
  }

  const candidateById = new Map(candidates.map((metric) => [metric.metric_id, metric]))
  const keyMetricsConfig: DailyLogKeyMetricSlot[] = [
    { slot: 1, metric_id: null },
    { slot: 2, metric_id: null },
    { slot: 3, metric_id: null },
  ]

  for (const row of (configuredRows ?? []) as Array<{ slot: number; metric_id: string }>) {
    if (row.slot < 1 || row.slot > 3) {
      continue
    }

    if (!candidateById.has(row.metric_id)) {
      continue
    }

    keyMetricsConfig[row.slot - 1] = {
      slot: row.slot as 1 | 2 | 3,
      metric_id: row.metric_id,
    }
  }

  const usedMetricIds = new Set<string>()
  const keyMetrics: DailyLogKeyMetric[] = []

  for (const slot of [1, 2, 3] as const) {
    const configured = keyMetricsConfig[slot - 1]
    const configuredMetric = configured.metric_id ? candidateById.get(configured.metric_id) : null

    if (configuredMetric && !usedMetricIds.has(configuredMetric.metric_id)) {
      usedMetricIds.add(configuredMetric.metric_id)
      keyMetrics.push({
        slot,
        metric_id: configuredMetric.metric_id,
        name: configuredMetric.name,
        code: configuredMetric.code,
        data_type: configuredMetric.data_type,
        unit: configuredMetric.unit,
      })
      continue
    }

    const fallback = candidates.find((item) => !usedMetricIds.has(item.metric_id))
    if (!fallback) {
      continue
    }

    usedMetricIds.add(fallback.metric_id)
    keyMetrics.push({
      slot,
      metric_id: fallback.metric_id,
      name: fallback.name,
      code: fallback.code,
      data_type: fallback.data_type,
      unit: fallback.unit,
    })
  }

  return {
    ok: true as const,
    keyMetrics,
    keyMetricsConfig,
    keyMetricCandidates: candidates,
  }
}

async function getRecentLogs(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  viewerRole: Role,
  viewerUserId: string,
  selectedUserId: string,
  keyMetrics: DailyLogKeyMetric[],
) {
  let recentQuery = admin
    .from('daily_entries')
    .select('entry_id, user_id, department_id, entry_date, status, notes, updated_at')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .order('entry_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(20)

  if (viewerRole === 'member') {
    recentQuery = recentQuery.eq('user_id', viewerUserId)
  } else if (selectedUserId) {
    recentQuery = recentQuery.eq('user_id', selectedUserId)
  }

  const { data: entriesData, error: entriesError } = await recentQuery
  if (entriesError) {
    return {
      ok: false as const,
      message: formatDatabaseError(entriesError.message),
      recentLogs: [] as DailyLogRecentEntry[],
    }
  }

  const entries =
    ((entriesData ?? []) as Array<{
      entry_id: string
      user_id: string
      department_id: string
      entry_date: string
      status: 'draft' | 'submitted'
      notes: string | null
      updated_at: string
    }>) ?? []

  if (entries.length === 0) {
    return { ok: true as const, recentLogs: [] as DailyLogRecentEntry[] }
  }

  const entryIds = entries.map((entry) => entry.entry_id)
  const userIds = Array.from(new Set(entries.map((entry) => entry.user_id)))
  const keyMetricIds = keyMetrics.map((metric) => metric.metric_id)

  const { data: profilesData, error: profilesError } = await admin
    .from('profiles')
    .select('user_id, name')
    .in('user_id', userIds)

  if (profilesError) {
    return {
      ok: false as const,
      message: formatDatabaseError(profilesError.message),
      recentLogs: [] as DailyLogRecentEntry[],
    }
  }

  const nameByUserId = new Map(
    ((profilesData ?? []) as Array<{ user_id: string; name: string }>).map((profile) => [profile.user_id, profile.name]),
  )

  let valuesByEntry = new Map<string, DailyLogRecentMetricValue[]>()
  if (keyMetricIds.length > 0) {
    const { data: valuesData, error: valuesError } = await admin
      .from('entry_values')
      .select('entry_id, metric_id, value_numeric, value_bool, value_source')
      .in('entry_id', entryIds)
      .in('metric_id', keyMetricIds)

    if (valuesError) {
      return {
        ok: false as const,
        message: formatDatabaseError(valuesError.message),
        recentLogs: [] as DailyLogRecentEntry[],
      }
    }

    valuesByEntry = (valuesData ?? []).reduce((acc, item) => {
      const existing = acc.get(item.entry_id as string) ?? []
      existing.push({
        metric_id: item.metric_id as string,
        value_numeric: item.value_numeric === null ? null : Number(item.value_numeric),
        value_bool: item.value_bool as boolean | null,
      })
      acc.set(item.entry_id as string, existing)
      return acc
    }, new Map<string, DailyLogRecentMetricValue[]>())
  }

  return {
    ok: true as const,
    recentLogs: entries.map((entry) => ({
      entry_id: entry.entry_id,
      user_id: entry.user_id,
      user_name: nameByUserId.get(entry.user_id) ?? 'Unknown agent',
      department_id: entry.department_id,
      entry_date: entry.entry_date,
      status: entry.status,
      notes: entry.notes,
      updated_at: entry.updated_at,
      key_metric_values: valuesByEntry.get(entry.entry_id) ?? [],
    })),
  }
}

export async function getDailyLogFormData(rawFilters?: {
  date?: string
  departmentId?: string
  userId?: string
}) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false as const, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'member')
  } catch {
    return { success: false as const, error: 'Insufficient permissions.', data: null }
  }

  const parsedFilters = dailyLogFilterSchema.safeParse({
    date: rawFilters?.date,
    departmentId: rawFilters?.departmentId,
    userId: rawFilters?.userId,
  })

  const selectedDate = parsedFilters.success && parsedFilters.data.date ? parsedFilters.data.date : todayKey()
  const requestedDepartmentId = parsedFilters.success ? parsedFilters.data.departmentId : undefined
  const requestedUserId = parsedFilters.success ? parsedFilters.data.userId : undefined

  const departmentsResult = await getAccessibleDepartments(
    context.admin,
    context.companyId,
    context.userId,
    context.role,
  )

  if (!departmentsResult.ok) {
    return { success: false as const, error: departmentsResult.message, data: null }
  }

  const departments = departmentsResult.departments
  const selectedDepartmentId =
    departments.find((department) => department.department_id === requestedDepartmentId)?.department_id ??
    departments[0]?.department_id ??
    ''

  if (!selectedDepartmentId) {
    return {
      success: true as const,
      data: {
        date: selectedDate,
        departments: [],
        selectedDepartmentId: '',
        metrics: [] as DailyLogMetric[],
        values: {} as Record<string, string>,
        existingEntry: null,
        selectedUserId: '',
        agentOptions: [] as DailyLogAgentOption[],
        notes: '',
        keyMetrics: [] as DailyLogKeyMetric[],
        keyMetricsConfig: [] as DailyLogKeyMetricSlot[],
        keyMetricCandidates: [] as DailyLogMetric[],
        recentLogs: [] as DailyLogRecentEntry[],
        viewerRole: context.role,
      },
    }
  }

  const { data: metricsData, error: metricsError } = await context.admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, description')
    .eq('company_id', context.companyId)
    .eq('department_id', selectedDepartmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (metricsError) {
    return { success: false as const, error: formatDatabaseError(metricsError.message), data: null }
  }

  const metrics = (metricsData ?? []) as DailyLogMetric[]

  const keyMetricsResult = await getKeyMetrics(context.admin, context.companyId, selectedDepartmentId, metrics)
  if (!keyMetricsResult.ok) {
    return { success: false as const, error: keyMetricsResult.message, data: null }
  }

  let agentOptions: DailyLogAgentOption[] = []
  let selectedUserId = context.userId

  if (context.role === 'owner' || context.role === 'manager') {
    const agentsResult = await getDepartmentAgents(context.admin, context.companyId, selectedDepartmentId)
    if (!agentsResult.ok) {
      return { success: false as const, error: agentsResult.message, data: null }
    }

    agentOptions = agentsResult.agents
    selectedUserId =
      agentOptions.find((agent) => agent.user_id === requestedUserId)?.user_id ??
      agentOptions[0]?.user_id ??
      ''
  }

  let entry: {
    entry_id: string
    status: 'draft' | 'submitted'
    updated_at: string
    submitted_at: string | null
    notes: string | null
  } | null = null

  if (selectedUserId) {
    const { data: entryData, error: entryError } = await context.admin
      .from('daily_entries')
      .select('entry_id, status, updated_at, submitted_at, notes')
      .eq('company_id', context.companyId)
      .eq('department_id', selectedDepartmentId)
      .eq('user_id', selectedUserId)
      .eq('entry_date', selectedDate)
      .maybeSingle()

    if (entryError) {
      return { success: false as const, error: formatDatabaseError(entryError.message), data: null }
    }

    entry = entryData
      ? {
          entry_id: entryData.entry_id as string,
          status: entryData.status as 'draft' | 'submitted',
          updated_at: entryData.updated_at as string,
          submitted_at: entryData.submitted_at as string | null,
          notes: entryData.notes as string | null,
        }
      : null
  }

  const values: Record<string, string> = {}

  if (entry?.entry_id && metrics.length > 0) {
    const metricIds = metrics.map((metric) => metric.metric_id)
    const metricById = new Map(metrics.map((metric) => [metric.metric_id, metric]))

    const { data: entryValuesData, error: entryValuesError } = await context.admin
      .from('entry_values')
      .select('metric_id, value_numeric, value_bool, value_source')
      .eq('entry_id', entry.entry_id)
      .eq('value_source', 'manual')
      .in('metric_id', metricIds)

    if (entryValuesError) {
      return { success: false as const, error: formatDatabaseError(entryValuesError.message), data: null }
    }

    for (const item of entryValuesData ?? []) {
      const metric = metricById.get(item.metric_id as string)
      if (!metric) {
        continue
      }

      values[item.metric_id as string] = toDailyLogValue(metric, {
        value_numeric: item.value_numeric === null ? null : Number(item.value_numeric),
        value_bool: item.value_bool as boolean | null,
      })
    }
  }

  const recentLogsResult = await getRecentLogs(
    context.admin,
    context.companyId,
    selectedDepartmentId,
    context.role,
    context.userId,
    selectedUserId,
    keyMetricsResult.keyMetrics,
  )

  if (!recentLogsResult.ok) {
    return { success: false as const, error: recentLogsResult.message, data: null }
  }

  return {
    success: true as const,
    data: {
      date: selectedDate,
      departments,
      selectedDepartmentId,
      metrics,
      values,
      existingEntry: entry,
      notes: entry?.notes ?? '',
      selectedUserId,
      agentOptions,
      keyMetrics: keyMetricsResult.keyMetrics,
      keyMetricsConfig: keyMetricsResult.keyMetricsConfig,
      keyMetricCandidates: keyMetricsResult.keyMetricCandidates,
      recentLogs: recentLogsResult.recentLogs,
      viewerRole: context.role,
    },
  }
}
