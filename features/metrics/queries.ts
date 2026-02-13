'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { metricFilterSchema } from './schemas'

type DepartmentRow = {
  department_id: string
  name: string
}

type MetricRow = {
  metric_id: string
  department_id: string
  name: string
  code: string
  description: string | null
  data_type: 'number' | 'currency' | 'percent' | 'boolean' | 'duration'
  unit: string
  direction: 'higher_is_better' | 'lower_is_better'
  input_mode: 'manual' | 'calculated'
  precision_scale: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type FormulaRow = {
  formula_id: string
  metric_id: string
  expression: string
  version: number
}

type DailyTargetRow = {
  target_id: string
  department_id: string
  metric_id: string
  value: number
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

export async function listMetrics(rawFilters?: {
  q?: string
  departmentId?: string
  mode?: string
  status?: string
}) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.', data: null }
  }

  const parsedFilters = metricFilterSchema.safeParse({
    q: rawFilters?.q,
    departmentId: rawFilters?.departmentId,
    mode: rawFilters?.mode,
    status: rawFilters?.status,
  })

  if (!parsedFilters.success) {
    return { success: false, error: 'Invalid filters.', data: null }
  }

  const filters = parsedFilters.data

  const { data: departmentsData, error: departmentsError } = await context.admin
    .from('departments')
    .select('department_id, name')
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (departmentsError) {
    return { success: false, error: formatDatabaseError(departmentsError.message), data: null }
  }

  const departments = (departmentsData ?? []) as DepartmentRow[]
  const departmentMap = new Map(departments.map((department) => [department.department_id, department.name]))

  let metricsQuery = context.admin
    .from('metrics')
    .select(
      'metric_id, department_id, name, code, description, data_type, unit, direction, input_mode, precision_scale, is_active, created_at, updated_at',
    )
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters.departmentId !== 'all') {
    metricsQuery = metricsQuery.eq('department_id', filters.departmentId)
  }

  if (filters.mode !== 'all') {
    metricsQuery = metricsQuery.eq('input_mode', filters.mode)
  }

  if (filters.status !== 'all') {
    metricsQuery = metricsQuery.eq('is_active', filters.status === 'active')
  }

  const { data: metricsData, error: metricsError } = await metricsQuery

  if (metricsError) {
    return { success: false, error: formatDatabaseError(metricsError.message), data: null }
  }

  let metrics = (metricsData ?? []) as MetricRow[]

  if (filters.q?.trim()) {
    const term = filters.q.trim().toLowerCase()
    metrics = metrics.filter((metric) => {
      return (
        metric.name.toLowerCase().includes(term) ||
        metric.code.toLowerCase().includes(term) ||
        (metric.description ?? '').toLowerCase().includes(term)
      )
    })
  }

  const metricIds = metrics.map((metric) => metric.metric_id)

  const currentFormulaMap = new Map<string, FormulaRow>()
  const dependencyMap = new Map<string, string[]>()

  if (metricIds.length > 0) {
    const { data: formulasData, error: formulasError } = await context.admin
      .from('metric_formulas')
      .select('formula_id, metric_id, expression, version')
      .in('metric_id', metricIds)
      .eq('is_current', true)

    if (formulasError) {
      return { success: false, error: formatDatabaseError(formulasError.message), data: null }
    }

    for (const formula of (formulasData ?? []) as FormulaRow[]) {
      currentFormulaMap.set(formula.metric_id, formula)
    }

    const { data: depsData, error: depsError } = await context.admin
      .from('metric_formula_dependencies')
      .select('metric_id, depends_on_metric_id')
      .in('metric_id', metricIds)

    if (depsError) {
      return { success: false, error: formatDatabaseError(depsError.message), data: null }
    }

    for (const dependency of (depsData ?? []) as Array<{ metric_id: string; depends_on_metric_id: string }>) {
      const existing = dependencyMap.get(dependency.metric_id) ?? []
      existing.push(dependency.depends_on_metric_id)
      dependencyMap.set(dependency.metric_id, existing)
    }
  }

  const { data: allActiveMetricsData, error: allActiveMetricsError } = await context.admin
    .from('metrics')
    .select('metric_id, name, code, department_id')
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (allActiveMetricsError) {
    return { success: false, error: formatDatabaseError(allActiveMetricsError.message), data: null }
  }

  const allActiveMetrics = (allActiveMetricsData ?? []) as Array<{
    metric_id: string
    name: string
    code: string
    department_id: string
  }>

  const metricNameMap = new Map(allActiveMetrics.map((metric) => [metric.metric_id, metric.name]))

  let targetsQuery = context.admin
    .from('targets')
    .select('target_id, department_id, metric_id, value')
    .eq('company_id', context.companyId)
    .eq('scope', 'department')
    .eq('period', 'daily')
    .eq('is_active', true)
    .is('user_id', null)
    .is('deleted_at', null)

  if (filters.departmentId !== 'all') {
    targetsQuery = targetsQuery.eq('department_id', filters.departmentId)
  }

  const { data: targetsData, error: targetsError } = await targetsQuery
  if (targetsError) {
    return { success: false, error: formatDatabaseError(targetsError.message), data: null }
  }

  const dailyTargetMap = new Map<string, DailyTargetRow>()
  for (const target of (targetsData ?? []) as DailyTargetRow[]) {
    dailyTargetMap.set(`${target.department_id}:${target.metric_id}`, target)
  }

  return {
    success: true,
    data: {
      metrics: metrics.map((metric) => {
        const dependencyIds = dependencyMap.get(metric.metric_id) ?? []
        const dailyTarget = dailyTargetMap.get(`${metric.department_id}:${metric.metric_id}`)
        return {
          ...metric,
          department_name: departmentMap.get(metric.department_id) ?? 'Unknown department',
          formula_expression: currentFormulaMap.get(metric.metric_id)?.expression ?? null,
          formula_version: currentFormulaMap.get(metric.metric_id)?.version ?? null,
          depends_on_metric_ids: dependencyIds,
          depends_on_metric_names: dependencyIds.map((metricId) => metricNameMap.get(metricId)).filter(Boolean),
          daily_target_id: dailyTarget?.target_id ?? null,
          daily_target_value: dailyTarget ? Number(dailyTarget.value) : null,
        }
      }),
      departments,
      dependencyMetrics: allActiveMetrics.map((metric) => ({
        metric_id: metric.metric_id,
        name: metric.name,
        code: metric.code,
        department_id: metric.department_id,
        department_name: departmentMap.get(metric.department_id) ?? 'Unknown department',
      })),
      filters,
      viewerRole: context.role,
    },
  }
}

