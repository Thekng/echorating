/* eslint-disable @typescript-eslint/no-unused-vars */
'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { getAccessibleDepartments } from '@/lib/rbac/department-access'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { dailyLogFilterSchema } from './schemas'
import { formatSecondsToDuration } from '@/lib/daily-log/value-parser'
import { normalizeMetricSettings, type DurationFormat } from '@/lib/metrics/data-types'
import type {
  DailyLogAgentOption,
  DailyLogKeyMetric,
  DailyLogKeyMetricSlot,
  DailyLogMetric,
  DailyLogRecentEntry,
  DailyLogRecentMetricValue,
} from './types'

function isMissingMetricsSettingsColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('column metrics.settings does not exist')
}

function isMissingMetricsSortOrderColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('column metrics.sort_order does not exist')
}

async function getManualMetricsForDailyLog(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const withSettingsQuery = admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, settings, description, sort_order')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  const withSettings = await withSettingsQuery
  if (!withSettings.error) {
    return {
      ok: true as const,
      metrics: (withSettings.data ?? []) as DailyLogMetric[],
    }
  }

  if (isMissingMetricsSortOrderColumn(withSettings.error.message)) {
    const sortFallback = await admin
      .from('metrics')
      .select('metric_id, name, code, data_type, unit, settings, description')
      .eq('company_id', companyId)
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .eq('input_mode', 'manual')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!sortFallback.error) {
      return {
        ok: true as const,
        metrics: (sortFallback.data ?? []) as DailyLogMetric[],
      }
    }

    if (!isMissingMetricsSettingsColumn(sortFallback.error.message)) {
      return {
        ok: false as const,
        message: formatDatabaseError(sortFallback.error.message),
        metrics: [] as DailyLogMetric[],
      }
    }
  } else if (!isMissingMetricsSettingsColumn(withSettings.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(withSettings.error.message),
      metrics: [] as DailyLogMetric[],
    }
  }

  const fallback = await admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, description, sort_order')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (fallback.error && !isMissingMetricsSortOrderColumn(fallback.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(fallback.error.message),
      metrics: [] as DailyLogMetric[],
    }
  }

  if (fallback.error && isMissingMetricsSortOrderColumn(fallback.error.message)) {
    const noSortFallback = await admin
      .from('metrics')
      .select('metric_id, name, code, data_type, unit, description')
      .eq('company_id', companyId)
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .eq('input_mode', 'manual')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (noSortFallback.error) {
      return {
        ok: false as const,
        message: formatDatabaseError(noSortFallback.error.message),
        metrics: [] as DailyLogMetric[],
      }
    }

    const metrics = ((noSortFallback.data ?? []) as Array<Omit<DailyLogMetric, 'settings'> & { settings?: unknown }>).map(
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

  const metrics = ((fallback.data ?? []) as Array<Omit<DailyLogMetric, 'settings'> & { settings?: unknown }>).map(
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

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


async function getDepartmentAgents(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  includeViewerUserId?: string,
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

  const userIdSet = new Set<string>(
    (memberships ?? []).map((item) => item.user_id as string).filter(Boolean),
  )
  if (includeViewerUserId) {
    userIdSet.add(includeViewerUserId)
  }
  const userIds = Array.from(userIdSet)
  if (userIds.length === 0) {
    return { ok: true as const, agents: [] as DailyLogAgentOption[] }
  }

  const { data: membershipsData, error: companyMembershipsError } = await admin
    .from('company_members')
    .select('user_id, role, profiles!inner(name)')
    .eq('company_id', companyId)
    .in('user_id', userIds)
    .eq('is_active', true)

  if (companyMembershipsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(companyMembershipsError.message),
      agents: [] as DailyLogAgentOption[],
    }
  }

  const agents = ((membershipsData ?? []) as Array<{
    user_id: string
    role: string
    profiles: { name?: string } | Array<{ name?: string }> | null
  }>)
    .map((membership) => {
      const profile = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles
      return {
        user_id: membership.user_id,
        role: (membership.role === 'owner' || membership.role === 'manager' || membership.role === 'member'
          ? membership.role
          : 'member') as DailyLogAgentOption['role'],
        name: profile?.name ?? 'Unknown agent',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return { ok: true as const, agents }
}

function durationFromSeconds(value: number | null, format: DurationFormat) {
  if (value === null || value === undefined) {
    return ''
  }

  if (format === 'hh_mm_ss') {
    return formatSecondsToDuration(value)
  }

  const divisor = format === 'minutes' ? 60 : format === 'hours' ? 3600 : 86400
  const converted = value / divisor
  return Number.isInteger(converted) ? String(converted) : String(Number(converted.toFixed(2)))
}

function toDailyLogValue(
  metric: DailyLogMetric,
  row: { value_numeric: number | null; value_text: string | null; value_bool: boolean | null },
) {
  const settings = normalizeMetricSettings(metric.data_type, metric.settings)

  if (metric.data_type === 'boolean') {
    if (row.value_bool === null) {
      return ''
    }

    return row.value_bool ? 'true' : 'false'
  }

  if (metric.data_type === 'duration') {
    return durationFromSeconds(row.value_numeric, settings.durationFormat ?? 'hh_mm_ss')
  }

  if (metric.data_type === 'text' || metric.data_type === 'datetime' || metric.data_type === 'selection' || metric.data_type === 'file') {
    return row.value_text ?? ''
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
  const candidates = metrics.slice()

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
        settings: configuredMetric.settings,
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
      settings: fallback.settings,
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
  canManageDepartment: boolean,
  viewerUserId: string,
  selectedUserId: string,
  keyMetrics: DailyLogKeyMetric[],
  page: number,
  pageSize: number,
) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let recentQuery = admin
    .from('daily_entries')
    .select('entry_id, user_id, department_id, entry_date, status, notes, updated_at', {
      count: 'exact',
    })
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .order('entry_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (!canManageDepartment) {
    recentQuery = recentQuery.eq('user_id', viewerUserId)
  } else if (selectedUserId) {
    recentQuery = recentQuery.eq('user_id', selectedUserId)
  }

  const { data: entriesData, error: entriesError, count } = await recentQuery
  if (entriesError) {
    return {
      ok: false as const,
      message: formatDatabaseError(entriesError.message),
      recentLogs: [] as DailyLogRecentEntry[],
      totalCount: 0,
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
    return { ok: true as const, recentLogs: [] as DailyLogRecentEntry[], totalCount: count ?? 0 }
  }

  const entryIds = entries.map((entry) => entry.entry_id)
  const userIds = Array.from(new Set(entries.map((entry) => entry.user_id)))
  const keyMetricIds = keyMetrics.map((metric) => metric.metric_id)

  const { data: profilesData, error: profilesError } = await admin
    .from('company_members')
    .select('user_id, profiles!inner(name)')
    .eq('company_id', companyId)
    .in('user_id', userIds)
    .eq('is_active', true)

  if (profilesError) {
      return {
        ok: false as const,
        message: formatDatabaseError(profilesError.message),
        recentLogs: [] as DailyLogRecentEntry[],
        totalCount: 0,
      }
  }

  const nameByUserId = new Map(
    ((profilesData ?? []) as Array<{
      user_id: string
      profiles: { name?: string } | Array<{ name?: string }> | null
    }>).map((profile) => {
      const related = Array.isArray(profile.profiles) ? profile.profiles[0] : profile.profiles
      return [profile.user_id, related?.name ?? 'Unknown agent'] as const
    }),
  )

  let valuesByEntry = new Map<string, DailyLogRecentMetricValue[]>()
  if (keyMetricIds.length > 0) {
    const { data: valuesData, error: valuesError } = await admin
      .from('entry_values')
      .select('entry_id, metric_id, value_numeric, value_text, value_bool, value_source')
      .in('entry_id', entryIds)
      .in('metric_id', keyMetricIds)

    if (valuesError) {
      return {
        ok: false as const,
        message: formatDatabaseError(valuesError.message),
        recentLogs: [] as DailyLogRecentEntry[],
        totalCount: 0,
      }
    }

    valuesByEntry = (valuesData ?? []).reduce((acc, item) => {
      const existing = acc.get(item.entry_id as string) ?? []
      existing.push({
        metric_id: item.metric_id as string,
        value_numeric: item.value_numeric === null ? null : Number(item.value_numeric),
        value_text: item.value_text as string | null,
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
    totalCount: count ?? entries.length,
  }
}

export async function getDailyLogFormData(rawFilters?: {
  date?: string
  departmentId?: string
  userId?: string
  logsPage?: string
  logsPerPage?: string
}) {
  const context = await getActorContext()
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
  const requestedLogsPage = Number.parseInt(rawFilters?.logsPage ?? '1', 10)
  const requestedLogsPerPage = Number.parseInt(rawFilters?.logsPerPage ?? '10', 10)
  const recentLogsPage = Number.isFinite(requestedLogsPage) && requestedLogsPage > 0 ? requestedLogsPage : 1
  const recentLogsPerPage = [10, 30, 50].includes(requestedLogsPerPage) ? requestedLogsPerPage : 10

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
        recentLogsPage,
        recentLogsPerPage,
        recentLogsTotalCount: 0,
        viewerRole: context.role,
      },
    }
  }

  const metricsResult = await getManualMetricsForDailyLog(
    context.admin,
    context.companyId,
    selectedDepartmentId,
  )
  if (!metricsResult.ok) {
    return { success: false as const, error: metricsResult.message, data: null }
  }

  const metrics = metricsResult.metrics

  const keyMetricsResult = await getKeyMetrics(context.admin, context.companyId, selectedDepartmentId, metrics)
  if (!keyMetricsResult.ok) {
    return { success: false as const, error: keyMetricsResult.message, data: null }
  }

  let agentOptions: DailyLogAgentOption[] = []
  let selectedUserId = context.userId
  let canManageSelectedDepartment = context.role === 'owner' || context.role === 'manager'

  if (!canManageSelectedDepartment) {
    const { data: viewerDepartmentMembership } = await context.admin
      .from('department_members')
      .select('member_role')
      .eq('department_id', selectedDepartmentId)
      .eq('user_id', context.userId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    canManageSelectedDepartment = viewerDepartmentMembership?.member_role === 'lead'
  }

  if (canManageSelectedDepartment) {
    const agentsResult = await getDepartmentAgents(
      context.admin,
      context.companyId,
      selectedDepartmentId,
      context.userId,
    )
    if (!agentsResult.ok) {
      return { success: false as const, error: agentsResult.message, data: null }
    }

    agentOptions = agentsResult.agents
    selectedUserId =
      agentOptions.find((agent) => agent.user_id === requestedUserId)?.user_id ??
      agentOptions.find((agent) => agent.user_id === context.userId)?.user_id ??
      agentOptions[0]?.user_id ??
      context.userId
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
      .select('metric_id, value_numeric, value_text, value_bool, value_source')
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
        value_text: item.value_text as string | null,
        value_bool: item.value_bool as boolean | null,
      })
    }
  }

  const recentLogsResult = await getRecentLogs(
    context.admin,
    context.companyId,
    selectedDepartmentId,
    canManageSelectedDepartment,
    context.userId,
    selectedUserId,
    keyMetricsResult.keyMetrics,
    recentLogsPage,
    recentLogsPerPage,
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
      recentLogsPage,
      recentLogsPerPage,
      recentLogsTotalCount: recentLogsResult.totalCount,
      viewerRole: context.role,
      canManageSelectedDepartment,
    },
  }
}
