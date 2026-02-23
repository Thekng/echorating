'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { type MetricDataType, type MetricSettings } from '@/lib/metrics/data-types'

type AgentsPeriod = 'today' | 'current_week' | 'this_month' | 'custom'
type IncomingAgentsPeriod = AgentsPeriod | 'this_week'

type DateRangeResult =
  | { ok: true; period: AgentsPeriod; startDate: string; endDate: string }
  | { ok: false; message: string }

type DepartmentOption = {
  department_id: string
  name: string
}

type ProfileRow = {
  user_id: string
  name: string
  role: Role
  is_active: boolean
}

type MembershipRow = {
  user_id: string
  department_id: string
  member_role: 'lead' | 'member'
  is_active: boolean
}

type EntryRow = {
  entry_id: string
  user_id: string
  entry_date: string
  status: 'draft' | 'submitted'
  department_id: string
}

type RecentAgentEntry = {
  entry_id: string
  entry_date: string
  status: 'draft' | 'submitted'
  notes: string | null
  metric_values: Array<{
    metric_id: string
    value_numeric: number | null
    value_text: string | null
    value_bool: boolean | null
  }>
}

type ScoreMetric = {
  metric_id: string
  data_type: MetricDataType
  direction: 'higher_is_better' | 'lower_is_better'
}

type DepartmentMetric = {
  metric_id: string
  name: string
  code: string
  data_type: MetricDataType
  unit: string
  direction: 'higher_is_better' | 'lower_is_better'
  settings: MetricSettings | null
}

type AgentMetricKpi = DepartmentMetric & {
  current_value: number
  target_value: number | null
}

type CalendarDayStatus = 'on_track' | 'off_track' | 'no_data'

type AgentCalendarDay = {
  date: string
  day: number
  status: CalendarDayStatus
  met_targets_count: number
  total_targets_count: number
}

type ScoreResult = {
  scoreByUserId: Map<string, number>
  rankByUserId: Map<string, number>
  scoringMetricsCount: number
}

type AgentStats = {
  submittedCount: number
  draftCount: number
  submittedDays: Set<string>
  lastEntryDate: string | null
}

type ViewerContext =
  | { ok: false; message: string }
  | {
      ok: true
      admin: ReturnType<typeof createAdminClient>
      userId: string
      companyId: string
      role: Role
    }

const RANKING_METRIC_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']
const PERIOD_ALIASES: Record<IncomingAgentsPeriod, AgentsPeriod> = {
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
  rawPeriod?: IncomingAgentsPeriod | null,
  startDate?: string | null,
  endDate?: string | null,
): DateRangeResult {
  const period = PERIOD_ALIASES[rawPeriod ?? 'today'] ?? 'today'
  const now = new Date()

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

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 1
  }
  return Math.floor((end - start) / 86400000) + 1
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0
  }
  return Number(((numerator / denominator) * 100).toFixed(1))
}

function toStatsMap(entries: EntryRow[]) {
  const map = new Map<string, AgentStats>()

  for (const entry of entries) {
    const current = map.get(entry.user_id) ?? {
      submittedCount: 0,
      draftCount: 0,
      submittedDays: new Set<string>(),
      lastEntryDate: null,
    }

    if (entry.status === 'submitted') {
      current.submittedCount += 1
      current.submittedDays.add(entry.entry_date)
    } else {
      current.draftCount += 1
    }

    if (!current.lastEntryDate || entry.entry_date > current.lastEntryDate) {
      current.lastEntryDate = entry.entry_date
    }

    map.set(entry.user_id, current)
  }

  return map
}

async function getViewerContext(): Promise<ViewerContext> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.' }
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, message: 'Authentication required.' }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError) {
    return { ok: false, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || !profile.role) {
    return { ok: false, message: 'Active company profile not found.' }
  }

  return {
    ok: true,
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
      return { ok: false as const, message: formatDatabaseError(error.message), departments: [] as DepartmentOption[] }
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
    return { ok: false as const, message: formatDatabaseError(membershipsError.message), departments: [] as DepartmentOption[] }
  }

  const departmentIds = (memberships ?? []).map((item) => item.department_id as string)
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
    return { ok: false as const, message: formatDatabaseError(error.message), departments: [] as DepartmentOption[] }
  }

  return { ok: true as const, departments: (data ?? []) as DepartmentOption[] }
}

