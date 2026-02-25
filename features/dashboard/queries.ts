'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { type MetricDataType } from '@/lib/metrics/data-types'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

type DashboardPeriod = 'today' | 'current_week' | 'this_month' | 'custom'
type IncomingDashboardPeriod = DashboardPeriod | 'last_7_days' | 'last_30_days' | 'last_90_days'

type DateRangeResult =
  | {
    ok: true
    period: DashboardPeriod
    startDate: string
    endDate: string
    previousStartDate: string
    previousEndDate: string
    windowDays: number
    elapsedDays: number
    remainingDays: number
  }
  | { ok: false; message: string }

type DepartmentOption = {
  department_id: string
  name: string
}

type AgentOption = {
  user_id: string
  name: string
}

type DashboardMetric = {
  metric_id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
}

type EntryRow = {
  entry_id: string
  entry_date: string
  status: 'draft' | 'submitted'
  user_id: string
}

export type DashboardKpi = {
  metric_id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
  current_value: number
  previous_value: number
  change_pct: number | null
}

export type DashboardTrendPoint = {
  date: string
  label: string
  submitted_logs: number
  primary_metric_value: number
}

export type DashboardMetricTrendPoint = {
  date: string
  label: string
  submitted_logs: number
  value: number
}

export type DashboardMetricTrend = {
  metric_id: string
  points: DashboardMetricTrendPoint[]
}

export type DashboardStats = {
  active_agents: number
  submitted_logs: number
  draft_logs: number
  submission_rate: number
  consistency_rate: number
}

type DashboardResultData = {
  viewerRole: Role
  departments: DepartmentOption[]
  selectedDepartmentId: string
  agents: AgentOption[]
  selectedUserId: string | null
  period: DashboardPeriod
  startDate: string
  endDate: string
  windowDays: number
  elapsedDays: number
  remainingDays: number
  kpis: DashboardKpi[]
  primaryMetric: DashboardMetric | null
  trend: DashboardTrendPoint[]
  metricTrends: DashboardMetricTrend[]
  stats: DashboardStats
}

const SUPPORTED_KPI_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']

const DEFAULT_DEPARTMENT_METRIC_PRIORITY = [
  'premium',
  'premium_quoted',
  'premium_sold',
  'households',
  'quoted_households',
  'policies',
  'policies_sold',
  'items',
  'items_sold',
  'calls',
  'outbound_calls',
  'talk_time',
  'talk_time_min',
  'life_apps',
  'new_conversations',
  'follow_ups_completed',
]

const PERIOD_ALIASES: Record<IncomingDashboardPeriod, DashboardPeriod> = {
  today: 'today',
  current_week: 'current_week',
  this_month: 'this_month',
  custom: 'custom',
  last_7_days: 'current_week',
  last_30_days: 'this_month',
  last_90_days: 'this_month',
}

function dateKeyUtc(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function isDateKey(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 1
  }
  return Math.floor((end - start) / 86400000) + 1
}

