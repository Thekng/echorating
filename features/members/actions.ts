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

function hasConfiguredResendKey() {
  const key = process.env.RESEND_API_KEY
  return Boolean(key && !key.startsWith('your_'))
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

async function getInviteActorContext() {
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
    .select('company_id, name, is_active, deleted_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || profile.is_active === false || profile.deleted_at) {
    return { ok: false as const, message: 'Company profile not found.' }
  }

  const { data: membership, error: membershipError } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', profile.company_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership || !isRole(membership.role)) {
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
    inviterName: profile.name,
    companyId: profile.company_id as string,
    role: membership.role,
    companyName: company?.name ?? 'your company',
  }
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
    .from('company_members')
    .select('role')
    .eq('company_id', profile.company_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (actorMembershipError) {
    return { ok: false as const, message: formatDatabaseError(actorMembershipError.message) }
  }

  const actorRole = actorMembership?.role ?? profile.role
  if (!isRole(actorRole) || profile.is_active === false) {
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

async function getTargetCompanyMember(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
) {
  const { data: membership, error: membershipError } = await admin
    .from('company_members')
    .select('user_id, role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership || !isRole(membership.role)) {
    return { ok: false as const, message: 'Member not found.' }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_active')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  return {
    ok: true as const,
    membership: {
      user_id: membership.user_id as string,
      role: membership.role,
      is_active: profile?.is_active !== false,
    },
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

export async function acceptInviteAction(invitationId: string) {
  if (!invitationId) {
    return { success: false as const, message: 'Invitation is required.' }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false as const,
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
    return { success: false as const, message: 'Authentication required.' }
  }

  const { data: invitation, error: invitationError } = await admin
    .from('invitations')
    .select('invitation_id, company_id, email, role, department_id, status, expires_at, auth_user_id')
    .eq('invitation_id', invitationId)
    .maybeSingle()

  if (invitationError) {
    return { success: false as const, message: formatDatabaseError(invitationError.message) }
  }

  if (!invitation) {
    return { success: false as const, message: 'This invite link has expired. Please ask to be invited again.' }
  }

  if (invitation.auth_user_id && invitation.auth_user_id !== user.id) {
    return { success: false as const, message: 'This invite link has expired. Please ask to be invited again.' }
  }

  if (invitation.status === 'revoked') {
    return { success: false as const, message: 'This invite has been revoked.' }
  }

  if (invitation.status !== 'pending' || invitation.expires_at <= new Date().toISOString()) {
    return { success: false as const, message: 'This invite link has expired. Please ask to be invited again.' }
  }

  const nowIso = new Date().toISOString()

  const { data: existingProfile, error: existingProfileError } = await admin
    .from('profiles')
    .select('user_id, company_id, name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingProfileError) {
    return { success: false as const, message: formatDatabaseError(existingProfileError.message) }
  }

  if (existingProfile) {
    const { error: updateProfileError } = await admin
      .from('profiles')
      .update({
        is_active: true,
        deleted_at: null,
        updated_at: nowIso,
      })
      .eq('user_id', user.id)

    if (updateProfileError) {
      return { success: false as const, message: formatDatabaseError(updateProfileError.message) }
    }
  } else {
    const profileName =
      typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
        ? user.user_metadata.name.trim()
        : (user.email ?? invitation.email)

    const { error: insertProfileError } = await admin.from('profiles').insert({
      user_id: user.id,
      company_id: invitation.company_id,
      name: profileName,
      role: invitation.role,
      is_active: true,
      deleted_at: null,
      updated_at: nowIso,
    })

    if (insertProfileError) {
      return { success: false as const, message: formatDatabaseError(insertProfileError.message) }
    }
  }

  const { error: membershipError } = await admin.from('company_members').upsert(
    {
      user_id: user.id,
      company_id: invitation.company_id,
      role: invitation.role,
      updated_at: nowIso,
    },
    { onConflict: 'user_id,company_id' },
  )

  if (membershipError) {
    return { success: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (invitation.department_id) {
    const { error: departmentMemberError } = await admin.from('department_members').upsert(
      {
        department_id: invitation.department_id,
        user_id: user.id,
        member_role: 'member',
        is_active: true,
        deleted_at: null,
        end_date: null,
        updated_at: nowIso,
      },
      { onConflict: 'department_id,user_id' },
    )

    if (departmentMemberError) {
      return { success: false as const, message: formatDatabaseError(departmentMemberError.message) }
    }
  }

  const { error: acceptError } = await admin
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('invitation_id', invitation.invitation_id)

  if (acceptError) {
    return { success: false as const, message: formatDatabaseError(acceptError.message) }
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return { success: true as const, companyId: invitation.company_id }
}

export async function revokeInviteAction(invitationId: string): Promise<MemberActionState> {
  if (!invitationId) {
    return actionError('Invitation is required.')
  }

  const context = await getInviteActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: invitation, error: invitationError } = await context.admin
    .from('invitations')
    .select('invitation_id')
    .eq('invitation_id', invitationId)
    .eq('company_id', context.companyId)
    .eq('status', 'pending')
    .maybeSingle()

  if (invitationError) {
    return actionError(formatDatabaseError(invitationError.message))
  }

  if (!invitation) {
    return actionError('Pending invitation not found.')
  }

  const { error: revokeError } = await context.admin
    .from('invitations')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('invitation_id', invitationId)

  if (revokeError) {
    return actionError(formatDatabaseError(revokeError.message))
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Invitation revoked.')
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

  if (parsed.data.role === 'owner') {
    return actionError('Only members and managers can be invited.', {
      role: 'Only members and managers can be invited.',
    })
  }

  const context = await getInviteActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError("You don't have permission to invite members.")
  }

  const normalizedEmail = parsed.data.email.toLowerCase()
  const inviteeName = parsed.data.name.trim()
  const existingAuthUserResult = await findAuthUserByEmail(context.admin, normalizedEmail)

  if (existingAuthUserResult.error) {
    return actionError(existingAuthUserResult.error)
  }

  const existingAuthUserId = existingAuthUserResult.user?.id ?? ''

  const nowIso = new Date().toISOString()
  const nextExpiryIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

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

  if (existingAuthUserId) {
    const { data: existingMembership, error: existingMembershipError } = await context.admin
      .from('company_members')
      .select('user_id')
      .eq('company_id', context.companyId)
      .eq('user_id', existingAuthUserId)
      .maybeSingle()

    if (existingMembershipError) {
      return actionError(formatDatabaseError(existingMembershipError.message))
    }

    if (existingMembership) {
      return actionError('This person is already a member of your company.', {
        email: 'This person is already a member of your company.',
      })
    }
  }

  const { data: pendingInvite, error: pendingInviteError } = await context.admin
    .from('invitations')
    .select('invitation_id, resent_count')
    .eq('company_id', context.companyId)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendingInviteError) {
    return actionError(formatDatabaseError(pendingInviteError.message))
  }

  let invitationId = pendingInvite?.invitation_id ?? ''

  if (pendingInvite) {
    const { error: updateInviteError } = await context.admin
      .from('invitations')
      .update({
        name: inviteeName,
        role: parsed.data.role,
        department_id: parsed.data.departmentId ?? null,
        invited_by: context.userId,
        status: 'pending',
        expires_at: nextExpiryIso,
        last_sent_at: nowIso,
        resent_count: pendingInvite.resent_count + 1,
        updated_at: nowIso,
      })
      .eq('invitation_id', pendingInvite.invitation_id)

    if (updateInviteError) {
      return actionError(formatDatabaseError(updateInviteError.message))
    }

    invitationId = pendingInvite.invitation_id
  } else {
    const { data: createdInvite, error: createInviteError } = await context.admin
      .from('invitations')
      .insert({
        company_id: context.companyId,
        name: inviteeName,
        email: normalizedEmail,
        role: parsed.data.role,
        department_id: parsed.data.departmentId ?? null,
        invited_by: context.userId,
        status: 'pending',
        expires_at: nextExpiryIso,
        updated_at: nowIso,
      })
      .select('invitation_id')
      .single()

    if (createInviteError || !createdInvite?.invitation_id) {
      return actionError(formatDatabaseError(createInviteError?.message ?? 'Unable to create invitation.'))
    }

    invitationId = createdInvite.invitation_id
  }

  const inviteRedirectPath = '/invite/accept'
  const inviteRedirectTo = `${appBaseUrl()}${inviteRedirectPath}`

  const { data: inviteData, error: inviteError } = await context.admin.auth.admin.inviteUserByEmail(
    normalizedEmail,
    {
      redirectTo: inviteRedirectTo,
    },
  )

  let targetUserId = inviteData.user?.id ?? ''
  if (!targetUserId) {
    targetUserId = existingAuthUserId
  }

  if (inviteError && !targetUserId) {
    return actionError(formatDatabaseError(inviteError.message))
  }

  if (targetUserId) {
    const { error: updateInviteUserError } = await context.admin
      .from('invitations')
      .update({
        auth_user_id: targetUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('invitation_id', invitationId)

    if (updateInviteUserError) {
      return actionError(formatDatabaseError(updateInviteUserError.message))
    }
  }

  if (!hasConfiguredResendKey()) {
    return actionError('RESEND_API_KEY is missing in environment variables.')
  }

  const inviteUrl = `${appBaseUrl()}${inviteRedirectPath}`
  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: `You're invited to join ${context.companyName} on EchoRating`,
    html: InviteMemberTemplate({
      inviteeName,
      inviterName: context.inviterName ?? 'A team member',
      companyName: context.companyName,
      role: parsed.data.role,
      inviteUrl,
    }),
  })

  if (!emailResult.success) {
    return actionError('Invitation created, but we could not deliver the invite email.')
  }

  if (!pendingInvite) {
    const { error: updateInviteSentError } = await context.admin
      .from('invitations')
      .update({
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('invitation_id', invitationId)

    if (updateInviteSentError) {
      return actionError(formatDatabaseError(updateInviteSentError.message))
    }
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Invitation sent. Check invitee inbox.')
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

  const targetMemberResult = await getTargetCompanyMember(context.admin, context.companyId, parsed.data.userId)
  if (!targetMemberResult.ok) {
    return actionError('Member not found.', {
      userId: 'Member no longer exists.',
    })
  }

  const targetMembership = targetMemberResult.membership

  if (context.role !== 'owner' && (targetMembership.role === 'owner' || parsed.data.role === 'owner')) {
    return actionError('Only owners can change owner roles.', {
      role: 'Only owners can change owner roles.',
    })
  }

  const { error: updateError } = await context.admin
    .from('company_members')
    .update({
      role: parsed.data.role,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetMembership.user_id)
    .eq('company_id', context.companyId)

  if (updateError) {
    return actionError(formatDatabaseError(updateError.message))
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

  const targetMemberResult = await getTargetCompanyMember(context.admin, context.companyId, parsed.data.userId)
  if (!targetMemberResult.ok) {
    return actionError('Member not found.', {
      userId: 'Member no longer exists.',
    })
  }

  const targetMembership = targetMemberResult.membership

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

  const targetMemberResult = await getTargetCompanyMember(context.admin, context.companyId, parsed.data.userId)
  if (!targetMemberResult.ok) {
    return actionError(targetMemberResult.message, {
      userId: 'Member not found.',
    })
  }

  const targetMembership = targetMemberResult.membership

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
    .from('company_members')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetMembership.user_id)
    .eq('company_id', context.companyId)

  if (updateMembershipError) {
    return actionError(formatDatabaseError(updateMembershipError.message))
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