async function resolveScoreMetrics(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const { data, error } = await admin
    .from('metrics')
    .select('metric_id, data_type, direction')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .in('data_type', RANKING_METRIC_TYPES)
    .is('deleted_at', null)

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message), metrics: [] as ScoreMetric[] }
  }

  return { ok: true as const, metrics: (data ?? []) as ScoreMetric[] }
}

function isMissingMetricsSettingsColumn(message: string) {
  return message.toLowerCase().includes('column metrics.settings does not exist')
}

async function resolveDepartmentMetrics(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const withSettings = await admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, direction, settings')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (!withSettings.error) {
    return { ok: true as const, metrics: (withSettings.data ?? []) as DepartmentMetric[] }
  }

  if (!isMissingMetricsSettingsColumn(withSettings.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(withSettings.error.message),
      metrics: [] as DepartmentMetric[],
    }
  }

  const fallback = await admin
    .from('metrics')
    .select('metric_id, name, code, data_type, unit, direction')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (fallback.error) {
    return {
      ok: false as const,
      message: formatDatabaseError(fallback.error.message),
      metrics: [] as DepartmentMetric[],
    }
  }

  return {
    ok: true as const,
    metrics: ((fallback.data ?? []) as Array<Omit<DepartmentMetric, 'settings'>>).map((metric) => ({
      ...metric,
      settings: null,
    })),
  }
}

function parseComparableMetricValue(
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

function monthBounds(dateKey: string) {
  const [yearRaw, monthRaw] = dateKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const monthStart = `${yearRaw}-${monthRaw}-01`
  const monthEndDate = new Date(Date.UTC(year, month, 0))
  const monthEnd = dateKeyUtc(monthEndDate)
  return { monthStart, monthEnd }
}

async function computeDepartmentScores(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  startDate: string,
  endDate: string,
  scopedUserIds?: string[],
): Promise<ScoreResult> {
  const metricsResult = await resolveScoreMetrics(admin, companyId, departmentId)
  if (!metricsResult.ok || metricsResult.metrics.length === 0) {
    return {
      scoreByUserId: new Map<string, number>(),
      rankByUserId: new Map<string, number>(),
      scoringMetricsCount: 0,
    }
  }

  const scoreMetrics = metricsResult.metrics
  const scoreMetricIds = scoreMetrics.map((metric) => metric.metric_id)
  const metricById = new Map(scoreMetrics.map((metric) => [metric.metric_id, metric]))

  let entriesQuery = admin
    .from('daily_entries')
    .select('entry_id, user_id')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('status', 'submitted')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)

  if (scopedUserIds && scopedUserIds.length > 0) {
    entriesQuery = entriesQuery.in('user_id', scopedUserIds)
  }

  if (scopedUserIds && scopedUserIds.length === 0) {
    return {
      scoreByUserId: new Map<string, number>(),
      rankByUserId: new Map<string, number>(),
      scoringMetricsCount: scoreMetrics.length,
    }
  }

  const { data: entriesData, error: entriesError } = await entriesQuery

  if (entriesError) {
    return {
      scoreByUserId: new Map<string, number>(),
      rankByUserId: new Map<string, number>(),
      scoringMetricsCount: scoreMetrics.length,
    }
  }

  const entries = (entriesData ?? []) as Array<{ entry_id: string; user_id: string }>
  if (entries.length === 0) {
    return {
      scoreByUserId: new Map<string, number>(),
      rankByUserId: new Map<string, number>(),
      scoringMetricsCount: scoreMetrics.length,
    }
  }

  const entryIds = entries.map((entry) => entry.entry_id)
  const { data: valuesData, error: valuesError } = await admin
    .from('entry_values')
    .select('entry_id, metric_id, value_numeric, value_bool')
    .in('entry_id', entryIds)
    .in('metric_id', scoreMetricIds)

  if (valuesError) {
    return {
      scoreByUserId: new Map<string, number>(),
      rankByUserId: new Map<string, number>(),
      scoringMetricsCount: scoreMetrics.length,
    }
  }

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
      scoreByUserId: new Map<string, number>(),
      rankByUserId: new Map<string, number>(),
      scoringMetricsCount: scoreMetrics.length,
    }
  }

  const rankedUserIds = Array.from(valueByUserMetric.keys())

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
    for (const value of values) {
      if (value < min) min = value
      if (value > max) max = value
    }
    metricStats.set(metricId, { min, max })
  }

  const scoreByUserId = new Map<string, number>()
  for (const userId of rankedUserIds) {
    const userMetricValues = valueByUserMetric.get(userId) ?? new Map<string, number>()
    let normalizedSum = 0

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

    const score = scoreMetricIds.length > 0 ? Number(((normalizedSum / scoreMetricIds.length) * 100).toFixed(1)) : 0
    scoreByUserId.set(userId, score)
  }

  const rankByUserId = new Map<string, number>()
  const ranked = Array.from(scoreByUserId.entries())
    .sort((left, right) => right[1] - left[1])
    .map((item) => item[0])
  ranked.forEach((userId, index) => rankByUserId.set(userId, index + 1))

  return {
    scoreByUserId,
    rankByUserId,
    scoringMetricsCount: scoreMetrics.length,
  }
}

