'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { memberFilterSchema } from './schemas'
import { type Role, isRole } from '@/lib/rbac/roles'

type ProfileNameRow = {
  user_id: string
  name: string
}

type CompanyMembershipRow = {
  user_id: string
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

function isMissingCompanyMembershipsTable(message: string) {
  return message.toLowerCase().includes('relation "company_memberships" does not exist')
}

function membershipErrorMessage(message: string) {
  if (isMissingCompanyMembershipsTable(message)) {
    return 'Database migration missing: run 2026-02-27_add_company_memberships.sql in Supabase.'
  }
  return formatDatabaseError(message)
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

  if (!profile?.company_id || profile.is_active === false || profile.deleted_at) {
    return { ok: false as const, message: 'Company profile not found.' }
  }

  const { data: viewerMembership, error: viewerMembershipError } = await admin
    .from('company_memberships')
    .select('role, is_active')
    .eq('company_id', profile.company_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (viewerMembershipError) {
    return { ok: false as const, message: membershipErrorMessage(viewerMembershipError.message) }
  }

  const viewerRole = viewerMembership?.role ?? profile.role
  if (!isRole(viewerRole) || viewerMembership?.is_active === false) {
    return { ok: false as const, message: 'Active company membership not found.' }
  }

  return {
    ok: true as const,
    admin,
    companyId: profile.company_id as string,
    role: viewerRole,
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

  let membershipsQuery = context.admin
    .from('company_memberships')
    .select('user_id, role, is_active, created_at, updated_at')
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters.role !== 'all') {
    membershipsQuery = membershipsQuery.eq('role', filters.role)
  }

  if (filters.status !== 'all') {
    membershipsQuery = membershipsQuery.eq('is_active', filters.status === 'active')
  }

  const { data: membershipsData, error: membershipsError } = await membershipsQuery

  if (membershipsError) {
    return { success: false, error: membershipErrorMessage(membershipsError.message), data: null }
  }

  const memberships = (membershipsData ?? []) as CompanyMembershipRow[]
  const userIds = memberships.map((membership) => membership.user_id)
  const profileNameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profilesData, error: profilesError } = await context.admin
      .from('profiles')
      .select('user_id, name')
      .in('user_id', userIds)

    if (profilesError) {
      return { success: false, error: formatDatabaseError(profilesError.message), data: null }
    }

    for (const profile of (profilesData ?? []) as ProfileNameRow[]) {
      profileNameMap.set(profile.user_id, profile.name)
    }
  }

  const emailMap = userIds.length > 0 ? await getUserEmailMap(context.admin, userIds) : new Map<string, string>()

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
    const { data: departmentMembershipsData, error: departmentMembershipsError } = await context.admin
      .from('department_members')
      .select('user_id, department_id')
      .in('user_id', userIds)
      .eq('is_active', true)
      .is('deleted_at', null)

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

  let members: MemberRow[] = memberships.map((membership) => ({
    userId: membership.user_id,
    name: profileNameMap.get(membership.user_id) ?? 'Unknown user',
    email: emailMap.get(membership.user_id) ?? '',
    role: membership.role,
    isActive: membership.is_active,
    createdAt: membership.created_at,
    updatedAt: membership.updated_at,
    departments: membershipsByUser.get(membership.user_id) ?? [],
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
