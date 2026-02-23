'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { type MetricDataType } from '@/lib/metrics/data-types'

type LeaderboardPeriod = 'today' | 'current_week' | 'this_month' | 'custom'
type IncomingLeaderboardPeriod = LeaderboardPeriod | 'this_week'

type LeaderboardMetric = {
  metric_id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
}

type LeaderboardSortOption = LeaderboardMetric

type LeaderboardRow = {
  user_id: string
  name: string
  value: number
  met_count: number
  total_count: number
}

type DateRangeResult =
  | { ok: true; period: LeaderboardPeriod; startDate: string; endDate: string }
  | { ok: false; message: string }

const RANKING_METRIC_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']
const PERIOD_ALIASES: Record<IncomingLeaderboardPeriod, LeaderboardPeriod> = {
  today: 'today',
  current_week: 'current_week',
  this_week: 'current_week',
  this_month: 'this_month',
  custom: 'custom',
}
const DEPARTMENT_SCORE_OPTION: LeaderboardSortOption = {
  metric_id: 'department_score',
  name: 'Department Score',
  code: 'department_score',
  data_type: 'percent',
  unit: '%',
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

function resolveDateRange(
  rawPeriod?: IncomingLeaderboardPeriod | null,
  startDate?: string | null,
  endDate?: string | null,
): DateRangeResult {
  const period = PERIOD_ALIASES[rawPeriod ?? 'today'] ?? 'today'
  const now = new Date()

  if (period === 'custom') {
    if (!isDateKey(startDate) || !isDateKey(endDate)) {
      return { ok: false, message: 'Custom period requires start and end dates.' }
    }

    const customStart = startDate
    const customEnd = endDate

    if (customStart > customEnd) {
      return { ok: false, message: 'Custom start date must be before or equal to end date.' }
    }

    return {
      ok: true,
      period,
      startDate: customStart,
      endDate: customEnd,
    }
  }

  const todayKey = dateKeyUtc(now)

  if (period === 'today') {
    return {
      ok: true,
      period,
      startDate: todayKey,
      endDate: todayKey,
    }
  }

  if (period === 'current_week') {
    const day = now.getUTCDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    const monday = addUtcDays(now, -diffToMonday)
    return {
      ok: true,
      period,
      startDate: dateKeyUtc(monday),
      endDate: todayKey,
    }
  }

  return {
    ok: true,
    period,
    startDate: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`,
    endDate: todayKey,
  }
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
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || !profile?.role) {
    return { ok: false as const, message: 'Company profile not found.' }
  }

  return {
    ok: true as const,
    admin,
    companyId: profile.company_id as string,
    role: profile.role as Role,
  }
}

async function resolveDepartmentId(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  requestedDepartmentId?: string | null,
) {
  if (requestedDepartmentId) {
    const { data, error } = await admin
      .from('departments')
      .select('department_id')
      .eq('department_id', requestedDepartmentId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      return { ok: false as const, message: formatDatabaseError(error.message), departmentId: null as string | null }
    }

    if (data?.department_id) {
      return { ok: true as const, departmentId: data.department_id as string }
    }
  }

  const { data, error } = await admin
    .from('departments')
    .select('department_id')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message), departmentId: null as string | null }
  }

  return { ok: true as const, departmentId: (data?.department_id as string | undefined) ?? null }
}

type ScoreMetric = LeaderboardMetric & {
  direction: 'higher_is_better' | 'lower_is_better'
}

async function resolveScoreMetrics(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const { data: metricsData, error: metricsError } = await admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, direction')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .in('data_type', RANKING_METRIC_TYPES)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (metricsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(metricsError.message),
      metrics: [] as ScoreMetric[],
    }
  }

  const metrics = (metricsData ?? []) as Array<
    LeaderboardMetric & { direction: 'higher_is_better' | 'lower_is_better' }
  >
  if (metrics.length === 0) {
    return {
      ok: true as const,
      message: 'No numeric KPI available for leaderboard in this department.',
      metrics: [] as ScoreMetric[],
    }
  }

  return { ok: true as const, metrics }
}

export async function getLeaderboard(opts: {
  departmentId?: string | null
  metricId?: string | null
  period?: IncomingLeaderboardPeriod | null
  startDate?: string | null
  endDate?: string | null
  limit?: number
}) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false as const, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false as const, error: 'Insufficient permissions.', data: null }
  }

  const range = resolveDateRange(opts.period, opts.startDate, opts.endDate)
  if (!range.ok) {
    return { success: false as const, error: range.message, data: null }
  }

  const departmentResult = await resolveDepartmentId(context.admin, context.companyId, opts.departmentId)
  if (!departmentResult.ok) {
    return { success: false as const, error: departmentResult.message, data: null }
  }

  if (!departmentResult.departmentId) {
    return { success: false as const, error: 'No departments found.', data: null }
  }

  const scoreMetricsResult = await resolveScoreMetrics(
    context.admin,
    context.companyId,
    departmentResult.departmentId,
  )
  if (!scoreMetricsResult.ok) {
    return { success: false as const, error: scoreMetricsResult.message, data: null }
  }

  const scoreMetrics = scoreMetricsResult.metrics
  const sortOptions: LeaderboardSortOption[] = [
    DEPARTMENT_SCORE_OPTION,
    ...scoreMetrics.map((metric) => ({
      metric_id: metric.metric_id,
      name: metric.name,
      code: metric.code,
      data_type: metric.data_type,
      unit: metric.unit,
    })),
  ]

  const requestedMetricId = opts.metricId?.trim() || DEPARTMENT_SCORE_OPTION.metric_id
  const selectedMetric =
    sortOptions.find((option) => option.metric_id === requestedMetricId) ?? DEPARTMENT_SCORE_OPTION

  const scoreMetricIds = scoreMetrics.map((metric) => metric.metric_id)

  if (scoreMetrics.length === 0) {
    return {
      success: true as const,
      data: {
        leaderboard: [] as LeaderboardRow[],
        departmentId: departmentResult.departmentId,
        metricId: DEPARTMENT_SCORE_OPTION.metric_id,
        selectedMetric: DEPARTMENT_SCORE_OPTION,
        sortOptions: [DEPARTMENT_SCORE_OPTION],
        scoringMetricsCount: 0,
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
        message: scoreMetricsResult.message ?? 'No scoring metrics available for this department.',
      },
    }
  }

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const { data: entriesData, error: entriesError } = await context.admin
    .from('daily_entries')
    .select('entry_id, user_id')
    .eq('company_id', context.companyId)
    .eq('department_id', departmentResult.departmentId)
    .eq('status', 'submitted')
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.endDate)

  if (entriesError) {
    return { success: false as const, error: formatDatabaseError(entriesError.message), data: null }
  }

  const entries = (entriesData ?? []) as Array<{ entry_id: string; user_id: string }>
  const entryIds = entries.map((entry) => entry.entry_id)
  if (entryIds.length === 0) {
    return {
      success: true as const,
      data: {
        leaderboard: [] as LeaderboardRow[],
        departmentId: departmentResult.departmentId,
        metricId: selectedMetric.metric_id,
        selectedMetric,
        sortOptions,
        scoringMetricsCount: scoreMetrics.length,
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
      },
    }
  }

  const { data: valuesData, error: valuesError } = await context.admin
    .from('entry_values')
    .select('entry_id, metric_id, value_numeric, value_bool')
    .in('entry_id', entryIds)
    .in('metric_id', scoreMetricIds)

  if (valuesError) {
    return { success: false as const, error: formatDatabaseError(valuesError.message), data: null }
  }

  const metricById = new Map(scoreMetrics.map((metric) => [metric.metric_id, metric]))
  const valueByEntryMetric = new Map<string, number>()
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

    if (metric.data_type === 'boolean') {
      if (row.value_bool === null) {
        continue
      }
      valueByEntryMetric.set(`${row.entry_id}:${row.metric_id}`, row.value_bool ? 1 : 0)
      continue
    }

    if (row.value_numeric === null || row.value_numeric === undefined) {
      continue
    }
    valueByEntryMetric.set(`${row.entry_id}:${row.metric_id}`, Number(row.value_numeric))
  }

  const valueByUserMetric = new Map<string, Map<string, number>>()
  for (const entry of entries) {
    for (const metricId of scoreMetricIds) {
      const value = valueByEntryMetric.get(`${entry.entry_id}:${metricId}`)
      if (value === undefined) {
        continue
      }
      const currentByMetric = valueByUserMetric.get(entry.user_id) ?? new Map<string, number>()
      currentByMetric.set(metricId, (currentByMetric.get(metricId) ?? 0) + value)
      valueByUserMetric.set(entry.user_id, currentByMetric)
    }
  }

  if (valueByUserMetric.size === 0) {
    return {
      success: true as const,
      data: {
        leaderboard: [] as LeaderboardRow[],
        departmentId: departmentResult.departmentId,
        metricId: selectedMetric.metric_id,
        selectedMetric,
        sortOptions,
        scoringMetricsCount: scoreMetrics.length,
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
        message: 'No metric values found for this period.',
      },
    }
  }

  const rankedUserIds = Array.from(valueByUserMetric.keys())
  let profileNameByUserId = new Map<string, string>()

  if (rankedUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await context.admin
      .from('profiles')
      .select('user_id, name')
      .eq('company_id', context.companyId)
      .in('user_id', rankedUserIds)

    if (!profilesError && profilesData) {
      profileNameByUserId = new Map(
        (profilesData as Array<{ user_id: string; name: string }>).map((profile) => [
          profile.user_id,
          profile.name,
        ]),
      )
    }
  }

  const metricStats = new Map<string, { min: number; max: number }>()
  for (const metricId of scoreMetricIds) {
    const values: number[] = []
    for (const userId of rankedUserIds) {
      const userMetricValues = valueByUserMetric.get(userId)
      if (!userMetricValues) {
        continue
      }
      const metricValue = userMetricValues.get(metricId)
      if (metricValue === undefined) {
        continue
      }
      values.push(metricValue)
    }

    if (values.length === 0) {
      metricStats.set(metricId, { min: 0, max: 0 })
      continue
    }

    let min = values[0]
    let max = values[0]
    for (const item of values) {
      if (item < min) min = item
      if (item > max) max = item
    }
    metricStats.set(metricId, { min, max })
  }

  const baseRows = rankedUserIds
    .map((userId) => {
      const userMetricValues = valueByUserMetric.get(userId) ?? new Map<string, number>()
      let normalizedSum = 0
      let filledCount = 0

      for (const metricId of scoreMetricIds) {
        const metric = metricById.get(metricId)
        const stats = metricStats.get(metricId)
        if (!metric || !stats) {
          continue
        }

        const rawValue = userMetricValues.get(metricId)
        if (rawValue === undefined) {
          continue
        }

        filledCount += 1
        const span = stats.max - stats.min
        let normalized = 0

        if (span <= 0) {
          normalized = 1
        } else if (metric.direction === 'lower_is_better') {
          normalized = (stats.max - rawValue) / span
        } else {
          normalized = (rawValue - stats.min) / span
        }

        if (normalized < 0) normalized = 0
        if (normalized > 1) normalized = 1
        normalizedSum += normalized
      }

      return {
        user_id: userId,
        name: profileNameByUserId.get(userId) ?? userId,
        department_score: scoreMetricIds.length > 0 ? Number(((normalizedSum / scoreMetricIds.length) * 100).toFixed(2)) : 0,
        metric_values: userMetricValues,
        met_count: filledCount,
        total_count: scoreMetricIds.length,
      }
    })

  let leaderboard: LeaderboardRow[] = []
  let message: string | undefined

  if (selectedMetric.metric_id === DEPARTMENT_SCORE_OPTION.metric_id) {
    leaderboard = baseRows
      .map((row) => ({
        user_id: row.user_id,
        name: row.name,
        value: row.department_score,
        met_count: row.met_count,
        total_count: row.total_count,
      }))
      .sort((left, right) => {
        if (right.value !== left.value) {
          return right.value - left.value
        }
        if (right.met_count !== left.met_count) {
          return right.met_count - left.met_count
        }
        return left.name.localeCompare(right.name)
      })
      .slice(0, limit)
  } else {
    const sortMetric = metricById.get(selectedMetric.metric_id)
    const isLowerBetter = sortMetric?.direction === 'lower_is_better'

    leaderboard = baseRows
      .filter((row) => row.metric_values.has(selectedMetric.metric_id))
      .map((row) => ({
        user_id: row.user_id,
        name: row.name,
        value: Number(row.metric_values.get(selectedMetric.metric_id) ?? 0),
        met_count: row.met_count,
        total_count: row.total_count,
      }))
      .sort((left, right) => {
        if (right.value !== left.value) {
          return isLowerBetter ? left.value - right.value : right.value - left.value
        }
        if (right.met_count !== left.met_count) {
          return right.met_count - left.met_count
        }
        return left.name.localeCompare(right.name)
      })
      .slice(0, limit)

    if (leaderboard.length === 0) {
      message = `No data available for ${selectedMetric.name} in this period.`
    }
  }

  return {
    success: true as const,
    data: {
      leaderboard,
      departmentId: departmentResult.departmentId,
      metricId: selectedMetric.metric_id,
      selectedMetric,
      sortOptions,
      scoringMetricsCount: scoreMetrics.length,
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      message,
    },
  }
}