function normalizeDepartmentFilter(requestedDepartmentId: string | null | undefined, departments: DepartmentOption[]) {
  if (requestedDepartmentId === 'all') {
    return 'all'
  }

  if (requestedDepartmentId && departments.some((department) => department.department_id === requestedDepartmentId)) {
    return requestedDepartmentId
  }

  return 'all'
}

function normalizeProfileDepartmentFilter(
  requestedDepartmentId: string | null | undefined,
  departments: DepartmentOption[],
) {
  if (requestedDepartmentId && departments.some((department) => department.department_id === requestedDepartmentId)) {
    return requestedDepartmentId
  }

  return departments[0]?.department_id ?? ''
}

function normalizeStatusFilter(status: string | null | undefined) {
  if (status === 'inactive') {
    return 'inactive' as const
  }
  if (status === 'all') {
    return 'all' as const
  }
  return 'active' as const
}

export async function getAgentsList(filters?: {
  departmentId?: string | null
  period?: IncomingAgentsPeriod | null
  startDate?: string | null
  endDate?: string | null
  q?: string | null
  status?: string | null
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
  const selectedDepartmentId = normalizeDepartmentFilter(filters?.departmentId, departments)
  const status = normalizeStatusFilter(filters?.status)
  const query = filters?.q?.trim() ?? ''

  let profilesQuery = context.admin
    .from('profiles')
    .select('user_id, name, role, is_active')
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (context.role === 'member') {
    profilesQuery = profilesQuery.eq('user_id', context.userId)
  }

  if (status !== 'all') {
    profilesQuery = profilesQuery.eq('is_active', status === 'active')
  }

  if (query) {
    profilesQuery = profilesQuery.ilike('name', `%${query}%`)
  }

  const { data: profilesData, error: profilesError } = await profilesQuery
  if (profilesError) {
    return { success: false as const, error: formatDatabaseError(profilesError.message), data: null }
  }

  let profiles = (profilesData ?? []) as ProfileRow[]

  if (profiles.length === 0) {
    return {
      success: true as const,
      data: {
        viewerRole: context.role,
        departments,
        selectedDepartmentId,
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
        q: query,
        status,
        scoringMetricsCount: 0,
        rows: [] as Array<{
          user_id: string
          name: string
          role: Role
          is_active: boolean
          departments: string[]
          submitted_count: number
          draft_count: number
          completion_rate: number
          department_score: number | null
          last_entry_date: string | null
        }>,
      },
    }
  }

  const userIds = profiles.map((profile) => profile.user_id)
  let membershipsQuery = context.admin
    .from('department_members')
    .select('user_id, department_id, member_role, is_active')
    .in('user_id', userIds)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (selectedDepartmentId !== 'all') {
    membershipsQuery = membershipsQuery.eq('department_id', selectedDepartmentId)
  }

  const { data: membershipsData, error: membershipsError } = await membershipsQuery
  if (membershipsError) {
    return { success: false as const, error: formatDatabaseError(membershipsError.message), data: null }
  }

  const memberships = (membershipsData ?? []) as MembershipRow[]
  if (selectedDepartmentId !== 'all') {
    const allowedIds = new Set(memberships.map((membership) => membership.user_id))
    profiles = profiles.filter((profile) => allowedIds.has(profile.user_id))
  }

  if (profiles.length === 0) {
    return {
      success: true as const,
      data: {
        viewerRole: context.role,
        departments,
        selectedDepartmentId,
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate,
        q: query,
        status,
        scoringMetricsCount: 0,
        rows: [] as Array<{
          user_id: string
          name: string
          role: Role
          is_active: boolean
          departments: string[]
          submitted_count: number
          draft_count: number
          completion_rate: number
          department_score: number | null
          last_entry_date: string | null
        }>,
      },
    }
  }

  const departmentNameById = new Map(departments.map((department) => [department.department_id, department.name]))
  const membershipsByUserId = new Map<string, MembershipRow[]>()
  for (const membership of memberships) {
    const current = membershipsByUserId.get(membership.user_id) ?? []
    current.push(membership)
    membershipsByUserId.set(membership.user_id, current)
  }

  const filteredUserIds = profiles.map((profile) => profile.user_id)
  let entriesQuery = context.admin
    .from('daily_entries')
    .select('entry_id, user_id, entry_date, status, department_id')
    .eq('company_id', context.companyId)
    .in('user_id', filteredUserIds)
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.endDate)

  if (selectedDepartmentId !== 'all') {
    entriesQuery = entriesQuery.eq('department_id', selectedDepartmentId)
  }

  const { data: entriesData, error: entriesError } = await entriesQuery
  if (entriesError) {
    return { success: false as const, error: formatDatabaseError(entriesError.message), data: null }
  }

  const entries = (entriesData ?? []) as EntryRow[]
  const statsByUserId = toStatsMap(entries)
  const periodDays = diffDaysInclusive(range.startDate, range.endDate)

  let scoringMetricsCount = 0
  let scoreByUserId = new Map<string, number>()
  if (selectedDepartmentId !== 'all') {
    const scoreResult = await computeDepartmentScores(
      context.admin,
      context.companyId,
      selectedDepartmentId,
      range.startDate,
      range.endDate,
      filteredUserIds,
    )
    scoringMetricsCount = scoreResult.scoringMetricsCount
    scoreByUserId = scoreResult.scoreByUserId
  }

  const rows = profiles
    .map((profile) => {
      const stats = statsByUserId.get(profile.user_id)
      const profileMemberships = membershipsByUserId.get(profile.user_id) ?? []
      const departmentNames = profileMemberships
        .map((membership) => departmentNameById.get(membership.department_id))
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b))

      return {
        user_id: profile.user_id,
        name: profile.name,
        role: profile.role,
        is_active: profile.is_active,
        departments: departmentNames,
        submitted_count: stats?.submittedCount ?? 0,
        draft_count: stats?.draftCount ?? 0,
        completion_rate: toPercent(stats?.submittedDays.size ?? 0, periodDays),
        department_score: scoreByUserId.get(profile.user_id) ?? null,
        last_entry_date: stats?.lastEntryDate ?? null,
      }
    })
    .sort((left, right) => {
      if (selectedDepartmentId !== 'all') {
        const leftScore = left.department_score ?? -1
        const rightScore = right.department_score ?? -1
        if (rightScore !== leftScore) {
          return rightScore - leftScore
        }
      }

      if (right.submitted_count !== left.submitted_count) {
        return right.submitted_count - left.submitted_count
      }

      if (right.completion_rate !== left.completion_rate) {
        return right.completion_rate - left.completion_rate
      }

      return left.name.localeCompare(right.name)
    })

  return {
    success: true as const,
    data: {
      viewerRole: context.role,
      departments,
      selectedDepartmentId,
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      q: query,
      status,
      scoringMetricsCount,
      rows,
    },
  }
}

