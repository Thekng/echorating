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
    cutoffDate: string
    previousStartDate: string
    previousEndDate: string
    previousCutoffDate: string
    windowDays: number
    elapsedDays: number
    remainingDays: number
    paceTotalUnits: number
    paceElapsedUnits: number
    paceUnitLabel: 'workday'
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
  sort_order?: number | null
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
  paceTotalUnits: number
  paceElapsedUnits: number
  paceUnitLabel: 'workday'
  kpis: DashboardKpi[]
  primaryMetric: DashboardMetric | null
  trend: DashboardTrendPoint[]
  metricTrends: DashboardMetricTrend[]
  stats: DashboardStats
}

const SUPPORTED_KPI_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']

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

function countWeekdaysInclusive(startDate: string, endDate: string) {
  if (endDate < startDate) {
    return 0
  }

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  let count = 0

  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const day = cursor.getUTCDay()
    if (day >= 1 && day <= 5) {
      count += 1
    }
  }

  return count
}

function resolvePaceUnits(startDate: string, endDate: string, today: string) {
  const paceTotalUnits = countWeekdaysInclusive(startDate, endDate)
  if (today < startDate) {
    return {
      paceTotalUnits,
      paceElapsedUnits: 0,
      paceUnitLabel: 'workday' as const,
    }
  }

  const effectiveEnd = today < endDate ? today : endDate
  return {
    paceTotalUnits,
    paceElapsedUnits: Math.min(paceTotalUnits, countWeekdaysInclusive(startDate, effectiveEnd)),
    paceUnitLabel: 'workday' as const,
  }
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
    const pace = resolvePaceUnits(today, today, today)
    const previousDay = dateKeyUtc(addUtcDays(now, -1))
    return {
      ok: true,
      period,
      startDate: today,
      endDate: today,
      cutoffDate: today,
      previousStartDate: dateKeyUtc(addUtcDays(now, -1)),
      previousEndDate: dateKeyUtc(addUtcDays(now, -1)),
      previousCutoffDate: previousDay,
      windowDays: 1,
      elapsedDays: 1,
      remainingDays: 0,
      ...pace,
    }
  }

  if (period === 'current_week') {
    const day = now.getUTCDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    const monday = addUtcDays(now, -diffToMonday)
    const sunday = addUtcDays(monday, 6)
    const startDate = dateKeyUtc(monday)
    const endDate = dateKeyUtc(sunday)
    const cutoffDate = today < startDate ? startDate : today > endDate ? endDate : today
    const windowDays = diffDaysInclusive(startDate, endDate)
    const elapsedDays = diffDaysInclusive(startDate, cutoffDate)
    const previousEnd = addUtcDays(monday, -1)
    const previousStart = addUtcDays(previousEnd, -(windowDays - 1))
    const previousCutoff = addUtcDays(previousStart, Math.max(0, elapsedDays - 1))
    const pace = resolvePaceUnits(startDate, endDate, today)

    return {
      ok: true,
      period,
      startDate,
      endDate,
      cutoffDate,
      previousStartDate: dateKeyUtc(previousStart),
      previousEndDate: dateKeyUtc(previousEnd),
      previousCutoffDate: dateKeyUtc(previousCutoff),
      windowDays,
      elapsedDays: Math.max(1, Math.min(windowDays, elapsedDays)),
      remainingDays: Math.max(0, windowDays - Math.max(1, Math.min(windowDays, elapsedDays))),
      ...pace,
    }
  }

  if (period === 'this_month') {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 0))
    const startDate = dateKeyUtc(start)
    const endDate = dateKeyUtc(end)
    const cutoffDate = today < startDate ? startDate : today > endDate ? endDate : today
    const windowDays = diffDaysInclusive(startDate, endDate)
    const elapsedDays = diffDaysInclusive(startDate, cutoffDate)
    const previousStart = new Date(Date.UTC(year, month - 1, 1))
    const previousEnd = new Date(Date.UTC(year, month, 0))
    const previousMonthDays = diffDaysInclusive(dateKeyUtc(previousStart), dateKeyUtc(previousEnd))
    const previousCutoff = addUtcDays(previousStart, Math.min(previousMonthDays - 1, Math.max(0, elapsedDays - 1)))
    const pace = resolvePaceUnits(startDate, endDate, today)

    return {
      ok: true,
      period,
      startDate,
      endDate,
      cutoffDate,
      previousStartDate: dateKeyUtc(previousStart),
      previousEndDate: dateKeyUtc(previousEnd),
      previousCutoffDate: dateKeyUtc(previousCutoff),
      windowDays,
      elapsedDays: Math.max(1, Math.min(windowDays, elapsedDays)),
      remainingDays: Math.max(0, windowDays - Math.max(1, Math.min(windowDays, elapsedDays))),
      ...pace,
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
    const cutoffDate =
      today < customStartDate
        ? customStartDate
        : today > customEndDate
          ? customEndDate
          : today
    const elapsedDays = today < customStartDate ? 0 : diffDaysInclusive(customStartDate, cutoffDate)
    const previousCutoff = addUtcDays(previousStart, elapsedDays <= 0 ? -1 : elapsedDays - 1)
    const pace = resolvePaceUnits(customStartDate, customEndDate, today)
    const clampedElapsedDays = Math.max(0, Math.min(windowDays, elapsedDays))

    return {
      ok: true,
      period,
      startDate: customStartDate,
      endDate: customEndDate,
      cutoffDate,
      previousStartDate: dateKeyUtc(previousStart),
      previousEndDate: dateKeyUtc(previousEnd),
      previousCutoffDate: dateKeyUtc(previousCutoff),
      windowDays,
      elapsedDays: clampedElapsedDays,
      remainingDays: Math.max(0, windowDays - clampedElapsedDays),
      ...pace,
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

function isMissingProfileNameColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('column profiles_1.name does not exist')
}

function isMissingMetricsSortOrderColumn(message: string) {
  return message.toLowerCase().includes('column metrics.sort_order does not exist')
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
      paceTotalUnits: range.paceTotalUnits,
      paceElapsedUnits: range.paceElapsedUnits,
      paceUnitLabel: range.paceUnitLabel,
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

  const metricsWithSort = await context.admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, sort_order')
    .eq('company_id', context.companyId)
    .eq('department_id', selectedDepartmentId)
    .eq('is_active', true)
    .in('data_type', SUPPORTED_KPI_TYPES)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  let metrics: DashboardMetric[] = []
  if (!metricsWithSort.error) {
    metrics = (metricsWithSort.data ?? []) as DashboardMetric[]
  } else if (isMissingMetricsSortOrderColumn(metricsWithSort.error.message)) {
    const metricsFallback = await context.admin
      .from('metrics')
      .select('metric_id, name, code, data_type, unit')
      .eq('company_id', context.companyId)
      .eq('department_id', selectedDepartmentId)
      .eq('is_active', true)
      .in('data_type', SUPPORTED_KPI_TYPES)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (metricsFallback.error) {
      return { success: false as const, error: formatDatabaseError(metricsFallback.error.message), data: null }
    }

    metrics = (metricsFallback.data ?? []) as DashboardMetric[]
  } else {
    return { success: false as const, error: formatDatabaseError(metricsWithSort.error.message), data: null }
  }
  const prioritizedMetrics = metrics
    .slice()
    .sort((left, right) => {
      const leftPriority = left.sort_order ?? Number.MAX_SAFE_INTEGER
      const rightPriority = right.sort_order ?? Number.MAX_SAFE_INTEGER
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, 8)

  const primaryMetric = prioritizedMetrics[0] ?? null
  const selectedMetricIds = prioritizedMetrics.map((metric) => metric.metric_id)
  const metricById = new Map(prioritizedMetrics.map((metric) => [metric.metric_id, metric]))

  const activeMembersWithName = await context.admin
    .from('department_members')
    .select('user_id, profiles!inner(name)')
    .eq('department_id', selectedDepartmentId)
    .eq('is_active', true)
    .is('deleted_at', null)

  let activeMembersData: unknown[] = []
  if (!activeMembersWithName.error) {
    activeMembersData = (activeMembersWithName.data as unknown[]) ?? []
  } else if (isMissingProfileNameColumn(activeMembersWithName.error.message)) {
    const fallbackMembers = await context.admin
      .from('department_members')
      .select('user_id, profiles!inner(full_name)')
      .eq('department_id', selectedDepartmentId)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (fallbackMembers.error) {
      return { success: false as const, error: formatDatabaseError(fallbackMembers.error.message), data: null }
    }

    activeMembersData = (fallbackMembers.data as unknown[]) ?? []
  } else {
    return { success: false as const, error: formatDatabaseError(activeMembersWithName.error.message), data: null }
  }

  const agents: AgentOption[] = (activeMembersData as Array<{ user_id: string; profiles?: { name?: string; full_name?: string } }>)
    .map((row) => ({
      user_id: row.user_id,
      name: row.profiles?.name || row.profiles?.full_name || 'Unknown',
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
    .lte('entry_date', range.cutoffDate)

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
      .lte('entry_date', range.cutoffDate)

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

        if (entryDate >= range.startDate && entryDate <= range.cutoffDate) {
          currentTotals.set(row.metric_id, (currentTotals.get(row.metric_id) ?? 0) + value)
          const metricTrend = trendByMetricDate.get(row.metric_id)
          if (metricTrend) {
            metricTrend.set(entryDate, (metricTrend.get(entryDate) ?? 0) + value)
          }

          if (primaryMetric?.metric_id === row.metric_id) {
            trendPrimaryByDate.set(entryDate, (trendPrimaryByDate.get(entryDate) ?? 0) + value)
          }
        } else if (entryDate >= range.previousStartDate && entryDate <= range.previousCutoffDate) {
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
    paceTotalUnits: range.paceTotalUnits,
    paceElapsedUnits: range.paceElapsedUnits,
    paceUnitLabel: range.paceUnitLabel,
    kpis,
    primaryMetric,
    trend,
    metricTrends,
    stats,
  }

  return { success: true as const, data }
}