function resolveDateRange(
  rawPeriod?: string | null,
  customStartDate?: string | null,
  customEndDate?: string | null,
): DateRangeResult {
  const period = PERIOD_ALIASES[(rawPeriod as IncomingDashboardPeriod | null) ?? 'this_month'] ?? 'this_month'
  const now = new Date()
  const today = dateKeyUtc(now)

  if (period === 'today') {
    return {
      ok: true,
      period,
      startDate: today,
      endDate: today,
      previousStartDate: dateKeyUtc(addUtcDays(now, -1)),
      previousEndDate: dateKeyUtc(addUtcDays(now, -1)),
      windowDays: 1,
      elapsedDays: 1,
      remainingDays: 0,
    }
  }

  if (period === 'current_week') {
    const day = now.getUTCDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    const monday = addUtcDays(now, -diffToMonday)
    const sunday = addUtcDays(monday, 6)
    const startDate = dateKeyUtc(monday)
    const endDate = dateKeyUtc(sunday)
    const windowDays = diffDaysInclusive(startDate, endDate)
    const elapsedDays = diffDaysInclusive(startDate, today)
    const previousEnd = addUtcDays(monday, -1)
    const previousStart = addUtcDays(previousEnd, -(windowDays - 1))

    return {
      ok: true,
      period,
      startDate,
      endDate,
      previousStartDate: dateKeyUtc(previousStart),
      previousEndDate: dateKeyUtc(previousEnd),
      windowDays,
      elapsedDays: Math.max(1, Math.min(windowDays, elapsedDays)),
      remainingDays: Math.max(0, windowDays - Math.max(1, Math.min(windowDays, elapsedDays))),
    }
  }

  if (period === 'this_month') {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 0))
    const startDate = dateKeyUtc(start)
    const endDate = dateKeyUtc(end)
    const windowDays = diffDaysInclusive(startDate, endDate)
    const elapsedDays = diffDaysInclusive(startDate, today)
    const previousEnd = addUtcDays(start, -1)
    const previousStart = addUtcDays(previousEnd, -(windowDays - 1))

    return {
      ok: true,
      period,
      startDate,
      endDate,
      previousStartDate: dateKeyUtc(previousStart),
      previousEndDate: dateKeyUtc(previousEnd),
      windowDays,
      elapsedDays: Math.max(1, Math.min(windowDays, elapsedDays)),
      remainingDays: Math.max(0, windowDays - Math.max(1, Math.min(windowDays, elapsedDays))),
    }
  }

  if (period === 'custom') {
    if (!isDateKey(customStartDate) || !isDateKey(customEndDate)) {
      return { ok: false, message: 'Custom period requires start and end dates.' }
    }

    if (customStartDate > customEndDate) {
      return { ok: false, message: 'Custom start date must be before or equal to end date.' }
    }

    const windowDays = diffDaysInclusive(customStartDate, customEndDate)
    const previousEnd = addUtcDays(new Date(`${customStartDate}T00:00:00Z`), -1)
    const previousStart = addUtcDays(previousEnd, -(windowDays - 1))

    return {
      ok: true,
      period,
      startDate: customStartDate,
      endDate: customEndDate,
      previousStartDate: dateKeyUtc(previousStart),
      previousEndDate: dateKeyUtc(previousEnd),
      windowDays,
      elapsedDays: Math.max(1, Math.min(windowDays, diffDaysInclusive(customStartDate, today))),
      remainingDays: Math.max(
        0,
        windowDays - Math.max(1, Math.min(windowDays, diffDaysInclusive(customStartDate, today))),
      ),
    }
  }
  return { ok: false, message: 'Invalid period.' }
}

async function getViewerContext() {
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
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || !profile.role) {
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

  const { data, error } = await admin
    .from('departments')
    .select('department_id, name')
    .eq('company_id', companyId)
    .in('department_id', departmentIds)
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

function metricPriority(metric: DashboardMetric, keyMetricRank: Map<string, number>) {
  const keyRank = keyMetricRank.get(metric.metric_id)
  if (keyRank !== undefined) {
    return keyRank
  }

  const codeRank = DEFAULT_DEPARTMENT_METRIC_PRIORITY.indexOf(metric.code)
  if (codeRank !== -1) {
    return 100 + codeRank
  }

  return 1000
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0
  }
  return Number(((numerator / denominator) * 100).toFixed(1))
}

function calcChangePct(currentValue: number, previousValue: number) {
  if (previousValue === 0 && currentValue === 0) {
    return 0
  }
  if (previousValue === 0) {
    return null
  }
  return Number((((currentValue - previousValue) / Math.abs(previousValue)) * 100).toFixed(1))
}

function parseMetricValue(
  dataType: MetricDataType,
  row: { value_numeric: number | null; value_bool: boolean | null },
) {
  if (dataType === 'boolean') {
    return row.value_bool ? 1 : 0
  }

  if (row.value_numeric === null || row.value_numeric === undefined) {
    return 0
  }

  return Number(row.value_numeric)
}

function ensureDailyTrendDates(startDate: string, windowDays: number) {
  const list: DashboardTrendPoint[] = []
  const start = new Date(`${startDate}T00:00:00Z`)

  for (let i = 0; i < windowDays; i += 1) {
    const date = addUtcDays(start, i)
    const key = dateKeyUtc(date)
    const label = new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(
      new Date(`${key}T00:00:00`),
    )
    list.push({
      date: key,
      label,
      submitted_logs: 0,
      primary_metric_value: 0,
    })
  }

  return list
}

