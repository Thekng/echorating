'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { memberFilterSchema } from './schemas'
import { type Role } from '@/lib/rbac/roles'

type ProfileRow = {
  user_id: string
  name: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

type DepartmentOption = {
  department_id: string
  name: string
}

type MemberDepartment = {
  departmentId: string
  name: string
}

type MemberRow = {
  userId: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
  updatedAt: string
  departments: MemberDepartment[]
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

  const parsedFilters = memberFilterSchema.safeParse({
    q: rawFilters?.q,
    role: rawFilters?.role,
    status: rawFilters?.status,
  })

  if (!parsedFilters.success) {
    return { success: false, error: 'Invalid filters.', data: null }
  }

  const filters = parsedFilters.data

  let profilesQuery = context.admin
    .from('profiles')
    .select('user_id, name, role, is_active, created_at, updated_at')
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters.role !== 'all') {
    profilesQuery = profilesQuery.eq('role', filters.role)
  }

  if (filters.status !== 'all') {
    profilesQuery = profilesQuery.eq('is_active', filters.status === 'active')
  }

  const { data: profilesData, error: profilesError } = await profilesQuery

  if (profilesError) {
    return { success: false, error: formatDatabaseError(profilesError.message), data: null }
  }

  const profiles = (profilesData ?? []) as ProfileRow[]
  const userIds = profiles.map((profile) => profile.user_id)

  const emailMap = await getUserEmailMap(context.admin, userIds)

  const { data: companyDepartmentsData, error: companyDepartmentsError } = await context.admin
    .from('departments')
    .select('department_id, name')
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (companyDepartmentsError) {
    return { success: false, error: formatDatabaseError(companyDepartmentsError.message), data: null }
  }

  const companyDepartments = (companyDepartmentsData ?? []) as DepartmentOption[]
  const departmentMap = new Map(companyDepartments.map((department) => [department.department_id, department.name]))

  let membershipsByUser = new Map<string, MemberDepartment[]>()

  if (userIds.length > 0) {
    const { data: membershipsData, error: membershipsError } = await context.admin
      .from('department_members')
      .select('user_id, department_id')
      .in('user_id', userIds)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (membershipsError) {
      return { success: false, error: formatDatabaseError(membershipsError.message), data: null }
    }

    const memberships = (membershipsData ?? []) as Array<{ user_id: string; department_id: string }>
    membershipsByUser = memberships.reduce((acc, membership) => {
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

  let members: MemberRow[] = profiles.map((profile) => ({
    userId: profile.user_id,
    name: profile.name,
    email: emailMap.get(profile.user_id) ?? '',
    role: profile.role,
    isActive: profile.is_active,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    departments: membershipsByUser.get(profile.user_id) ?? [],
  }))

  if (filters.q?.trim()) {
    const term = filters.q.trim().toLowerCase()

    members = members.filter((member) => {
      const departmentText = member.departments.map((department) => department.name).join(' ')

      return (
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        departmentText.toLowerCase().includes(term)
      )
    })
  }

  return {
    success: true,
    data: {
      members,
      departments: companyDepartments,
      viewerRole: context.role,
      filters,
    },
  }
}
