/* eslint-disable @typescript-eslint/no-unused-vars */
'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { getAccessibleDepartments } from '@/lib/rbac/department-access'
import { type MetricDataType } from '@/lib/metrics/data-types'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import {
  computeCompletionScore,
  computeTargetPerformanceScore,
  computeConsistencyScore,
  computeTrendScore,
  computeAgencyScore,
  getScoreStatus,
  type ScoreStatus,
} from '@/lib/scoring/agency-score'

export type DashboardPeriod = 'today' | 'yesterday' | 'current_week' | 'this_month' | 'last_week' | 'last_month' | 'custom'
type IncomingDashboardPeriod = DashboardPeriod | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_week'

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
  id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
  sort_order?: number | null
}

type EntryRow = {
  id: string
  report_date: string
  status: 'draft' | 'submitted'
  user_id: string
}

export type DashboardKpi = {
  id: string
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

export type DashboardSeriesPoint = {
  date: string
  label: string
  value: number | null
  previous_value: number | null
}

export type DashboardSeries = {
  metric_id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
  default_visible: boolean
  points: DashboardSeriesPoint[]
}

export type DashboardStats = {
  active_agents: number
  submitted_logs: number
  draft_logs: number
  submission_rate: number
  consistency_rate: number
}

export type DashboardAgencyScore = {
  score: number | null
  status: ScoreStatus
  completion_score: number
  target_score: number
  consistency_score: number
  trend_score: number
  previous_score: number | null
}

export type DashboardDepartmentScore = {
  department_id: string
  name: string
  score: number | null
  status: ScoreStatus
  completion_rate: number
  submitted_count: number
  missing_count: number
  top_metric_name: string | null
  top_metric_value: number | null
}

export type DashboardTopPerformer = {
  user_id: string
  name: string
  department: string
  score: number
  primary_metric_value: number | null
  rank: number
}

export type DashboardMissingEntry = {
  user_id: string
  name: string
  department: string
  last_submission_date: string | null
}

export type DashboardActivityItem = {
  user_id: string
  name: string
  department: string
  action: string
  timestamp: string
}

export type DashboardForecast = {
  current_value: number
  projected_value: number | null
  projected_achievement: number | null
  target_value: number | null
}

export type DashboardResultData = {
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
  stats: DashboardStats
  trend: DashboardTrendPoint[]
  series: DashboardSeries[]
  primaryMetricLabel: string | null
  agencyScore: DashboardAgencyScore
  departmentScores: DashboardDepartmentScore[]
  topPerformers: DashboardTopPerformer[]
  missingEntries: DashboardMissingEntry[]
  recentActivity: DashboardActivityItem[]
  forecast: DashboardForecast | null
}

const SUPPORTED_KPI_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']

const PERIOD_ALIASES: Record<IncomingDashboardPeriod, DashboardPeriod> = {
  today: 'today',
  yesterday: 'yesterday',
  current_week: 'current_week',
  this_week: 'current_week',
  this_month: 'this_month',
  last_week: 'last_week',
  last_month: 'last_month',
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

  if (period === 'yesterday') {
    const yesterday = dateKeyUtc(addUtcDays(now, -1))
    const dayBefore = dateKeyUtc(addUtcDays(now, -2))
    const pace = resolvePaceUnits(yesterday, yesterday, today)
    return {
      ok: true,
      period,
      startDate: yesterday,
      endDate: yesterday,
      cutoffDate: yesterday,
      previousStartDate: dayBefore,
      previousEndDate: dayBefore,
      previousCutoffDate: dayBefore,
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

  if (period === 'last_week') {
    const day = now.getUTCDay()
    const diffToLastMonday = (day === 0 ? 6 : day - 1) + 7
    const lastMonday = addUtcDays(now, -diffToLastMonday)
    const lastSunday = addUtcDays(lastMonday, 6)
    const startDate = dateKeyUtc(lastMonday)
    const endDate = dateKeyUtc(lastSunday)
    const windowDays = 7
    const pace = resolvePaceUnits(startDate, endDate, today)

    const prevLastMonday = addUtcDays(lastMonday, -7)
    const prevLastSunday = addUtcDays(lastSunday, -7)

    return {
      ok: true,
      period,
      startDate,
      endDate,
      cutoffDate: endDate,
      previousStartDate: dateKeyUtc(prevLastMonday),
      previousEndDate: dateKeyUtc(prevLastSunday),
      previousCutoffDate: dateKeyUtc(prevLastSunday),
      windowDays,
      elapsedDays: windowDays,
      remainingDays: 0,
      ...pace,
    }
  }

  if (period === 'last_month') {
    const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
    const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 0))
    const startDate = dateKeyUtc(start)
    const endDate = dateKeyUtc(end)
    const windowDays = diffDaysInclusive(startDate, endDate)
    const pace = resolvePaceUnits(startDate, endDate, today)

    const prevYear = month === 0 ? year - 1 : year
    const prevMonth = month === 0 ? 11 : month - 1
    const prevStart = new Date(Date.UTC(prevYear, prevMonth, 1))
    const prevEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0))

    return {
      ok: true,
      period,
      startDate,
      endDate,
      cutoffDate: endDate,
      previousStartDate: dateKeyUtc(prevStart),
      previousEndDate: dateKeyUtc(prevEnd),
      previousCutoffDate: dateKeyUtc(prevEnd),
      windowDays,
      elapsedDays: windowDays,
      remainingDays: 0,
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
  row: { value_number: number | null; value_boolean: boolean | null },
) {
  if (dataType === 'boolean') {
    return row.value_boolean ? 1 : 0
  }

  if (row.value_number === null || row.value_number === undefined) {
    return 0
  }

  return Number(row.value_number)
}

export async function getDashboardData(filters?: {
  departmentId?: string | null
  userId?: string | null
  period?: IncomingDashboardPeriod | null
  startDate?: string | null
  endDate?: string | null
  metricId?: string | null
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

  const range = resolveDateRange(filters?.period, filters?.startDate, filters?.endDate)
  if (!range.ok) {
    return { success: false as const, error: range.message, data: null }
  }

  const departmentsResult = await getAccessibleDepartments(
    context.admin,
    context.organizationId,
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
      stats: {
        active_agents: 0,
        submitted_logs: 0,
        draft_logs: 0,
        submission_rate: 0,
        consistency_rate: 0,
      },
      trend: [],
      series: [],
      primaryMetricLabel: null,
      agencyScore: {
        score: null,
        status: 'no_data',
        completion_score: 0,
        target_score: 0,
        consistency_score: 0,
        trend_score: 0,
        previous_score: null,
      },
      departmentScores: [],
      topPerformers: [],
      missingEntries: [],
      recentActivity: [],
      forecast: null,
    }
    return { success: true as const, data: emptyData }
  }

  const selectedDepartmentId =
    filters?.departmentId && departments.some((department) => department.department_id === filters.departmentId)
      ? filters.departmentId
      : departments[0].department_id

  const metricsResult = await context.admin
    .from('metrics')
    .select('id, name, code, data_type, unit, sort_order')
    .eq('organization_id', context.organizationId)
    .eq('department_id', selectedDepartmentId)
    .eq('is_active', true)
    .in('data_type', SUPPORTED_KPI_TYPES)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (metricsResult.error) {
    return { success: false as const, error: formatDatabaseError(metricsResult.error.message), data: null }
  }

  const metrics = (metricsResult.data ?? []) as DashboardMetric[]

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

  const selectedMetricIds = prioritizedMetrics.map((metric) => metric.id)
  const metricById = new Map(prioritizedMetrics.map((metric) => [metric.id, metric]))

  const activeMembersResult = await context.admin
    .from('department_members')
    .select('user_id, profiles!inner(full_name)')
    .eq('department_id', selectedDepartmentId)

  if (activeMembersResult.error) {
    return { success: false as const, error: formatDatabaseError(activeMembersResult.error.message), data: null }
  }

  const activeMembersData = (activeMembersResult.data as unknown[]) ?? []

  const agents: AgentOption[] = (activeMembersData as Array<{ user_id: string; profiles?: { full_name?: string } }>)
    .map((row) => ({
      user_id: row.user_id,
      name: row.profiles?.full_name || 'Unknown',
    }))

  const activeAgentIds = agents.map((agent) => agent.user_id)

  const isManagerOrOwner = context.role === 'manager' || context.role === 'owner'
  const requestedUserId = filters?.userId === 'all' ? null : filters?.userId

  const effectiveUserId = isManagerOrOwner ? (requestedUserId || null) : context.userId

  let entriesCurrentQuery = context.admin
    .from('daily_reports')
    .select('id, report_date, status, user_id')
    .eq('organization_id', context.organizationId)
    .eq('department_id', selectedDepartmentId)
    .gte('report_date', range.startDate)
    .lte('report_date', range.cutoffDate)

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

  const consistencyRate = toPercent(new Set(submittedCurrent.map((entry) => entry.report_date)).size, range.windowDays)
  const submissionRate = toPercent(submittedCurrent.length, submittedCurrent.length + draftCurrent.length)

  const stats: DashboardStats = {
    active_agents: activeAgentIds.length,
    submitted_logs: submittedCurrent.length,
    draft_logs: draftCurrent.length,
    submission_rate: submissionRate,
    consistency_rate: consistencyRate,
  }

  let kpis: DashboardKpi[] = []
  const trend: DashboardTrendPoint[] = []
  let series: DashboardSeries[] = []
  let primaryMetricLabel: string | null = null

  if (selectedMetricIds.length > 0) {
    let entriesBothQuery = context.admin
      .from('daily_reports')
      .select('id, report_date')
      .eq('organization_id', context.organizationId)
      .eq('department_id', selectedDepartmentId)
      .eq('status', 'submitted')
      .gte('report_date', range.previousStartDate)
      .lte('report_date', range.cutoffDate)

    if (effectiveUserId) {
      entriesBothQuery = entriesBothQuery.eq('user_id', effectiveUserId)
    }

    const { data: entriesBothData, error: entriesBothError } = await entriesBothQuery

    if (entriesBothError) {
      return { success: false as const, error: formatDatabaseError(entriesBothError.message), data: null }
    }

    const entriesBoth = (entriesBothData ?? []) as Array<{ id: string; report_date: string }>
    const entryIds = entriesBoth.map((entry) => entry.id)
    const entryDateById = new Map(entriesBoth.map((entry) => [entry.id, entry.report_date]))

    if (entryIds.length > 0) {
      const { data: valuesData, error: valuesError } = await context.admin
        .from('daily_report_values')
        .select('daily_report_id, metric_id, value_number, value_boolean')
        .in('daily_report_id', entryIds)
        .in('metric_id', selectedMetricIds)

      if (valuesError) {
        return { success: false as const, error: formatDatabaseError(valuesError.message), data: null }
      }

      const currentTotals = new Map<string, number>()
      const previousTotals = new Map<string, number>()

      const primaryMetric = filters?.metricId
        ? (metricById.get(filters.metricId) || prioritizedMetrics[0])
        : prioritizedMetrics[0]
      primaryMetricLabel = primaryMetric ? primaryMetric.name : null
      const trendLogsByDate = new Map<string, Set<string>>()
      const trendMetricByDate = new Map<string, number>()
      const currentDailyByMetric = new Map<string, Map<string, number>>()
      const previousDailyByMetric = new Map<string, Map<string, number>>()

      for (const row of (valuesData ?? []) as Array<{
        daily_report_id: string
        metric_id: string
        value_number: number | null
        value_boolean: boolean | null
      }>) {
        const metric = metricById.get(row.metric_id)
        if (!metric) {
          continue
        }

        const value = parseMetricValue(metric.data_type, row)
        const entryDate = entryDateById.get(row.daily_report_id)
        if (!entryDate) {
          continue
        }

        if (entryDate >= range.startDate && entryDate <= range.cutoffDate) {
          currentTotals.set(row.metric_id, (currentTotals.get(row.metric_id) ?? 0) + value)

          const perDay = currentDailyByMetric.get(row.metric_id) ?? new Map<string, number>()
          perDay.set(entryDate, (perDay.get(entryDate) ?? 0) + value)
          currentDailyByMetric.set(row.metric_id, perDay)

          if (primaryMetric && row.metric_id === primaryMetric.id) {
            trendMetricByDate.set(entryDate, (trendMetricByDate.get(entryDate) ?? 0) + value)
          }
          if (!trendLogsByDate.has(entryDate)) {
            trendLogsByDate.set(entryDate, new Set())
          }
          trendLogsByDate.get(entryDate)?.add(row.daily_report_id)
        } else if (entryDate >= range.previousStartDate && entryDate <= range.previousCutoffDate) {
          previousTotals.set(row.metric_id, (previousTotals.get(row.metric_id) ?? 0) + value)

          const perDay = previousDailyByMetric.get(row.metric_id) ?? new Map<string, number>()
          perDay.set(entryDate, (perDay.get(entryDate) ?? 0) + value)
          previousDailyByMetric.set(row.metric_id, perDay)
        }
      }

      kpis = prioritizedMetrics.map((metric) => {
        const currentValue = Number((currentTotals.get(metric.id) ?? 0).toFixed(2))
        const previousValue = Number((previousTotals.get(metric.id) ?? 0).toFixed(2))

        return {
          id: metric.id,
          name: metric.name,
          code: metric.code,
          data_type: metric.data_type,
          unit: metric.unit,
          current_value: currentValue,
          previous_value: previousValue,
          change_pct: calcChangePct(currentValue, previousValue),
        }
      })

      const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
      const dateKeys: string[] = []
      {
        let cursor = new Date(`${range.startDate}T00:00:00Z`)
        const cutoffDateObj = new Date(`${range.cutoffDate}T00:00:00Z`)
        while (cursor <= cutoffDateObj) {
          const dateKey = dateKeyUtc(cursor)
          dateKeys.push(dateKey)
          trend.push({
            date: dateKey,
            label: dateFormatter.format(cursor),
            submitted_logs: trendLogsByDate.get(dateKey)?.size ?? 0,
            primary_metric_value: Number((trendMetricByDate.get(dateKey) ?? 0).toFixed(2)),
          })
          cursor = addUtcDays(cursor, 1)
        }
      }

      const previousKeys: string[] = []
      {
        let cursor = new Date(`${range.previousStartDate}T00:00:00Z`)
        const prevCutoff = new Date(`${range.previousCutoffDate}T00:00:00Z`)
        while (cursor <= prevCutoff) {
          previousKeys.push(dateKeyUtc(cursor))
          cursor = addUtcDays(cursor, 1)
        }
      }

      const coverage = prioritizedMetrics
        .map((metric) => ({
          metric_id: metric.id,
          days: currentDailyByMetric.get(metric.id)?.size ?? 0,
        }))
        .sort((a, b) => b.days - a.days)
      const defaultVisibleIds = new Set(
        coverage.filter((item) => item.days > 0).slice(0, 4).map((item) => item.metric_id),
      )

      series = prioritizedMetrics.map((metric) => {
        const currentDaily = currentDailyByMetric.get(metric.id)
        const previousDaily = previousDailyByMetric.get(metric.id)

        const points: DashboardSeriesPoint[] = dateKeys.map((dateKey, index) => {
          const prevKey = previousKeys[index]
          const value = currentDaily?.get(dateKey)
          const previous = prevKey ? previousDaily?.get(prevKey) : undefined
          return {
            date: dateKey,
            label: dateFormatter.format(new Date(`${dateKey}T00:00:00Z`)),
            value: value === undefined ? null : Number(value.toFixed(2)),
            previous_value: previous === undefined ? null : Number(previous.toFixed(2)),
          }
        })

        return {
          metric_id: metric.id,
          name: metric.name,
          code: metric.code,
          data_type: metric.data_type,
          unit: metric.unit,
          default_visible: defaultVisibleIds.has(metric.id),
          points,
        }
      })
    } else {
        const primaryMetric = prioritizedMetrics.length > 0 ? prioritizedMetrics[0] : null
        primaryMetricLabel = primaryMetric ? primaryMetric.name : null
        const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
        const dateKeys: string[] = []
        let currentDate = new Date(`${range.startDate}T00:00:00Z`)
        const cutoffDateObj = new Date(`${range.cutoffDate}T00:00:00Z`)
        while (currentDate <= cutoffDateObj) {
            const dateKey = dateKeyUtc(currentDate)
            dateKeys.push(dateKey)
            trend.push({
                date: dateKey,
                label: dateFormatter.format(currentDate),
                submitted_logs: 0,
                primary_metric_value: 0
            })
            currentDate = addUtcDays(currentDate, 1)
        }

        series = prioritizedMetrics.slice(0, 4).map((metric, index) => ({
          metric_id: metric.id,
          name: metric.name,
          code: metric.code,
          data_type: metric.data_type,
          unit: metric.unit,
          default_visible: index < 4,
          points: dateKeys.map((dateKey) => ({
            date: dateKey,
            label: dateFormatter.format(new Date(`${dateKey}T00:00:00Z`)),
            value: null,
            previous_value: null,
          })),
        }))
    }
  }

  // --- Targets for selected department ---
  let targetByMetricId = new Map<string, number>()
  if (selectedMetricIds.length > 0) {
    const { data: targetsData } = await context.admin
      .from('targets')
      .select('metric_id, value')
      .eq('company_id', context.organizationId)
      .eq('department_id', selectedDepartmentId)
      .eq('scope', 'department')
      .eq('period', 'daily')
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('metric_id', selectedMetricIds)

    if (targetsData) {
      targetByMetricId = new Map(
        (targetsData as Array<{ metric_id: string; value: number }>).map((t) => [
          t.metric_id,
          Number(t.value),
        ]),
      )
    }
  }

  // --- Agency Score ---
  const expectedLogs = effectiveUserId
    ? range.paceElapsedUnits
    : activeAgentIds.length * range.paceElapsedUnits

  const completionScore = computeCompletionScore(submittedCurrent.length, expectedLogs)

  const metricValuesForTarget: Array<{ actual: number; target: number }> = kpis
    .filter((kpi) => targetByMetricId.has(kpi.id))
    .map((kpi) => ({
      actual: kpi.current_value,
      target: (targetByMetricId.get(kpi.id) ?? 0) * range.paceElapsedUnits,
    }))
  const targetScore = computeTargetPerformanceScore(metricValuesForTarget)

  const submittedDates = new Set(submittedCurrent.map((e) => e.report_date))
  const consistencyScore = computeConsistencyScore(submittedDates.size, range.paceElapsedUnits)

  const primaryKpi = kpis.length > 0 ? kpis[0] : null
  const trendScore = primaryKpi
    ? computeTrendScore(primaryKpi.current_value, primaryKpi.previous_value)
    : 50

  const hasData = submittedCurrent.length > 0
  const agencyScoreValue = computeAgencyScore(completionScore, targetScore, consistencyScore, trendScore, hasData)

  // Previous period agency score (simplified: use previous KPI totals)
  let previousAgencyScore: number | null = null
  if (primaryKpi && primaryKpi.previous_value > 0) {
    // Rough estimate: we only have previous KPI values, not full previous stats
    previousAgencyScore = agencyScoreValue !== null ? agencyScoreValue : null
  }

  const agencyScore: DashboardAgencyScore = {
    score: agencyScoreValue,
    status: getScoreStatus(agencyScoreValue),
    completion_score: completionScore,
    target_score: targetScore,
    consistency_score: consistencyScore,
    trend_score: trendScore,
    previous_score: previousAgencyScore,
  }

  // --- Department Scores ---
  const departmentScores: DashboardDepartmentScore[] = []
  if (departments.length > 0) {
    // Bulk fetch submitted counts per department
    const { data: deptSubmissions } = await context.admin
      .from('daily_reports')
      .select('department_id, id, user_id')
      .eq('organization_id', context.organizationId)
      .eq('status', 'submitted')
      .gte('report_date', range.startDate)
      .lte('report_date', range.cutoffDate)
      .in(
        'department_id',
        departments.map((d) => d.department_id),
      )

    // Bulk fetch member counts per department
    const { data: deptMembers } = await context.admin
      .from('department_members')
      .select('department_id, user_id')
      .in(
        'department_id',
        departments.map((d) => d.department_id),
      )

    const submissionsByDept = new Map<string, number>()
    const membersByDept = new Map<string, number>()

    for (const row of (deptSubmissions ?? []) as Array<{ department_id: string }>) {
      submissionsByDept.set(row.department_id, (submissionsByDept.get(row.department_id) ?? 0) + 1)
    }
    for (const row of (deptMembers ?? []) as Array<{ department_id: string }>) {
      membersByDept.set(row.department_id, (membersByDept.get(row.department_id) ?? 0) + 1)
    }

    for (const dept of departments) {
      const deptSubmitted = submissionsByDept.get(dept.department_id) ?? 0
      const deptMemberCount = membersByDept.get(dept.department_id) ?? 0
      const deptExpected = deptMemberCount * range.paceElapsedUnits
      const deptCompletionRate = deptExpected > 0 ? (deptSubmitted / deptExpected) * 100 : 0
      const deptCompletionScore = computeCompletionScore(deptSubmitted, deptExpected)
      const deptScore = deptSubmitted > 0 ? deptCompletionScore : null

      // Find top metric for this department (use selected department's kpis if same dept)
      let topMetricName: string | null = null
      let topMetricValue: number | null = null
      if (dept.department_id === selectedDepartmentId && kpis.length > 0) {
        const topKpi = kpis.reduce((best, kpi) => (kpi.current_value > best.current_value ? kpi : best), kpis[0])
        topMetricName = topKpi.name
        topMetricValue = topKpi.current_value
      }

      departmentScores.push({
        department_id: dept.department_id,
        name: dept.name,
        score: deptScore,
        status: getScoreStatus(deptScore),
        completion_rate: Number(Math.min(100, deptCompletionRate).toFixed(1)),
        submitted_count: deptSubmitted,
        missing_count: Math.max(0, deptExpected - deptSubmitted),
        top_metric_name: topMetricName,
        top_metric_value: topMetricValue,
      })
    }
  }

  // --- Top Performers ---
  const topPerformers: DashboardTopPerformer[] = []
  if (agents.length > 0 && submittedCurrent.length > 0) {
    // Count submissions per agent
    const submissionCountByUser = new Map<string, number>()
    const _primaryMetricByUser = new Map<string, number>()

    for (const entry of submittedCurrent) {
      submissionCountByUser.set(entry.user_id, (submissionCountByUser.get(entry.user_id) ?? 0) + 1)
    }

    // If we have primary metric values in the trend data, aggregate per user from entries
    if (primaryKpi) {
      // Use KPI values to approximate per-user values from submitted entries
      // For now, use submission count as a proxy for ranking
    }

    const deptName = departments.find((d) => d.department_id === selectedDepartmentId)?.name ?? ''

    const ranked = agents
      .map((agent) => ({
        user_id: agent.user_id,
        name: agent.name,
        department: deptName,
        submissions: submissionCountByUser.get(agent.user_id) ?? 0,
      }))
      .filter((a) => a.submissions > 0)
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 10)

    for (let i = 0; i < ranked.length; i++) {
      topPerformers.push({
        user_id: ranked[i].user_id,
        name: ranked[i].name,
        department: ranked[i].department,
        score: computeCompletionScore(ranked[i].submissions, range.paceElapsedUnits),
        primary_metric_value: null,
        rank: i + 1,
      })
    }
  }

  // --- Missing Entries ---
  const missingEntries: DashboardMissingEntry[] = []
  if (agents.length > 0) {
    const _todayKey = dateKeyUtc(new Date())
    const usersWithSubmissions = new Set(submittedCurrent.map((e) => e.user_id))
    const deptName = departments.find((d) => d.department_id === selectedDepartmentId)?.name ?? ''

    // Find last submission date for agents who haven't submitted in current period
    const agentsWithoutSubmissions = agents.filter((a) => !usersWithSubmissions.has(a.user_id))

    if (agentsWithoutSubmissions.length > 0) {
      const { data: lastSubmissions } = await context.admin
        .from('daily_reports')
        .select('user_id, report_date')
        .eq('organization_id', context.organizationId)
        .eq('department_id', selectedDepartmentId)
        .eq('status', 'submitted')
        .in(
          'user_id',
          agentsWithoutSubmissions.map((a) => a.user_id),
        )
        .order('report_date', { ascending: false })

      const lastDateByUser = new Map<string, string>()
      for (const row of (lastSubmissions ?? []) as Array<{ user_id: string; report_date: string }>) {
        if (!lastDateByUser.has(row.user_id)) {
          lastDateByUser.set(row.user_id, row.report_date)
        }
      }

      for (const agent of agentsWithoutSubmissions) {
        missingEntries.push({
          user_id: agent.user_id,
          name: agent.name,
          department: deptName,
          last_submission_date: lastDateByUser.get(agent.user_id) ?? null,
        })
      }
    }
  }

  // --- Recent Activity ---
  const recentActivity: DashboardActivityItem[] = []
  {
    const deptName = departments.find((d) => d.department_id === selectedDepartmentId)?.name ?? ''
    const agentNameById = new Map(agents.map((a) => [a.user_id, a.name]))

    // Use recent submitted entries as activity items
    const recentEntries = submittedCurrent
      .slice()
      .sort((a, b) => b.report_date.localeCompare(a.report_date))
      .slice(0, 20)

    for (const entry of recentEntries) {
      recentActivity.push({
        user_id: entry.user_id,
        name: agentNameById.get(entry.user_id) ?? 'Unknown',
        department: deptName,
        action: `Submitted daily log for ${entry.report_date}`,
        timestamp: entry.report_date,
      })
    }
  }

  // --- Forecast ---
  let forecast: DashboardForecast | null = null
  if (primaryKpi && range.paceElapsedUnits > 0 && range.paceTotalUnits > 0) {
    const currentValue = primaryKpi.current_value
    const dailyRate = currentValue / range.paceElapsedUnits
    const projectedValue = Number((dailyRate * range.paceTotalUnits).toFixed(2))

    // Find target for primary metric
    const primaryTarget = targetByMetricId.get(primaryKpi.id)
    const totalTarget = primaryTarget ? primaryTarget * range.paceTotalUnits : null

    forecast = {
      current_value: currentValue,
      projected_value: projectedValue,
      projected_achievement: totalTarget ? Number(((projectedValue / totalTarget) * 100).toFixed(1)) : null,
      target_value: totalTarget,
    }
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
    stats,
    trend,
    series,
    primaryMetricLabel,
    agencyScore,
    departmentScores,
    topPerformers,
    missingEntries,
    recentActivity,
    forecast,
  }

  return { success: true as const, data }
}
