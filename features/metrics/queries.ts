'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { requireRole } from '@/lib/rbac/guards'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { metricFilterSchema } from './schemas'
import { type MetricDataType } from '@/lib/metrics/data-types'

type DepartmentRow = {
  id: string
  name: string
}

type MetricRow = {
  id: string
  department_id: string
  name: string
  code: string | null
  description: string | null
  data_type: MetricDataType
  is_required: boolean
  settings: unknown
  sort_order: number | null
  is_active: boolean
  created_at: string
}

export async function listMetrics(rawFilters?: {
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

  const parsedFilters = metricFilterSchema.safeParse({
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
    .select('id, name')
    .eq('organization_id', context.organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (departmentsError) {
    return { success: false, error: formatDatabaseError(departmentsError.message), data: null }
  }

  const departments = (departmentsData ?? []) as DepartmentRow[]
  const departmentMap = new Map(departments.map((department) => [department.id, department.name]))
  const effectiveDepartmentId =
    departments.find((department) => department.id === filters.departmentId)?.id ??
    departments[0]?.id ??
    'all'

  let metricsQuery = context.admin
    .from('metrics')
    .select(
      'id, department_id, name, code, description, data_type, is_required, settings, sort_order, is_active, created_at',
    )
    .eq('organization_id', context.organizationId)
    .order('department_id', { ascending: true })
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (effectiveDepartmentId !== 'all') {
    metricsQuery = metricsQuery.eq('department_id', effectiveDepartmentId)
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
        (metric.code ?? '').toLowerCase().includes(term) ||
        (metric.description ?? '').toLowerCase().includes(term)
      )
    })
  }

  return {
    success: true,
    data: {
      metrics: metrics.map((metric) => ({
        ...metric,
        department_name: departmentMap.get(metric.department_id) ?? 'Unknown department',
      })),
      departments,
      filters: {
        ...filters,
        departmentId: effectiveDepartmentId,
      },
      viewerRole: context.role,
    },
  }
}

export async function getMetricById(id: string) {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.', data: null }
  }

  const { data, error } = await context.admin
    .from('metrics')
    .select(
      'id, department_id, name, code, description, data_type, is_required, settings, sort_order, is_active, created_at',
    )
    .eq('id', id)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (error) {
    return { success: false, error: formatDatabaseError(error.message), data: null }
  }

  if (!data) {
    return { success: false, error: 'Metric not found.', data: null }
  }

  return { success: true, data }
}
