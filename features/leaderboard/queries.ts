'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { type MetricDataType } from '@/lib/metrics/data-types'

type LeaderboardPeriod = 'today' | 'current_week' | 'this_month' | 'last_week' | 'last_month' | 'custom'
type IncomingLeaderboardPeriod = LeaderboardPeriod | 'this_week' | 'month'

type DateRangeResult =
  | {
    ok: true
    period: LeaderboardPeriod
    startDate: string
    endDate: string
    cutoffDate: string
  }
  | { ok: false; message: string }

type DepartmentOption = {
  department_id: string
  name: string
}

export type LeaderboardMetric = {
  metric_id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
  sort_order?: number | null
}

export type LeaderboardRow = {
  user_id: string
  name: string
  values: Record<string, number>
  filled_count: number
  total_count: number
}

export type LeaderboardData = {
  departments: DepartmentOption[]
  departmentId: string
  period: LeaderboardPeriod
  startDate: string
  endDate: string
  metrics: LeaderboardMetric[]
  sortOptions: LeaderboardMetric[]
  selectedMetricId: string
  leaderboard: LeaderboardRow[]
  message?: string
}

const RANKING_METRIC_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']
const PERIOD_ALIASES: Record<IncomingLeaderboardPeriod, LeaderboardPeriod> = {
  today: 'today',
  current_week: 'current_week',
  this_week: 'current_week',
  this_month: 'this_month',
  last_week: 'last_week',
  last_month: 'last_month',
  custom: 'custom',
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
  const today = dateKeyUtc(now)

  if (period === 'custom') {
    if (!isDateKey(startDate) || !isDateKey(endDate)) {
      return { ok: false, message: 'Custom period requires start and end dates.' }
    }

    if (startDate > endDate) {
      return { ok: false, message: 'Custom start date must be before or equal to end date.' }
    }

    return {
      ok: true,
      period,
      startDate,
      endDate,
      cutoffDate: today < startDate ? startDate : today > endDate ? endDate : today,
    }
  }

  if (period === 'today') {
    return {
      ok: true,
      period,
      startDate: today,
      endDate: today,
      cutoffDate: today,
    }
  }

  if (period === 'current_week') {
    const day = now.getUTCDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    const monday = addUtcDays(now, -diffToMonday)
    const sunday = addUtcDays(monday, 6)
    const start = dateKeyUtc(monday)
    const end = dateKeyUtc(sunday)
    return {
      ok: true,
      period,
      startDate: start,
      endDate: end,
      cutoffDate: today < start ? start : today > end ? end : today,
    }
  }

  if (period === 'last_week') {
    const day = now.getUTCDay()
    const diffToLastMonday = (day === 0 ? 6 : day - 1) + 7
    const lastMonday = addUtcDays(now, -diffToLastMonday)
    const lastSunday = addUtcDays(lastMonday, 6)
    const start = dateKeyUtc(lastMonday)
    const end = dateKeyUtc(lastSunday)
    return {
      ok: true,
      period,
      startDate: start,
      endDate: end,
      cutoffDate: end,
    }
  }

  if (period === 'last_month') {
    const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
    const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end = dateKeyUtc(new Date(Date.UTC(year, month + 1, 0)))
    return {
      ok: true,
      period,
      startDate: start,
      endDate: end,
      cutoffDate: end,
    }
  }

  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const end = dateKeyUtc(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)))
  return {
    ok: true,
    period,
    startDate: start,
    endDate: end,
    cutoffDate: today < start ? start : today > end ? end : today,
  }
}

function isMissingProfileNameColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('column profiles_1.name does not exist')
}

