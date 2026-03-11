'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  assignMemberDepartmentSchema,
  createMemberSchema,
  toggleMemberStatusSchema,
  updateMemberRoleSchema,
} from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { sendEmail } from '@/emails/resend'
import { InviteMemberTemplate } from '@/emails/templates/invite-member'
import { type Role, isRole } from '@/lib/rbac/roles'

type MemberFieldKey = 'name' | 'email' | 'role' | 'departmentId' | 'userId' | 'nextStatus'

export type MemberActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  fieldErrors: Partial<Record<MemberFieldKey, string>>
}

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
}

function zodFieldErrors(error: z.ZodError): Partial<Record<MemberFieldKey, string>> {
  const errors: Partial<Record<MemberFieldKey, string>> = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (
      key === 'name' ||
      key === 'email' ||
      key === 'role' ||
      key === 'departmentId' ||
      key === 'userId' ||
      key === 'nextStatus'
    ) {
      if (!errors[key]) {
        errors[key] = issue.message
      }
    }
  }

  return errors
}

function actionSuccess(message: string): MemberActionState {
  return {
    status: 'success',
    message,
    fieldErrors: {},
  }
}

function actionError(
  message: string,
  fieldErrors: Partial<Record<MemberFieldKey, string>> = {},
): MemberActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function appBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function isResendInviteEnabled() {
  return process.env.ENABLE_RESEND_MEMBER_INVITES === 'true'
}

function hasConfiguredResendKey() {
  const key = process.env.RESEND_API_KEY
  return Boolean(key && !key.startsWith('your_'))
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

async function upsertCompanyMembership(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
  role: Role,
  isActive: boolean,
) {
  const { error } = await admin.from('company_memberships').upsert(
    {
      company_id: companyId,
      user_id: userId,
      role,
      is_active: isActive,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,user_id' },
  )

  if (error) {
    return { ok: false as const, message: membershipErrorMessage(error.message) }
  }

  return { ok: true as const }
}

async function syncProfileForActiveCompany(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
  updates: {
    role?: Role
    isActive?: boolean
  },
) {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile || profile.company_id !== companyId) {
    return { ok: true as const }
  }

  const payload: {
    updated_at: string
    role?: Role
    is_active?: boolean
    deleted_at?: null
  } = {
    updated_at: new Date().toISOString(),
  }

  if (updates.role) {
    payload.role = updates.role
  }

  if (typeof updates.isActive === 'boolean') {
    payload.is_active = updates.isActive
    payload.deleted_at = null
  }

  const { error: updateError } = await admin.from('profiles').update(payload).eq('user_id', userId)

  if (updateError) {
    return { ok: false as const, message: formatDatabaseError(updateError.message) }
  }

  return { ok: true as const }
}

async function getActorContext() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.',
    }
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

  const { data: actorMembership, error: actorMembershipError } = await admin
    .from('company_memberships')
    .select('role, is_active')
    .eq('company_id', profile.company_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (actorMembershipError) {
    return { ok: false as const, message: membershipErrorMessage(actorMembershipError.message) }
  }

  const actorRole = actorMembership?.role ?? profile.role
  if (!isRole(actorRole) || actorMembership?.is_active === false) {
    return { ok: false as const, message: 'Active company membership not found.' }
  }

  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('name')
    .eq('company_id', profile.company_id)
    .maybeSingle()

  if (companyError) {
    return { ok: false as const, message: formatDatabaseError(companyError.message) }
  }

  return {
    ok: true as const,
    admin,
    userId: user.id,
    companyId: profile.company_id as string,
    role: actorRole,
    companyName: company?.name ?? 'your company',
  }
}

async function findAuthUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  let page = 1
  const normalizedEmail = email.toLowerCase()

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      return { user: null, error: error.message }
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail) ?? null
    if (user) {
      return { user, error: null }
    }

    if (data.users.length < 200) {
      break
    }

    page += 1
  }

  return { user: null, error: null }
}

async function resolveDepartmentIdsForCompany(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
) {
  const { data: departmentsData, error: departmentsError } = await admin
    .from('departments')
    .select('department_id')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  if (departmentsError) {
    return { ok: false as const, message: formatDatabaseError(departmentsError.message), departmentIds: [] as string[] }
  }

  const departmentIds = (departmentsData ?? []).map((department) => department.department_id as string)
  return { ok: true as const, departmentIds }
}