export async function getAgentProfile(
  userId: string,
  filters?: {
    departmentId?: string | null
    period?: IncomingAgentsPeriod | null
    startDate?: string | null
    endDate?: string | null
  },
) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false as const, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'member')
  } catch {
    return { success: false as const, error: 'Insufficient permissions.', data: null }
  }

  if (context.role === 'member' && context.userId !== userId) {
    return { success: false as const, error: 'Insufficient permissions.', data: null }
  }

  const range = resolveDateRange(filters?.period, filters?.startDate, filters?.endDate)
  if (!range.ok) {
    return { success: false as const, error: range.message, data: null }
  }

  const { data: profileData, error: profileError } = await context.admin
    .from('profiles')
    .select('user_id, name, role, is_active')
    .eq('company_id', context.companyId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError) {
    return { success: false as const, error: formatDatabaseError(profileError.message), data: null }
  }

  if (!profileData) {
    return { success: false as const, error: 'Agent not found.', data: null }
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
  const departmentNameById = new Map(departments.map((department) => [department.department_id, department.name]))

  const { data: membershipsData, error: membershipsError } = await context.admin
    .from('department_members')
    .select('user_id, department_id, member_role, is_active')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (membershipsError) {
    return { success: false as const, error: formatDatabaseError(membershipsError.message), data: null }
  }

  const memberships = (membershipsData ?? []) as MembershipRow[]
  const membershipRows = memberships
    .map((membership) => ({
      department_id: membership.department_id,
      name: departmentNameById.get(membership.department_id) ?? 'Unknown department',
      member_role: membership.member_role,
      is_active: membership.is_active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const profileDepartments = Array.from(
    new Map(
      membershipRows
        .filter((membership) => departmentNameById.has(membership.department_id))
        .map((membership) => [membership.department_id, membership.name] as const),
    ),
  )
    .map(([department_id, name]) => ({ department_id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const departmentsForFilter = profileDepartments.length > 0 ? profileDepartments : departments
  const selectedDepartmentId = normalizeProfileDepartmentFilter(filters?.departmentId, departmentsForFilter)

  let entriesQuery = context.admin
    .from('daily_entries')
    .select('entry_id, user_id, entry_date, status, department_id')
    .eq('company_id', context.companyId)
    .eq('user_id', userId)
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.endDate)

  if (selectedDepartmentId) {
    entriesQuery = entriesQuery.eq('department_id', selectedDepartmentId)
  }

  const { data: entriesData, error: entriesError } = await entriesQuery
  if (entriesError) {
    return { success: false as const, error: formatDatabaseError(entriesError.message), data: null }
  }

  const entries = (entriesData ?? []) as EntryRow[]
  const stats = toStatsMap(entries).get(userId) ?? {
    submittedCount: 0,
    draftCount: 0,
    submittedDays: new Set<string>(),
    lastEntryDate: null,
  }

  const periodDays = diffDaysInclusive(range.startDate, range.endDate)
  let departmentScore: number | null = null
  let departmentRank: number | null = null
  let scoringMetricsCount = 0

  if (selectedDepartmentId) {
    const scoreResult = await computeDepartmentScores(
      context.admin,
      context.companyId,
      selectedDepartmentId,
      range.startDate,
      range.endDate,
    )
    scoringMetricsCount = scoreResult.scoringMetricsCount
    departmentScore = scoreResult.scoreByUserId.get(userId) ?? null
    departmentRank = scoreResult.rankByUserId.get(userId) ?? null
  }

  let departmentMetrics: DepartmentMetric[] = []
  if (selectedDepartmentId) {
    const metricsResult = await resolveDepartmentMetrics(context.admin, context.companyId, selectedDepartmentId)
    if (!metricsResult.ok) {
      return { success: false as const, error: metricsResult.message, data: null }
    }
    departmentMetrics = metricsResult.metrics
  }

  const metricIds = departmentMetrics.map((metric) => metric.metric_id)
  const metricById = new Map(departmentMetrics.map((metric) => [metric.metric_id, metric]))

  let targetByMetricId = new Map<string, number>()
  if (selectedDepartmentId && metricIds.length > 0) {
    const { data: targetsData, error: targetsError } = await context.admin
      .from('targets')
      .select('metric_id, value')
      .eq('company_id', context.companyId)
      .eq('department_id', selectedDepartmentId)
      .eq('scope', 'department')
      .eq('period', 'daily')
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('metric_id', metricIds)

    if (targetsError) {
      return { success: false as const, error: formatDatabaseError(targetsError.message), data: null }
    }

    targetByMetricId = new Map(
      ((targetsData ?? []) as Array<{ metric_id: string; value: number }>).map((target) => [
        target.metric_id,
        Number(target.value),
      ]),
    )
  }

  let dailyPassThreshold = 2
  if (selectedDepartmentId) {
    const { data: ruleData, error: ruleError } = await context.admin
      .from('department_rules')
      .select('daily_pass_threshold')
      .eq('department_id', selectedDepartmentId)
      .eq('company_id', context.companyId)
      .maybeSingle()

    if (ruleError) {
      return { success: false as const, error: formatDatabaseError(ruleError.message), data: null }
    }

    if (typeof ruleData?.daily_pass_threshold === 'number') {
      dailyPassThreshold = Math.max(0, ruleData.daily_pass_threshold)
    }
  }

  let recentLogsQuery = context.admin
    .from('daily_entries')
    .select('entry_id, entry_date, status, notes')
    .eq('company_id', context.companyId)
    .eq('user_id', userId)
    .gte('entry_date', range.startDate)
    .lte('entry_date', range.endDate)
    .order('entry_date', { ascending: false })
    .limit(20)

  if (selectedDepartmentId) {
    recentLogsQuery = recentLogsQuery.eq('department_id', selectedDepartmentId)
  }

  const { data: recentLogsData, error: recentLogsError } = await recentLogsQuery
  if (recentLogsError) {
    return { success: false as const, error: formatDatabaseError(recentLogsError.message), data: null }
  }

  const recentLogEntries = (recentLogsData ?? []) as Array<{
    entry_id: string
    entry_date: string
    status: 'draft' | 'submitted'
    notes: string | null
  }>

  const { monthStart, monthEnd } = monthBounds(range.endDate)
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${monthStart}T00:00:00`))

  let monthSubmittedEntries: Array<{ entry_id: string; entry_date: string }> = []
  if (selectedDepartmentId) {
    const { data: monthData, error: monthError } = await context.admin
      .from('daily_entries')
      .select('entry_id, entry_date')
      .eq('company_id', context.companyId)
      .eq('department_id', selectedDepartmentId)
      .eq('user_id', userId)
      .eq('status', 'submitted')
      .gte('entry_date', monthStart)
      .lte('entry_date', monthEnd)

    if (monthError) {
      return { success: false as const, error: formatDatabaseError(monthError.message), data: null }
    }

    monthSubmittedEntries = (monthData ?? []) as Array<{ entry_id: string; entry_date: string }>
  }

  const submittedEntriesInRange = entries.filter((entry) => entry.status === 'submitted')
  const neededEntryIds = Array.from(
    new Set([
      ...submittedEntriesInRange.map((entry) => entry.entry_id),
      ...recentLogEntries.map((entry) => entry.entry_id),
      ...monthSubmittedEntries.map((entry) => entry.entry_id),
    ]),
  )

  const valueByEntryMetric = new Map<
    string,
    {
      metric_id: string
      value_numeric: number | null
      value_text: string | null
      value_bool: boolean | null
    }
  >()

  if (neededEntryIds.length > 0 && metricIds.length > 0) {
    const { data: valuesData, error: valuesError } = await context.admin
      .from('entry_values')
      .select('entry_id, metric_id, value_numeric, value_text, value_bool')
      .in('entry_id', neededEntryIds)
      .in('metric_id', metricIds)

    if (valuesError) {
      return { success: false as const, error: formatDatabaseError(valuesError.message), data: null }
    }

    for (const row of (valuesData ?? []) as Array<{
      entry_id: string
      metric_id: string
      value_numeric: number | null
      value_text: string | null
      value_bool: boolean | null
    }>) {
      valueByEntryMetric.set(`${row.entry_id}:${row.metric_id}`, {
        metric_id: row.metric_id,
        value_numeric: row.value_numeric,
        value_text: row.value_text,
        value_bool: row.value_bool,
      })
    }
  }

  const kpiMetrics = departmentMetrics.filter((metric) => RANKING_METRIC_TYPES.includes(metric.data_type))
  const kpiTotals = new Map<string, number>()
  for (const entry of submittedEntriesInRange) {
    for (const metric of kpiMetrics) {
      const value = valueByEntryMetric.get(`${entry.entry_id}:${metric.metric_id}`)
      if (!value) {
        continue
      }

      const comparable = parseComparableMetricValue(metric.data_type, value)
      if (comparable === null) {
        continue
      }

      kpiTotals.set(metric.metric_id, (kpiTotals.get(metric.metric_id) ?? 0) + comparable)
    }
  }

  const metricKpis: AgentMetricKpi[] = kpiMetrics.map((metric) => ({
    ...metric,
    current_value: Number((kpiTotals.get(metric.metric_id) ?? 0).toFixed(2)),
    target_value: targetByMetricId.get(metric.metric_id) ?? null,
  }))

  const totalTargetMetrics = targetByMetricId.size
  const minimumRequired =
    totalTargetMetrics > 0 ? Math.min(totalTargetMetrics, Math.max(1, dailyPassThreshold)) : 0
  const monthEntryByDate = new Map(monthSubmittedEntries.map((entry) => [entry.entry_date, entry.entry_id]))
  const todayKey = dateKeyUtc(new Date())

  const calendarDays: AgentCalendarDay[] = []
  const monthStartDate = new Date(`${monthStart}T00:00:00Z`)
  const monthEndDate = new Date(`${monthEnd}T00:00:00Z`)

  for (
    let cursor = new Date(monthStartDate.getTime());
    cursor.getTime() <= monthEndDate.getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    const date = dateKeyUtc(cursor)
    const day = cursor.getUTCDate()
    const entryId = monthEntryByDate.get(date)

    if (totalTargetMetrics === 0 || date > todayKey) {
      calendarDays.push({
        date,
        day,
        status: 'no_data',
        met_targets_count: 0,
        total_targets_count: totalTargetMetrics,
      })
      continue
    }

    if (!entryId) {
      calendarDays.push({
        date,
        day,
        status: 'off_track',
        met_targets_count: 0,
        total_targets_count: totalTargetMetrics,
      })
      continue
    }

    let metTargetsCount = 0
    for (const [metricId, targetValue] of targetByMetricId.entries()) {
      const metric = metricById.get(metricId)
      if (!metric) {
        continue
      }

      const value = valueByEntryMetric.get(`${entryId}:${metricId}`)
      if (!value) {
        continue
      }

      const comparable = parseComparableMetricValue(metric.data_type, value)
      if (comparable === null) {
        continue
      }

      const met =
        metric.direction === 'lower_is_better' ? comparable <= targetValue : comparable >= targetValue

      if (met) {
        metTargetsCount += 1
      }
    }

    calendarDays.push({
      date,
      day,
      status: metTargetsCount >= minimumRequired ? 'on_track' : 'off_track',
      met_targets_count: metTargetsCount,
      total_targets_count: totalTargetMetrics,
    })
  }

  const recentLogs = recentLogEntries.map((entry) => ({
    entry_id: entry.entry_id,
    entry_date: entry.entry_date,
    status: entry.status,
    notes: entry.notes,
    metric_values: departmentMetrics.map((metric) => {
      const value = valueByEntryMetric.get(`${entry.entry_id}:${metric.metric_id}`)
      return {
        metric_id: metric.metric_id,
        value_numeric: value?.value_numeric ?? null,
        value_text: value?.value_text ?? null,
        value_bool: value?.value_bool ?? null,
      }
    }),
  })) as RecentAgentEntry[]

  return {
    success: true as const,
    data: {
      viewerRole: context.role,
      profile: profileData as ProfileRow,
      departments: departmentsForFilter,
      selectedDepartmentId,
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      memberships: membershipRows,
      stats: {
        submitted_count: stats.submittedCount,
        draft_count: stats.draftCount,
        completion_rate: toPercent(stats.submittedDays.size, periodDays),
        last_entry_date: stats.lastEntryDate,
        department_score: departmentScore,
        department_rank: departmentRank,
        scoring_metrics_count: scoringMetricsCount,
      },
      metric_kpis: metricKpis,
      department_metrics: departmentMetrics,
      calendar: {
        month_label: monthLabel,
        month_start: monthStart,
        month_end: monthEnd,
        minimum_required: minimumRequired,
        total_target_metrics: totalTargetMetrics,
        days: calendarDays,
      },
      recent_logs: recentLogs,
    },
  }
}