export async function getMetricById(id: string) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.', data: null }
  }

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select(
      'metric_id, department_id, name, code, description, data_type, unit, direction, input_mode, precision_scale, is_active, created_at, updated_at',
    )
    .eq('metric_id', id)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (metricError) {
    return { success: false, error: formatDatabaseError(metricError.message), data: null }
  }

  if (!metric) {
    return { success: false, error: 'Metric not found.', data: null }
  }

  const { data: formula, error: formulaError } = await context.admin
    .from('metric_formulas')
    .select('formula_id, expression, version')
    .eq('metric_id', metric.metric_id)
    .eq('is_current', true)
    .maybeSingle()

  if (formulaError) {
    return { success: false, error: formatDatabaseError(formulaError.message), data: null }
  }

  const { data: dependencies, error: dependenciesError } = await context.admin
    .from('metric_formula_dependencies')
    .select('depends_on_metric_id')
    .eq('metric_id', metric.metric_id)

  if (dependenciesError) {
    return { success: false, error: formatDatabaseError(dependenciesError.message), data: null }
  }

  return {
    success: true,
    data: {
      ...metric,
      formula_expression: formula?.expression ?? null,
      formula_version: formula?.version ?? null,
      depends_on_metric_ids: (dependencies ?? []).map((item) => item.depends_on_metric_id as string),
    },
  }
}
