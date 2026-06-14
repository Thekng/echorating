'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { departmentFilterSchema } from './schemas'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

export async function listDepartments(rawFilters?: {
  q?: string
  status?: string
}) {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: [], count: 0 }
  }

  const parsedFilters = departmentFilterSchema.safeParse({
    q: rawFilters?.q,
    status: rawFilters?.status,
  })

  if (!parsedFilters.success) {
    return { success: false, error: 'Invalid filters.', data: [], count: 0 }
  }

  const filters = parsedFilters.data

  let query = context.admin
    .from('departments')
    .select('id, name, description, is_active, location_id, created_at, updated_at', { count: 'exact' })
    .eq('organization_id', context.organizationId)
    .order('created_at', { ascending: false })

  if (filters.q?.trim()) {
    query = query.ilike('name', `%${filters.q.trim()}%`)
  }

  if (filters.status !== 'all') {
    query = query.eq('is_active', filters.status === 'active')
  }

  const { data: departments, error: listError, count } = await query

  if (listError) {
    return { success: false, error: formatDatabaseError(listError.message), data: [], count: 0 }
  }

  // Get member counts per department
  const departmentIds = (departments ?? []).map((d) => (d as { id: string }).id)
  const memberCountMap = new Map<string, number>()

  if (departmentIds.length > 0) {
    const { data: memberData } = await context.admin
      .from('department_members')
      .select('department_id')
      .in('department_id', departmentIds)

    if (memberData) {
      for (const row of memberData) {
        const deptId = row.department_id as string
        memberCountMap.set(deptId, (memberCountMap.get(deptId) ?? 0) + 1)
      }
    }
  }

  const enriched = (departments ?? []).map((d) => {
    const dept = d as { id: string; name: string; description: string | null; is_active: boolean; location_id: string | null; created_at: string; updated_at: string }
    return {
      ...dept,
      department_id: dept.id, // backward-compat alias for accountability pages
      member_count: memberCountMap.get(dept.id) ?? 0,
    }
  })

  return { success: true, data: enriched, count: count ?? 0, filters }
}

export async function getDepartmentById(id: string) {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  const { data, error: queryError } = await context.admin
    .from('departments')
    .select('id, name, description, is_active, location_id, created_at, updated_at')
    .eq('id', id)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (queryError) {
    return { success: false, error: formatDatabaseError(queryError.message), data: null }
  }

  return { success: true, data }
}

// Legacy stubs — these aggregate/report functions were removed in Phase 3.
// The accountability pages still import them. Return empty data so the UI
// renders gracefully with "no entries" states while those pages are migrated.

export async function getDepartmentProfile(
  departmentId: string,
  _period?: string,
  _startDate?: string,
  _endDate?: string,
) {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false as const, error: context.message, data: null }
  }

  const { data: department, error: deptError } = await context.admin
    .from('departments')
    .select('id, name, description, is_active, created_at')
    .eq('id', departmentId)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (deptError || !department) {
    return {
      success: false as const,
      error: deptError ? formatDatabaseError(deptError.message) : 'Department not found.',
      data: null,
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return {
    success: true as const,
    data: {
      department: {
        department_id: department.id,
        name: department.name as string,
        description: department.description as string | null,
      },
      stats: {
        submitted_count: 0,
        completion_rate: 0,
        last_entry_date: null as string | null,
      },
      metrics: [] as Array<{
        id: string
        code: string
        data_type: string
        unit: string | null
        settings: unknown
      }>,
      recent_entries: [] as Array<{
        id: string
        report_date: string
        status: string
        notes: string | null
        metric_values: Array<{
          metric_id: string
          value_number: number | null
          value_text: string | null
          value_boolean: boolean | null
        }>
      }>,
      members_count: 0,
      startDate: today,
      endDate: today,
    },
  }
}

export async function getDepartmentAgentMetrics(
  _departmentId: string,
  _userIds: string[],
  _startDate: string,
  _endDate: string,
) {
  return {
    success: true as const,
    data: {} as Record<string, Record<string, number>>,
  }
}
