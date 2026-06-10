'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { memberFilterSchema } from './schemas'
import { type Role } from '@/lib/rbac/roles'

type CompanyMemberProfileRelation = {
  full_name: string | null
} | Array<{
  full_name: string | null
}> | null

type CompanyMemberRow = {
  user_id: string
  role: Role
  created_at: string
  updated_at: string
  profiles: CompanyMemberProfileRelation
}

type DepartmentOption = {
  id: string
  name: string
}

type MemberDepartment = {
  departmentId: string
  name: string
}

type MemberListRow = {
  type: 'member'
  rowId: string
  userId: string
  name: string
  email: string
  role: Role
  createdAt: string
  updatedAt: string
  departments: MemberDepartment[]
}

function normalizeProfileRelation(profile: CompanyMemberProfileRelation) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null
  }

  return profile
}

function profileName(profile: CompanyMemberProfileRelation) {
  const normalized = normalizeProfileRelation(profile)
  return normalized?.full_name ?? 'Unknown user'
}

async function getUserEmailMap(admin: ReturnType<typeof createAdminClient>, userIds: string[]) {
  const entries = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId)

      if (error) {
        return [userId, ''] as const
      }

      return [userId, data.user?.email ?? ''] as const
    }),
  )

  return new Map(entries)
}

export async function listMembers(rawFilters?: {
  q?: string
  role?: string
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

  const parsedFilters = memberFilterSchema.safeParse({
    q: rawFilters?.q,
    role: rawFilters?.role,
  })

  if (!parsedFilters.success) {
    return { success: false, error: 'Invalid filters.', data: null }
  }

  const filters = parsedFilters.data

  let membershipsQuery = context.admin
    .from('organization_members')
    .select('user_id, role, created_at, updated_at, profiles!inner(full_name)')
    .eq('organization_id', context.organizationId)
    .order('created_at', { ascending: false })

  if (filters.role !== 'all') {
    membershipsQuery = membershipsQuery.eq('role', filters.role)
  }

  const { data: membershipsData, error: membershipsError } = await membershipsQuery

  if (membershipsError) {
    return { success: false, error: formatDatabaseError(membershipsError.message), data: null }
  }

  const memberships = (membershipsData ?? []) as CompanyMemberRow[]
  const userIds = memberships.map((membership) => membership.user_id)
  const emailMap = userIds.length > 0 ? await getUserEmailMap(context.admin, userIds) : new Map<string, string>()

  const { data: orgDepartmentsData, error: orgDepartmentsError } = await context.admin
    .from('departments')
    .select('id, name')
    .eq('organization_id', context.organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (orgDepartmentsError) {
    return { success: false, error: formatDatabaseError(orgDepartmentsError.message), data: null }
  }

  const orgDepartments = (orgDepartmentsData ?? []) as DepartmentOption[]
  const departmentMap = new Map(orgDepartments.map((department) => [department.id, department.name]))

  let membershipsByUser = new Map<string, MemberDepartment[]>()

  if (userIds.length > 0) {
    const { data: departmentMembershipsData, error: departmentMembershipsError } = await context.admin
      .from('department_members')
      .select('user_id, department_id')
      .in('user_id', userIds)

    if (departmentMembershipsError) {
      return { success: false, error: formatDatabaseError(departmentMembershipsError.message), data: null }
    }

    const departmentMemberships = (departmentMembershipsData ?? []) as Array<{ user_id: string; department_id: string }>
    membershipsByUser = departmentMemberships.reduce((acc, membership) => {
      const departmentName = departmentMap.get(membership.department_id)
      if (!departmentName) {
        return acc
      }

      const existing = acc.get(membership.user_id) ?? []
      existing.push({
        departmentId: membership.department_id,
        name: departmentName,
      })
      acc.set(membership.user_id, existing)
      return acc
    }, new Map<string, MemberDepartment[]>())
  }

  let rows: MemberListRow[] = memberships.map((membership) => {
    return {
      type: 'member',
      rowId: `member:${membership.user_id}`,
      userId: membership.user_id,
      name: profileName(membership.profiles),
      email: emailMap.get(membership.user_id) ?? '',
      role: membership.role,
      createdAt: membership.created_at,
      updatedAt: membership.updated_at,
      departments: membershipsByUser.get(membership.user_id) ?? [],
    }
  })

  if (filters.q?.trim()) {
    const term = filters.q.trim().toLowerCase()

    rows = rows.filter((row) => {
      const departmentText = row.departments.map((department) => department.name).join(' ')

      return (
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        departmentText.toLowerCase().includes(term)
      )
    })
  }

  rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))

  return {
    success: true,
    data: {
      rows,
      departments: orgDepartments,
      viewerRole: context.role,
      filters,
    },
  }
}

export async function getMemberDepartments(userId: string) {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: [] }
  }

  const { data, error } = await context.admin
    .from('department_members')
    .select('department_id, role, departments!inner(id, name)')
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: formatDatabaseError(error.message), data: [] }
  }

  return { success: true, data: data ?? [] }
}