function isMissingMetricsSortOrderColumn(message: string) {
  return message.toLowerCase().includes('column metrics.sort_order does not exist')
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

async function getDepartmentMetrics(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const withSort = await admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, sort_order')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .in('data_type', RANKING_METRIC_TYPES)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  let metrics: LeaderboardMetric[] = []
  if (!withSort.error) {
    metrics = (withSort.data ?? []) as LeaderboardMetric[]
  } else if (isMissingMetricsSortOrderColumn(withSort.error.message)) {
    const fallback = await admin
      .from('metrics')
      .select('metric_id, name, code, data_type, unit')
      .eq('company_id', companyId)
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .in('data_type', RANKING_METRIC_TYPES)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (fallback.error) {
      return {
        ok: false as const,
        message: formatDatabaseError(fallback.error.message),
        metrics: [] as LeaderboardMetric[],
      }
    }

    metrics = (fallback.data ?? []) as LeaderboardMetric[]
  } else {
    return {
      ok: false as const,
      message: formatDatabaseError(withSort.error.message),
      metrics: [] as LeaderboardMetric[],
    }
  }

  if (metrics.length === 0) {
    return { ok: true as const, metrics: [] as LeaderboardMetric[] }
  }

  return {
    ok: true as const,
    metrics: metrics
      .slice()
      .sort((left, right) => {
        const leftPriority = left.sort_order ?? Number.MAX_SAFE_INTEGER
        const rightPriority = right.sort_order ?? Number.MAX_SAFE_INTEGER
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }
        return left.name.localeCompare(right.name)
      }),
  }
}

async function getActiveMembersForDepartment(
  admin: ReturnType<typeof createAdminClient>,
  departmentId: string,
) {
  const withName = await admin
    .from('department_members')
    .select('user_id, profiles!inner(name)')
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .is('deleted_at', null)

  let rows: Array<{ user_id: string; profiles?: { name?: string; full_name?: string } }> = []
  if (!withName.error) {
    rows = (withName.data as typeof rows) ?? []
  } else if (isMissingProfileNameColumn(withName.error.message)) {
    const fallback = await admin
      .from('department_members')
      .select('user_id, profiles!inner(full_name)')
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (fallback.error) {
      return {
        ok: false as const,
        message: formatDatabaseError(fallback.error.message),
        members: [] as Array<{ user_id: string; name: string }>,
      }
    }

    rows = (fallback.data as typeof rows) ?? []
  } else {
    return {
      ok: false as const,
      message: formatDatabaseError(withName.error.message),
      members: [] as Array<{ user_id: string; name: string }>,
    }
  }

  return {
    ok: true as const,
    members: rows.map((row) => ({
      user_id: row.user_id,
      name: row.profiles?.name || row.profiles?.full_name || 'Unknown',
    })),
  }
}

function parseMetricValue(
  dataType: MetricDataType,
  row: { value_numeric: number | null; value_bool: boolean | null },
) {
  if (dataType === 'boolean') {
    if (row.value_bool === null) {
      return null
    }
    return row.value_bool ? 1 : 0
  }

  if (row.value_numeric === null || row.value_numeric === undefined) {
    return null
  }

  return Number(row.value_numeric)
}

export async function getLeaderboard(opts: {
  departmentId?: string | null
  metricId?: string | null
  period?: IncomingLeaderboardPeriod | null
  startDate?: string | null
  endDate?: string | null
  limit?: number
}): Promise<
  | { success: true; data: LeaderboardData }
  | { success: false; error: string; data: null }
