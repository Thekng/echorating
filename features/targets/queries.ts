'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { requireRole } from '@/lib/rbac/guards'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { targetFilterSchema } from './schemas'

type DepartmentRow = {
  department_id: string
  name: string
}

type MetricRow = {
  metric_id: string
  department_id: string
  name: string
  code: string
  is_active: boolean
}

type TargetRow = {
  target_id: string
  department_id: string
  metric_id: string
  scope: 'department' | 'member'
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  value: number
  is_active: boolean
  created_at: string
  updated_at: string
}


export async function listTargets(rawFilters?: {
  q?: string
  departmentId?: string
  status?: string
}) {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.', data: null }
  }

  const parsedFilters = targetFilterSchema.safeParse({
    q: rawFilters?.q,
    departmentId: rawFilters?.departmentId,
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
  const departmentNameById = new Map(departments.map((department) => [department.department_id, department.name]))

  const { data: metricsData, error: metricsError } = await context.admin
    .from('metrics')
    .select('metric_id, department_id, name, code, is_active')
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (metricsError) {
    return { success: false, error: formatDatabaseError(metricsError.message), data: null }
  }

  const metrics = (metricsData ?? []) as MetricRow[]
  const metricById = new Map(metrics.map((metric) => [metric.metric_id, metric]))

  let targetsQuery = context.admin
    .from('targets')
    .select('target_id, department_id, metric_id, scope, period, value, is_active, created_at, updated_at')
    .eq('company_id', context.companyId)
    .eq('scope', 'department')
    .eq('period', 'daily')
    .is('user_id', null)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (filters.departmentId !== 'all') {
    targetsQuery = targetsQuery.eq('department_id', filters.departmentId)
  }

  if (filters.status !== 'all') {
    targetsQuery = targetsQuery.eq('is_active', filters.status === 'active')
  }

  const { data: targetsData, error: targetsError } = await targetsQuery
  if (targetsError) {
    return { success: false, error: formatDatabaseError(targetsError.message), data: null }
  }

  let targets = (targetsData ?? []) as TargetRow[]

  if (filters.q?.trim()) {
    const term = filters.q.trim().toLowerCase()
    targets = targets.filter((target) => {
      const metric = metricById.get(target.metric_id)
      const departmentName = departmentNameById.get(target.department_id) ?? ''
      return (
        departmentName.toLowerCase().includes(term) ||
        (metric?.name ?? '').toLowerCase().includes(term) ||
        (metric?.code ?? '').toLowerCase().includes(term)
      )
    })
  }

  return {
    success: true,
    data: {
      targets: targets.map((target) => {
        const metric = metricById.get(target.metric_id)
        return {
          ...target,
          value: Number(target.value),
          department_name: departmentNameById.get(target.department_id) ?? 'Unknown department',
          metric_name: metric?.name ?? 'Unknown metric',
          metric_code: metric?.code ?? 'unknown_metric',
          metric_is_active: metric?.is_active ?? false,
        }
      }),
      departments,
      metrics: metrics
        .filter((metric) => metric.is_active)
        .map((metric) => ({
          metric_id: metric.metric_id,
          department_id: metric.department_id,
          name: metric.name,
          code: metric.code,
          department_name: departmentNameById.get(metric.department_id) ?? 'Unknown department',
        })),
      filters,
      viewerRole: context.role,
    },
  }
}

export async function getTargetById(id: string) {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.', data: null }
  }

  const { data: target, error: targetError } = await context.admin
    .from('targets')
    .select('target_id, department_id, metric_id, scope, period, value, is_active, created_at, updated_at')
    .eq('target_id', id)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (targetError) {
    return { success: false, error: formatDatabaseError(targetError.message), data: null }
  }

  if (!target) {
    return { success: false, error: 'Target not found.', data: null }
  }

  return {
    success: true,
    data: {
      ...target,
      value: Number(target.value),
    },
  }
}
