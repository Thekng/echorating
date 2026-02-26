'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { departmentFilterSchema } from './schemas'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { requireRole } from '@/lib/rbac/guards'
import { type MetricDataType, type MetricSettings } from '@/lib/metrics/data-types'

type DepartmentPeriod = 'today' | 'current_week' | 'this_week' | 'this_month' | 'custom'
type IncomingDepartmentPeriod = DepartmentPeriod | 'this_week'

type DateRangeResult =
  | { ok: true; period: DepartmentPeriod; startDate: string; endDate: string }
  | { ok: false; message: string }

type DepartmentMetricData = {
  metric_id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
  settings: MetricSettings | null
}

type DepartmentAggregateStats = {
  total_members: number
  submitted_count: number
  draft_count: number
  completion_rate: number
  last_entry_date: string | null
  department_score: number | null
}

const RANKING_METRIC_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']
const PERIOD_ALIASES: Record<IncomingDepartmentPeriod, DepartmentPeriod> = {
  today: 'today',
  current_week: 'current_week',
  this_week: 'current_week',
  this_month: 'this_month',
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
  rawPeriod?: IncomingDepartmentPeriod | null,
  startDate?: string | null,
  endDate?: string | null,
): DateRangeResult {
  const period = PERIOD_ALIASES[rawPeriod ?? 'today'] ?? 'today'
  const now = new Date()

  if (period === 'custom') {
    if (!isDateKey(startDate) || !isDateKey(endDate)) {
      return { ok: false, message: 'Custom period requires start and end dates.' }
    }

    const start = new Date(`${startDate}T00:00:00Z`)
    const end = new Date(`${endDate}T23:59:59Z`)
    if (start > end) {
      return { ok: false, message: 'Start date must be before end date.' }
    }

    return {
      ok: true,
      period,
      startDate,
      endDate,
    }
  }

  if (period === 'today') {
    const key = dateKeyUtc(now)
    return { ok: true, period, startDate: key, endDate: key }
  }

  if (period === 'current_week') {
    const copy = new Date(now)
    const dayOfWeek = copy.getUTCDay()
    const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    copy.setUTCDate(copy.getUTCDate() + offset)
    const monday = dateKeyUtc(copy)
    const sunday = dateKeyUtc(addUtcDays(copy, 6))
    return { ok: true, period, startDate: monday, endDate: sunday }
  }

  if (period === 'this_month') {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEndDate = new Date(Date.UTC(year, month, 0))
    const monthEnd = dateKeyUtc(monthEndDate)
    return { ok: true, period, startDate: monthStart, endDate: monthEnd }
  }

  return { ok: false, message: 'Invalid period.' }
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0
  }
  return Number(((numerator / denominator) * 100).toFixed(1))
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

  if (!profile?.company_id) {
    return { ok: false as const, message: 'Company profile not found.' }
  }

  return {
    ok: true as const,
    admin,
    companyId: profile.company_id as string,
    role: profile?.role ?? null,
  }
}

export async function listDepartments(rawFilters?: {
  q?: string
  status?: string
  type?: string
}) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: [], count: 0 }
  }

  const parsedFilters = departmentFilterSchema.safeParse({
    q: rawFilters?.q,
    status: rawFilters?.status,
    type: rawFilters?.type,
  })

  if (!parsedFilters.success) {
    return { success: false, error: 'Invalid filters.', data: [], count: 0 }
  }

  const filters = parsedFilters.data

  let query = context.admin
    .from('departments')
    .select('department_id, name, type, is_active, created_at, updated_at', { count: 'exact' })
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters.q?.trim()) {
    query = query.ilike('name', `%${filters.q.trim()}%`)
  }

  if (filters.status !== 'all') {
    query = query.eq('is_active', filters.status === 'active')
  }

  if (filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }

  const { data, error: listError, count } = await query

  if (listError) {
    return { success: false, error: formatDatabaseError(listError.message), data: [], count: 0 }
  }

  return { success: true, data: data ?? [], count: count ?? 0, filters }
}