> {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'member')
  } catch {
    return { success: false, error: 'Insufficient permissions.', data: null }
  }

  const range = resolveDateRange(opts.period, opts.startDate, opts.endDate)
  if (!range.ok) {
    return { success: false, error: range.message, data: null }
  }

  const accessibleDepartments = await getAccessibleDepartments(
    context.admin,
    context.companyId,
    context.userId,
    context.role,
  )
  if (!accessibleDepartments.ok) {
    return { success: false, error: accessibleDepartments.message, data: null }
  }

  const departments = accessibleDepartments.departments
  if (departments.length === 0) {
    return {
      success: true,
      data: {
        departments: [],
        departmentId: '',
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
        metrics: [],
        sortOptions: [],
        selectedMetricId: '',
        leaderboard: [],
        message: 'No active departments available for your profile.',
      },
    }
  }

  const selectedDepartmentId =
    opts.departmentId && departments.some((department) => department.department_id === opts.departmentId)
      ? opts.departmentId
      : departments[0].department_id

  const metricsResult = await getDepartmentMetrics(context.admin, context.companyId, selectedDepartmentId)
  if (!metricsResult.ok) {
    return { success: false, error: metricsResult.message, data: null }
  }

  const metrics = metricsResult.metrics
  const selectedMetricId =
    opts.metricId && metrics.some((metric) => metric.metric_id === opts.metricId)
      ? opts.metricId
      : (metrics[0]?.metric_id ?? '')

  const activeMembersResult = await getActiveMembersForDepartment(context.admin, selectedDepartmentId)
  if (!activeMembersResult.ok) {
    return { success: false, error: activeMembersResult.message, data: null }
  }

  const members = activeMembersResult.members
  const memberById = new Map(members.map((member) => [member.user_id, member.name]))
  const metricById = new Map(metrics.map((metric) => [metric.metric_id, metric]))

  if (metrics.length === 0) {
    return {
      success: true,
      data: {
        departments,
        departmentId: selectedDepartmentId,
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
        metrics: [],
        sortOptions: [],
        selectedMetricId: '',
        leaderboard: members.map((member) => ({
          user_id: member.user_id,
          name: member.name,
          values: {},
          filled_count: 0,
          total_count: 0,
        })),
        message: 'No active leaderboard metrics found for this department.',
      },
    }
  }

  const { data: entriesData, error: entriesError } = await context.admin
    .from('daily_entries')
    .select('entry_id, user_id')
    .eq('company_id', context.companyId)
    .eq('department_id', selectedDepartmentId)
    .eq('status', 'submitted')
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.cutoffDate)

  if (entriesError) {
    return { success: false, error: formatDatabaseError(entriesError.message), data: null }
  }

  const entries = ((entriesData ?? []) as Array<{ entry_id: string; user_id: string }>).filter((entry) =>
    memberById.has(entry.user_id),
  )

  const metricIds = metrics.map((metric) => metric.metric_id)
  const valueByUserMetric = new Map<string, Map<string, number>>()
  const filledByUserMetric = new Map<string, Set<string>>()

  if (entries.length > 0 && metricIds.length > 0) {
    const entryIds = entries.map((entry) => entry.entry_id)
    const entryUserById = new Map(entries.map((entry) => [entry.entry_id, entry.user_id]))

    const { data: valuesData, error: valuesError } = await context.admin
      .from('entry_values')
      .select('entry_id, metric_id, value_numeric, value_bool')
      .in('entry_id', entryIds)
      .in('metric_id', metricIds)

    if (valuesError) {
      return { success: false, error: formatDatabaseError(valuesError.message), data: null }
    }

    for (const row of (valuesData ?? []) as Array<{
      entry_id: string
      metric_id: string
      value_numeric: number | null
      value_bool: boolean | null
    }>) {
      const userId = entryUserById.get(row.entry_id)
      const metric = metricById.get(row.metric_id)
      if (!userId || !metric) {
        continue
      }

      const parsed = parseMetricValue(metric.data_type, row)
      if (parsed === null) {
        continue
      }

      const currentMetricValues = valueByUserMetric.get(userId) ?? new Map<string, number>()
      currentMetricValues.set(row.metric_id, (currentMetricValues.get(row.metric_id) ?? 0) + parsed)
      valueByUserMetric.set(userId, currentMetricValues)

      const filledSet = filledByUserMetric.get(userId) ?? new Set<string>()
      filledSet.add(row.metric_id)
      filledByUserMetric.set(userId, filledSet)
    }
  }

  const allRows: LeaderboardRow[] = members.map((member) => {
    const valuesByMetric = valueByUserMetric.get(member.user_id) ?? new Map<string, number>()
    const values: Record<string, number> = {}

    for (const metric of metrics) {
      values[metric.metric_id] = Number((valuesByMetric.get(metric.metric_id) ?? 0).toFixed(2))
    }

    return {
      user_id: member.user_id,
      name: member.name,
      values,
      filled_count: filledByUserMetric.get(member.user_id)?.size ?? 0,
      total_count: metrics.length,
    }
  })

  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const leaderboard = allRows
    .slice()
    .sort((left, right) => {
      const leftValue = selectedMetricId ? left.values[selectedMetricId] ?? 0 : 0
      const rightValue = selectedMetricId ? right.values[selectedMetricId] ?? 0 : 0
      if (rightValue !== leftValue) {
        return rightValue - leftValue
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, limit)

  const hasAnyValues = leaderboard.some((row) =>
    metrics.some((metric) => (row.values[metric.metric_id] ?? 0) !== 0),
  )

  return {
    success: true,
    data: {
      departments,
      departmentId: selectedDepartmentId,
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      metrics,
      sortOptions: metrics,
      selectedMetricId,
      leaderboard,
      message: hasAnyValues ? undefined : 'No metric values found for this period.',
    },
  }
}
