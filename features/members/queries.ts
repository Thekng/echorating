'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { memberFilterSchema } from './schemas'
import { type Role, isRole } from '@/lib/rbac/roles'

type CompanyMemberProfileRelation = {
  name: string
  is_active: boolean
} | Array<{
  name: string
  is_active: boolean
}> | null

type CompanyMemberRow = {
  user_id: string
  role: Role
  created_at: string
  updated_at: string
  profiles: CompanyMemberProfileRelation
}

type PendingInvitationRow = {
  invitation_id: string
  name: string | null
  email: string
  role: 'manager' | 'member'
  department_id: string | null
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

type MemberListRow =
  | {
      type: 'member'
      rowId: string
      userId: string
      name: string
      email: string
      role: Role
      isActive: boolean
      createdAt: string
      updatedAt: string
      departments: MemberDepartment[]
    }
  | {
      type: 'invite'
      rowId: string
      invitationId: string
      name: string
      email: string
      role: 'manager' | 'member'
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
    .select('company_id, is_active, deleted_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || profile.is_active === false || profile.deleted_at) {
    return { ok: false as const, message: 'Company profile not found.' }
  }

  const { data: viewerMembership, error: viewerMembershipError } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', profile.company_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (viewerMembershipError) {
    return { ok: false as const, message: formatDatabaseError(viewerMembershipError.message) }
  }

  if (!viewerMembership || !isRole(viewerMembership.role)) {
    return { ok: false as const, message: 'Active company membership not found.' }
  }

  return {
    ok: true as const,
    admin,
    companyId: profile.company_id as string,
    role: viewerMembership.role,
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

function isMissingInvitationNameColumn(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('invitations.name') &&
    normalized.includes('does not exist')
  )
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
    .from('company_members')
    .select('user_id, role, created_at, updated_at, profiles!inner(name, is_active)')
    .eq('company_id', context.companyId)
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

  let rows: MemberListRow[] = memberships.map((membership) => {
    const relatedProfile = normalizeProfileRelation(membership.profiles)

    return {
      type: 'member',
      rowId: `member:${membership.user_id}`,
      userId: membership.user_id,
      name: relatedProfile?.name ?? 'Unknown user',
      email: emailMap.get(membership.user_id) ?? '',
      role: membership.role,
      isActive: relatedProfile?.is_active !== false,
      createdAt: membership.created_at,
      updatedAt: membership.updated_at,
      departments: membershipsByUser.get(membership.user_id) ?? [],
    }
  })

  if (filters.status !== 'all') {
    rows = rows.filter((row) => row.type !== 'member' || row.isActive === (filters.status === 'active'))
  }

  const invitationsWithName = await context.admin
    .from('invitations')
    .select('invitation_id, name, email, role, department_id, created_at, updated_at')
    .eq('company_id', context.companyId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  let pendingInvites: PendingInvitationRow[] = []

  if (!invitationsWithName.error) {
    pendingInvites = (invitationsWithName.data ?? []) as PendingInvitationRow[]
  } else if (isMissingInvitationNameColumn(invitationsWithName.error.message)) {
    const invitationsWithoutName = await context.admin
      .from('invitations')
      .select('invitation_id, email, role, department_id, created_at, updated_at')
      .eq('company_id', context.companyId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (invitationsWithoutName.error) {
      return { success: false, error: formatDatabaseError(invitationsWithoutName.error.message), data: null }
    }

    pendingInvites = (invitationsWithoutName.data ?? []).map((invite) => ({
      ...invite,
      name: null,
    })) as PendingInvitationRow[]
  } else {
    return { success: false, error: formatDatabaseError(invitationsWithName.error.message), data: null }
  }

  if (filters.role !== 'all') {
    pendingInvites = pendingInvites.filter((invite) => invite.role === filters.role)
  }

  if (filters.status !== 'inactive') {
    const inviteRows: MemberListRow[] = pendingInvites.map((invite) => ({
      type: 'invite',
      rowId: `invite:${invite.invitation_id}`,
      invitationId: invite.invitation_id,
      name: invite.name?.trim() || invite.email,
      email: invite.email,
      role: invite.role,
      createdAt: invite.created_at,
      updatedAt: invite.updated_at,
      departments: invite.department_id
        ? [{
            departmentId: invite.department_id,
            name: departmentMap.get(invite.department_id) ?? 'Unknown department',
          }]
        : [],
    }))

    rows = [...rows, ...inviteRows]
  }

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
      departments: companyDepartments,
      viewerRole: context.role,
      filters,
    },
  }
}