export async function getDepartmentById(id: string) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  const { data, error: queryError } = await context.admin
    .from('departments')
    .select('department_id, name, type, is_active, created_at, updated_at')
    .eq('department_id', id)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (queryError) {
    return { success: false, error: formatDatabaseError(queryError.message), data: null }
  }

  return { success: true, data }
}

/**
 * Get aggregated statistics for a department across all members
 * Includes: total members, submitted/draft counts, completion rate, department score
 */
export async function getDepartmentAggregateStats(
  departmentId: string,
  rawPeriod?: IncomingDepartmentPeriod | null,
  customStartDate?: string | null,
  customEndDate?: string | null,
): Promise<{
  success: boolean
  error?: string
  data?: DepartmentAggregateStats & { period: DepartmentPeriod; startDate: string; endDate: string }
}> {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message }
  }
  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.' }
  }

  const range = resolveDateRange(rawPeriod, customStartDate, customEndDate)
  if (!range.ok) {
    return { success: false, error: range.message }
  }

  // Get all active members in the department
  const { data: membersData, error: membersError } = await context.admin
    .from('department_members')
    .select('user_id')
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (membersError) {
    return { success: false, error: formatDatabaseError(membersError.message) }
  }

  const memberIds = (membersData ?? []).map((m) => m.user_id)
  const totalMembers = memberIds.length

  if (memberIds.length === 0) {
    return {
      success: true,
      data: {
        total_members: 0,
        submitted_count: 0,
        draft_count: 0,
        completion_rate: 0,
        last_entry_date: null,
        department_score: null,
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
      },
    }
  }

  // Get entries for all members in the department
  const { data: entriesData, error: entriesError } = await context.admin
    .from('daily_entries')
    .select('entry_id, entry_date, status, user_id')
    .eq('company_id', context.companyId)
    .eq('department_id', departmentId)
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.endDate)
    .in('user_id', memberIds)

  if (entriesError) {
    return { success: false, error: formatDatabaseError(entriesError.message) }
  }

  const entries = (entriesData ?? []) as Array<{
    entry_id: string
    entry_date: string
    status: 'draft' | 'submitted'
    user_id: string
  }>

  const submittedCount = entries.filter((e) => e.status === 'submitted').length
  const draftCount = entries.filter((e) => e.status === 'draft').length

  const submittedDays = new Set(entries.filter((e) => e.status === 'submitted').map((e) => e.entry_date))
  const periodDays = Math.floor((new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / 86400000) + 1
  const completionRate = toPercent(submittedDays.size, periodDays)

  const lastEntry = entries.sort((a, b) => (b.entry_date > a.entry_date ? 1 : -1))[0]
  const lastEntryDate = lastEntry?.entry_date ?? null

  // Calculate department score (average of all member scores)
  const scoreMetricsResult = await getScoreMetricsForDepartment(context.admin, context.companyId, departmentId)
  let departmentScore: number | null = null

  if (scoreMetricsResult.ok && scoreMetricsResult.metrics.length > 0) {
    const scores = await calculateDepartmentMemberScores(
      context.admin,
      context.companyId,
      departmentId,
      range.startDate,
      range.endDate,
      scoreMetricsResult.metrics,
      memberIds,
    )

    if (scores.length > 0) {
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
      departmentScore = Number(avgScore.toFixed(1))
    }
  }

  return {
    success: true,
    data: {
      total_members: totalMembers,
      submitted_count: submittedCount,
      draft_count: draftCount,
      completion_rate: completionRate,
      last_entry_date: lastEntryDate,
      department_score: departmentScore,
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
    },
  }
}

/**
 * Get metrics defined for a department
 */
async function getScoreMetricsForDepartment(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const { data, error } = await admin
    .from('metrics')
    .select('metric_id, data_type')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .in('data_type', RANKING_METRIC_TYPES)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) {
    return {
      ok: false as const,
      message: formatDatabaseError(error.message),
      metrics: [] as Array<{ metric_id: string; data_type: MetricDataType }>,
    }
  }

  return {
    ok: true as const,
    metrics: (data ?? []) as Array<{ metric_id: string; data_type: MetricDataType }>,
  }
}