async function clearMemberDepartments(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
) {
  const departmentIdsResult = await resolveDepartmentIdsForCompany(admin, companyId)
  if (!departmentIdsResult.ok) {
    return departmentIdsResult
  }

  if (departmentIdsResult.departmentIds.length === 0) {
    return { ok: true as const }
  }

  const { error: clearError } = await admin
    .from('department_members')
    .update({
      is_active: false,
      deleted_at: null,
      end_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('department_id', departmentIdsResult.departmentIds)

  if (clearError) {
    return { ok: false as const, message: formatDatabaseError(clearError.message) }
  }

  return { ok: true as const }
}

export async function createMemberAction(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = createMemberSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    role: field(formData, 'role'),
    departmentId: field(formData, 'departmentId'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  if (context.role !== 'owner' && parsed.data.role === 'owner') {
    return actionError('Only owners can invite another owner.', {
      role: 'Only owners can invite another owner.',
    })
  }

  const inviteRedirectTo = `${appBaseUrl()}${ROUTES.CREATE_PASSWORD}`
  const normalizedEmail = parsed.data.email.toLowerCase()

  const existingAuthUserResult = await findAuthUserByEmail(context.admin, normalizedEmail)
  if (existingAuthUserResult.error) {
    return actionError(existingAuthUserResult.error)
  }

  let invitedNow = false
  let targetUserId = existingAuthUserResult.user?.id ?? ''

  if (!targetUserId) {
    const { data: inviteData, error: inviteError } = await context.admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: {
          name: parsed.data.name,
        },
        redirectTo: inviteRedirectTo,
      },
    )

    if (inviteError || !inviteData.user?.id) {
      const fallbackAuthUserResult = await findAuthUserByEmail(context.admin, normalizedEmail)
      if (fallbackAuthUserResult.error) {
        return actionError(fallbackAuthUserResult.error)
      }

      if (!fallbackAuthUserResult.user?.id) {
        return actionError(formatDatabaseError(inviteError?.message ?? 'Unable to create invited user.'))
      }

      targetUserId = fallbackAuthUserResult.user.id
    } else {
      targetUserId = inviteData.user.id
      invitedNow = true
    }
  }

  if (!targetUserId) {
    return actionError('Unable to resolve invited user.')
  }

  const { data: existingProfile, error: existingProfileError } = await context.admin
    .from('profiles')
    .select('company_id, name')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (existingProfileError) {
    return actionError(formatDatabaseError(existingProfileError.message))
  }

  const nextName = parsed.data.name.trim()
  if (existingProfile) {
    const shouldUpdateName = (existingProfile.name ?? '').trim() !== nextName
    if (shouldUpdateName) {
      const { error: updateProfileError } = await context.admin
        .from('profiles')
        .update({
          name: nextName,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', targetUserId)

      if (updateProfileError) {
        return actionError(formatDatabaseError(updateProfileError.message))
      }
    }
  } else {
    const { error: insertProfileError } = await context.admin.from('profiles').insert({
      user_id: targetUserId,
      company_id: context.companyId,
      name: nextName,
      role: parsed.data.role,
      is_active: true,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })

    if (insertProfileError) {
      return actionError(formatDatabaseError(insertProfileError.message))
    }
  }

  const upsertMembershipResult = await upsertCompanyMembership(
    context.admin,
    context.companyId,
    targetUserId,
    parsed.data.role,
    true,
  )
  if (!upsertMembershipResult.ok) {
    return actionError(upsertMembershipResult.message)
  }

  const syncProfileResult = await syncProfileForActiveCompany(context.admin, context.companyId, targetUserId, {
    role: parsed.data.role,
    isActive: true,
  })
  if (!syncProfileResult.ok) {
    return actionError(syncProfileResult.message)
  }

  const clearDepartmentsResult = await clearMemberDepartments(context.admin, context.companyId, targetUserId)
  if (!clearDepartmentsResult.ok) {
    return actionError(clearDepartmentsResult.message)
  }

  if (parsed.data.departmentId) {
    const { data: department, error: departmentError } = await context.admin
      .from('departments')
      .select('department_id')
      .eq('department_id', parsed.data.departmentId)
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (departmentError) {
      return actionError(formatDatabaseError(departmentError.message))
    }

    if (!department) {
      return actionError('Department not found.', {
        departmentId: 'Select a valid active department.',
      })
    }

    const { error: assignmentError } = await context.admin.from('department_members').upsert(
      {
        department_id: department.department_id,
        user_id: targetUserId,
        member_role: 'member',
        is_active: true,
        deleted_at: null,
        end_date: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'department_id,user_id' },
    )

    if (assignmentError) {
      return actionError(formatDatabaseError(assignmentError.message))
    }
  }

  let inviteSent = invitedNow
  let inviteFailed = false

  if (isResendInviteEnabled() && hasConfiguredResendKey()) {
    const inviteUrl = `${appBaseUrl()}${ROUTES.CREATE_PASSWORD}?email=${encodeURIComponent(normalizedEmail)}`
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: `You're invited to ${context.companyName} on EchoRating`,
      html: InviteMemberTemplate({
        name: parsed.data.name,
        companyName: context.companyName,
        inviteUrl,
      }),
    })

    if (!emailResult.success) {
      inviteFailed = !invitedNow
    } else {
      inviteSent = true
    }
  }

  const emailMessage = inviteSent
    ? 'Invitation sent. Check invitee inbox.'
    : inviteFailed
      ? 'Member added, but we could not send the invitation email. Please try again.'
      : 'Member added successfully.'

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess(emailMessage)
}

export async function updateMemberRoleAction(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = updateMemberRoleSchema.safeParse({
    userId: field(formData, 'userId'),
    role: field(formData, 'role'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: targetMembership, error: targetMembershipError } = await context.admin
    .from('company_memberships')
    .select('user_id, role')
    .eq('user_id', parsed.data.userId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (targetMembershipError) {
    return actionError(membershipErrorMessage(targetMembershipError.message))
  }

  if (!targetMembership) {
    return actionError('Member not found.', {
      userId: 'Member no longer exists.',
    })
  }

  if (context.role !== 'owner' && (targetMembership.role === 'owner' || parsed.data.role === 'owner')) {
    return actionError('Only owners can change owner roles.', {
      role: 'Only owners can change owner roles.',
    })
  }

  const { error: updateError } = await context.admin
    .from('company_memberships')
    .update({
      role: parsed.data.role,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetMembership.user_id)
    .eq('company_id', context.companyId)

  if (updateError) {
    return actionError(membershipErrorMessage(updateError.message))
  }

  const syncProfileResult = await syncProfileForActiveCompany(context.admin, context.companyId, targetMembership.user_id, {
    role: parsed.data.role,
  })
  if (!syncProfileResult.ok) {
    return actionError(syncProfileResult.message)
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Member role updated.')
}

export async function assignMemberDepartmentAction(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = assignMemberDepartmentSchema.safeParse({
    userId: field(formData, 'userId'),
    departmentId: field(formData, 'departmentId'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: targetMembership, error: targetMembershipError } = await context.admin
    .from('company_memberships')
    .select('user_id, is_active')
    .eq('user_id', parsed.data.userId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (targetMembershipError) {
    return actionError(membershipErrorMessage(targetMembershipError.message))
  }

  if (!targetMembership) {
    return actionError('Member not found.', {
      userId: 'Member no longer exists.',
    })
  }

  if (!targetMembership.is_active) {
    return actionError('Cannot assign departments to an inactive member.')
  }

  if (parsed.data.departmentId) {
    const { data: department, error: departmentError } = await context.admin
      .from('departments')
      .select('department_id')
      .eq('department_id', parsed.data.departmentId)
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (departmentError) {
      return actionError(formatDatabaseError(departmentError.message))
    }

    if (!department) {
      return actionError('Department not found.', {
        departmentId: 'Select a valid active department.',
      })
    }
  }

  const clearDepartmentsResult = await clearMemberDepartments(context.admin, context.companyId, parsed.data.userId)
  if (!clearDepartmentsResult.ok) {
    return actionError(clearDepartmentsResult.message)
  }

  if (parsed.data.departmentId) {
    const { error: upsertError } = await context.admin.from('department_members').upsert(
      {
        department_id: parsed.data.departmentId,
        user_id: parsed.data.userId,
        member_role: 'member',
        is_active: true,
        deleted_at: null,
        end_date: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'department_id,user_id' },
    )

    if (upsertError) {
      return actionError(formatDatabaseError(upsertError.message))
    }
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Member department updated.')
}

export async function toggleMemberStatusAction(formData: FormData): Promise<MemberActionState> {
  const parsed = toggleMemberStatusSchema.safeParse({
    userId: field(formData, 'userId'),
    nextStatus: field(formData, 'nextStatus'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: targetMembership, error: targetMembershipError } = await context.admin
    .from('company_memberships')
    .select('user_id, role, is_active')
    .eq('user_id', parsed.data.userId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (targetMembershipError || !targetMembership) {
    return actionError(membershipErrorMessage(targetMembershipError?.message ?? 'Member not found.'), {
      userId: 'Member not found.',
    })
  }

  if (targetMembership.user_id === context.userId && parsed.data.nextStatus === 'inactive') {
    return actionError('You cannot deactivate your own account.')
  }

  if (context.role !== 'owner' && targetMembership.role === 'owner') {
    return actionError('Only owners can change owner status.')
  }

  const nextActive = parsed.data.nextStatus === 'active'
  if (targetMembership.is_active === nextActive) {
    return actionSuccess(nextActive ? 'Member is already active.' : 'Member is already inactive.')
  }

  const { error: updateMembershipError } = await context.admin
    .from('company_memberships')
    .update({
      is_active: nextActive,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetMembership.user_id)
    .eq('company_id', context.companyId)

  if (updateMembershipError) {
    return actionError(membershipErrorMessage(updateMembershipError.message))
  }

  const syncProfileResult = await syncProfileForActiveCompany(context.admin, context.companyId, targetMembership.user_id, {
    isActive: nextActive,
  })
  if (!syncProfileResult.ok) {
    return actionError(syncProfileResult.message)
  }

  if (!nextActive) {
    const clearDepartmentsResult = await clearMemberDepartments(context.admin, context.companyId, targetMembership.user_id)
    if (!clearDepartmentsResult.ok) {
      return actionError(clearDepartmentsResult.message)
    }
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess(nextActive ? 'Member activated.' : 'Member deactivated.')
}