export async function getDashboardData(filters?: {
  departmentId?: string | null
  userId?: string | null
  period?: IncomingDashboardPeriod | null
  startDate?: string | null
  endDate?: string | null
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

  const range = resolveDateRange(filters?.period, filters?.startDate, filters?.endDate)
  if (!range.ok) {
    return { success: false as const, error: range.message, data: null }
  }

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
  if (departments.length === 0) {
    const emptyData: DashboardResultData = {
      viewerRole: context.role,
      departments: [],
      selectedDepartmentId: '',
      agents: [],
      selectedUserId: null,
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      windowDays: range.windowDays,
      elapsedDays: range.elapsedDays,
      remainingDays: range.remainingDays,
      kpis: [],
      primaryMetric: null,
      trend: [],
      metricTrends: [],
      stats: {
        active_agents: 0,
        submitted_logs: 0,
        draft_logs: 0,
        submission_rate: 0,
        consistency_rate: 0,
      },
    }
    return { success: true as const, data: emptyData }
  }

  const selectedDepartmentId =
    filters?.departmentId && departments.some((department) => department.department_id === filters.departmentId)
      ? filters.departmentId
      : departments[0].department_id

  const { data: metricsData, error: metricsError } = await context.admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit')
    .eq('company_id', context.companyId)
    .eq('department_id', selectedDepartmentId)
    .eq('is_active', true)
    .in('data_type', SUPPORTED_KPI_TYPES)
    .is('deleted_at', null)

  if (metricsError) {
    return { success: false as const, error: formatDatabaseError(metricsError.message), data: null }
  }

  const metrics = (metricsData ?? []) as DashboardMetric[]
  const metricById = new Map(metrics.map((metric) => [metric.metric_id, metric]))

  const { data: keyMetricRows, error: keyMetricRowsError } = await context.admin
    .from('department_log_key_metrics')
    .select('slot, metric_id')
    .eq('department_id', selectedDepartmentId)
    .order('slot', { ascending: true })

  if (keyMetricRowsError) {
    return { success: false as const, error: formatDatabaseError(keyMetricRowsError.message), data: null }
  }

  const keyMetricRank = new Map<string, number>()
  for (const row of (keyMetricRows ?? []) as Array<{ slot: number; metric_id: string }>) {
    if (!metricById.has(row.metric_id)) {
      continue
    }
    keyMetricRank.set(row.metric_id, row.slot)
  }

  const prioritizedMetrics = metrics
    .slice()
    .sort((left, right) => {
      const leftPriority = metricPriority(left, keyMetricRank)
      const rightPriority = metricPriority(right, keyMetricRank)
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, 8)

  const primaryMetric = prioritizedMetrics[0] ?? null
  const selectedMetricIds = prioritizedMetrics.map((metric) => metric.metric_id)

  const { data: activeMembersData, error: activeMembersError } = await context.admin
    .from('department_members')
    .select('user_id, profiles!inner(full_name)')
    .eq('department_id', selectedDepartmentId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (activeMembersError) {
    return { success: false as const, error: formatDatabaseError(activeMembersError.message), data: null }
  }

  const agents: AgentOption[] = ((activeMembersData as any) ?? []).map((row: any) => ({
    user_id: row.user_id,
    name: row.profiles?.full_name || 'Unknown',
  }))

  const activeAgentIds = agents.map((agent) => agent.user_id)

  const isManagerOrOwner = context.role === 'manager' || context.role === 'owner'
  const requestedUserId = filters?.userId === 'all' ? null : filters?.userId

  const effectiveUserId = isManagerOrOwner ? (requestedUserId || null) : context.userId

  let entriesCurrentQuery = context.admin
    .from('daily_entries')
    .select('entry_id, entry_date, status, user_id')
    .eq('company_id', context.companyId)
    .eq('department_id', selectedDepartmentId)
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.endDate)

  if (effectiveUserId) {
    entriesCurrentQuery = entriesCurrentQuery.eq('user_id', effectiveUserId)
  }

  const { data: entriesCurrentData, error: entriesCurrentError } = await entriesCurrentQuery

  if (entriesCurrentError) {
    return { success: false as const, error: formatDatabaseError(entriesCurrentError.message), data: null }
  }

  const entriesCurrent = (entriesCurrentData ?? []) as EntryRow[]
  const submittedCurrent = entriesCurrent.filter((entry) => entry.status === 'submitted')
  const draftCurrent = entriesCurrent.filter((entry) => entry.status === 'draft')

  const submittedLogsByDate = new Map<string, number>()
  for (const entry of submittedCurrent) {
    submittedLogsByDate.set(entry.entry_date, (submittedLogsByDate.get(entry.entry_date) ?? 0) + 1)
  }

  const consistencyRate = toPercent(new Set(submittedCurrent.map((entry) => entry.entry_date)).size, range.windowDays)
  const submissionRate = toPercent(submittedCurrent.length, submittedCurrent.length + draftCurrent.length)

  const stats: DashboardStats = {
    active_agents: activeAgentIds.length,
    submitted_logs: submittedCurrent.length,
    draft_logs: draftCurrent.length,
    submission_rate: submissionRate,
    consistency_rate: consistencyRate,
  }

  let kpis: DashboardKpi[] = []
  let trend = ensureDailyTrendDates(range.startDate, range.windowDays)
  let metricTrends: DashboardMetricTrend[] = []

  if (selectedMetricIds.length > 0) {
    let entriesBothQuery = context.admin
      .from('daily_entries')
      .select('entry_id, entry_date')
      .eq('company_id', context.companyId)
      .eq('department_id', selectedDepartmentId)
      .eq('status', 'submitted')
      .gte('entry_date', range.previousStartDate)
      .lte('entry_date', range.endDate)

    if (effectiveUserId) {
      entriesBothQuery = entriesBothQuery.eq('user_id', effectiveUserId)
    }

    const { data: entriesBothData, error: entriesBothError } = await entriesBothQuery

    if (entriesBothError) {
      return { success: false as const, error: formatDatabaseError(entriesBothError.message), data: null }
    }

    const entriesBoth = (entriesBothData ?? []) as Array<{ entry_id: string; entry_date: string }>
    const entryIds = entriesBoth.map((entry) => entry.entry_id)
    const entryDateById = new Map(entriesBoth.map((entry) => [entry.entry_id, entry.entry_date]))

    if (entryIds.length > 0) {
      const { data: valuesData, error: valuesError } = await context.admin
        .from('entry_values')
        .select('entry_id, metric_id, value_numeric, value_bool')
        .in('entry_id', entryIds)
        .in('metric_id', selectedMetricIds)

      if (valuesError) {
        return { success: false as const, error: formatDatabaseError(valuesError.message), data: null }
      }

      const currentTotals = new Map<string, number>()
      const previousTotals = new Map<string, number>()
      const trendPrimaryByDate = new Map<string, number>()
      const trendByMetricDate = new Map<string, Map<string, number>>()

      for (const metric of prioritizedMetrics) {
        trendByMetricDate.set(metric.metric_id, new Map<string, number>())
      }

      for (const row of (valuesData ?? []) as Array<{
        entry_id: string
        metric_id: string
        value_numeric: number | null
        value_bool: boolean | null
      }>) {
        const metric = metricById.get(row.metric_id)
        if (!metric) {
          continue
        }

        const value = parseMetricValue(metric.data_type, row)
        const entryDate = entryDateById.get(row.entry_id)
        if (!entryDate) {
          continue
        }

        if (entryDate >= range.startDate && entryDate <= range.endDate) {
          currentTotals.set(row.metric_id, (currentTotals.get(row.metric_id) ?? 0) + value)
          const metricTrend = trendByMetricDate.get(row.metric_id)
          if (metricTrend) {
            metricTrend.set(entryDate, (metricTrend.get(entryDate) ?? 0) + value)
          }

          if (primaryMetric?.metric_id === row.metric_id) {
            trendPrimaryByDate.set(entryDate, (trendPrimaryByDate.get(entryDate) ?? 0) + value)
          }
        } else if (entryDate >= range.previousStartDate && entryDate <= range.previousEndDate) {
          previousTotals.set(row.metric_id, (previousTotals.get(row.metric_id) ?? 0) + value)
        }
      }

      kpis = prioritizedMetrics.map((metric) => {
        const currentValue = Number((currentTotals.get(metric.metric_id) ?? 0).toFixed(2))
        const previousValue = Number((previousTotals.get(metric.metric_id) ?? 0).toFixed(2))

        return {
          metric_id: metric.metric_id,
          name: metric.name,
          code: metric.code,
          data_type: metric.data_type,
          unit: metric.unit,
          current_value: currentValue,
          previous_value: previousValue,
          change_pct: calcChangePct(currentValue, previousValue),
        }
      })

      trend = trend.map((point) => ({
        ...point,
        submitted_logs: submittedLogsByDate.get(point.date) ?? 0,
        primary_metric_value: Number((trendPrimaryByDate.get(point.date) ?? 0).toFixed(2)),
      }))

      metricTrends = prioritizedMetrics.map((metric) => {
        const metricDaily = trendByMetricDate.get(metric.metric_id)
        return {
          metric_id: metric.metric_id,
          points: trend.map((point) => ({
            date: point.date,
            label: point.label,
            submitted_logs: point.submitted_logs,
            value: Number((metricDaily?.get(point.date) ?? 0).toFixed(2)),
          })),
        }
      })
    }
  } else {
    trend = trend.map((point) => ({
      ...point,
      submitted_logs: submittedLogsByDate.get(point.date) ?? 0,
      primary_metric_value: 0,
    }))

    metricTrends = []
  }

  const data: DashboardResultData = {
    viewerRole: context.role,
    departments,
    selectedDepartmentId,
    agents,
    selectedUserId: effectiveUserId,
    period: range.period,
    startDate: range.startDate,
    endDate: range.endDate,
    windowDays: range.windowDays,
    elapsedDays: range.elapsedDays,
    remainingDays: range.remainingDays,
    kpis,
    primaryMetric,
    trend,
    metricTrends,
    stats,
  }

  return { success: true as const, data }
}