/**
 * Calculate scores for each member in a department
 */
async function calculateDepartmentMemberScores(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  startDate: string,
  endDate: string,
  scoreMetrics: Array<{ metric_id: string; data_type: MetricDataType }>,
  memberIds: string[],
) {
  if (scoreMetrics.length === 0 || memberIds.length === 0) {
    return []
  }

  const metricIds = scoreMetrics.map((m) => m.metric_id)

  // Get all entries for members
  const { data: entriesData, error: entriesError } = await admin
    .from('daily_entries')
    .select('entry_id, user_id')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('status', 'submitted')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .in('user_id', memberIds)

  if (entriesError || !entriesData || entriesData.length === 0) {
    return []
  }

  const entries = entriesData as Array<{ entry_id: string; user_id: string }>
  const entryIds = entries.map((e) => e.entry_id)

  // Get metric values
  const { data: valuesData, error: valuesError } = await admin
    .from('entry_values')
    .select('entry_id, metric_id, value_numeric, value_bool')
    .in('entry_id', entryIds)
    .in('metric_id', metricIds)

  if (valuesError || !valuesData) {
    return []
  }

  const values = valuesData as Array<{
    entry_id: string
    metric_id: string
    value_numeric: number | null
    value_bool: boolean | null
  }>

  // Calculate score per member
  const scoresByUserId = new Map<string, number[]>()

  for (const entry of entries) {
    const userId = entry.user_id
    if (!scoresByUserId.has(userId)) {
      scoresByUserId.set(userId, [])
    }

    for (const metric of scoreMetrics) {
      const value = values.find((v) => v.entry_id === entry.entry_id && v.metric_id === metric.metric_id)
      if (!value) continue

      const comparable =
        metric.data_type === 'boolean' ? (value.value_bool ? 1 : 0) : value.value_numeric ?? 0

      scoresByUserId.get(userId)!.push(comparable)
    }
  }

  // Calculate average score per member
  const scores: number[] = []
  for (const userScores of scoresByUserId.values()) {
    if (userScores.length > 0) {
      const avg = userScores.reduce((a, b) => a + b, 0) / userScores.length
      scores.push(avg)
    }
  }

  return scores
}

/**
 * Get full department profile data including all member data aggregated
 */
export async function getDepartmentProfile(
  departmentId: string,
  rawPeriod?: IncomingDepartmentPeriod | null,
  customStartDate?: string | null,
  customEndDate?: string | null,
) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false as const, error: context.message, data: null }
  }
  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false as const, error: 'Insufficient permissions.', data: null }
  }

  const range = resolveDateRange(rawPeriod, customStartDate, customEndDate)
  if (!range.ok) {
    return { success: false as const, error: range.message, data: null }
  }

  // Get department basic info
  const { data: deptData, error: deptError } = await context.admin
    .from('departments')
    .select('department_id, name, type, is_active')
    .eq('department_id', departmentId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (deptError || !deptData) {
    return { success: false as const, error: 'Department not found.', data: null }
  }

  // Get members
  const { data: membersData, error: membersError } = await context.admin
    .from('department_members')
    .select('user_id, member_role, is_active')
    .eq('department_id', departmentId)
    .eq('is_active', true)

  if (membersError) {
    return { success: false as const, error: formatDatabaseError(membersError.message), data: null }
  }

  const memberIds = (membersData ?? []).map((m) => m.user_id)

  // Get metrics for this department
  const { data: metricsData, error: metricsError } = await context.admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, settings')
    .eq('company_id', context.companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)

  if (metricsError) {
    return { success: false as const, error: formatDatabaseError(metricsError.message), data: null }
  }

  const metrics = (metricsData ?? []) as DepartmentMetricData[]

  // Get all entries for all members
  const { data: entriesData, error: entriesError } = await context.admin
    .from('daily_entries')
    .select('entry_id, entry_date, status, user_id, notes')
    .eq('company_id', context.companyId)
    .eq('department_id', departmentId)
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.endDate)
    .in('user_id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])
    .order('entry_date', { ascending: false })

  if (entriesError) {
    return { success: false as const, error: formatDatabaseError(entriesError.message), data: null }
  }

  const allEntries = (entriesData ?? []) as Array<{
    entry_id: string
    entry_date: string
    status: 'draft' | 'submitted'
    user_id: string
    notes: string | null
  }>

  // Get metric values for recent entries (last 20 submitted)
  const recentEntries = allEntries.filter((e) => e.status === 'submitted').slice(0, 20)
  const recentEntryIds = recentEntries.map((e) => e.entry_id)

  let recentValues: Array<{
    entry_id: string
    metric_id: string
    value_numeric: number | null
    value_text: string | null
    value_bool: boolean | null
  }> = []

  if (recentEntryIds.length > 0) {
    const { data: valuesData, error: valuesError } = await context.admin
      .from('entry_values')
      .select('entry_id, metric_id, value_numeric, value_text, value_bool')
      .in('entry_id', recentEntryIds)

    if (!valuesError && valuesData) {
      recentValues = valuesData as typeof recentValues
    }
  }

  // Aggregate completion stats
  const submittedCount = allEntries.filter((e) => e.status === 'submitted').length
  const draftCount = allEntries.filter((e) => e.status === 'draft').length
  const submittedDates = new Set(allEntries.filter((e) => e.status === 'submitted').map((e) => e.entry_date))
  const periodDays = Math.floor((new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / 86400000) + 1
  const completionRate = toPercent(submittedDates.size, periodDays)

  return {
    success: true as const,
    data: {
      department: deptData,
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      members_count: memberIds.length,
      stats: {
        submitted_count: submittedCount,
        draft_count: draftCount,
        completion_rate: completionRate,
        last_entry_date: allEntries[0]?.entry_date ?? null,
      },
      metrics,
      recent_entries: recentEntries.map((entry) => ({
        entry_id: entry.entry_id,
        entry_date: entry.entry_date,
        user_id: entry.user_id,
        status: entry.status,
        notes: entry.notes,
        metric_values: metrics.map((metric) => {
          const value = recentValues.find((v) => v.entry_id === entry.entry_id && v.metric_id === metric.metric_id)
          return {
            metric_id: metric.metric_id,
            value_numeric: value?.value_numeric ?? null,
            value_text: value?.value_text ?? null,
            value_bool: value?.value_bool ?? null,
          }
        }),
      })),
    },
  }
}

/**
 * Get aggregated metric values per agent in a department for a time period
 * Returns sum of each metric value for each agent (filtered by user_ids if provided)
 */
export async function getDepartmentAgentMetrics(
  departmentId: string,
  userIds: string[],
  startDate: string,
  endDate: string,
) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.', data: null }
  }

  if (!userIds || userIds.length === 0) {
    return { success: true, data: {} }
  }

  // Fetch all entry_values for the specified users, department, and date range
  const { data: valuesData, error: valuesError } = await context.admin
    .from('entry_values')
    .select('user_id, metric_id, value_numeric')
    .eq('department_id', departmentId)
    .in('user_id', userIds)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)

  if (valuesError) {
    return { success: false, error: formatDatabaseError(valuesError.message), data: null }
  }

  const values = (valuesData ?? []) as Array<{
    user_id: string
    metric_id: string
    value_numeric: number | null
  }>

  // Aggregate values: map[user_id][metric_id] = sum of values
  const aggregated: Record<string, Record<string, number>> = {}

  for (const value of values) {
    if (value.value_numeric === null) {
      continue
    }

    if (!aggregated[value.user_id]) {
      aggregated[value.user_id] = {}
    }

    if (!aggregated[value.user_id][value.metric_id]) {
      aggregated[value.user_id][value.metric_id] = 0
    }

    aggregated[value.user_id][value.metric_id] += value.value_numeric
  }

  return { success: true, data: aggregated }
}
