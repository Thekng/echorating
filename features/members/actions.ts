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
import { type Role } from '@/lib/rbac/roles'

type MemberActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
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
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || !profile?.role) {
    return { ok: false as const, message: 'Company profile not found.' }
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
    role: profile.role as Role,
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
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { status: 'error', message: 'Insufficient permissions.' }
  }

  if (context.role !== 'owner' && parsed.data.role === 'owner') {
    return { status: 'error', message: 'Only owners can invite another owner.' }
  }

  const inviteRedirectTo = `${appBaseUrl()}${ROUTES.LOGIN}`
  const normalizedEmail = parsed.data.email.toLowerCase()

  const existingAuthUserResult = await findAuthUserByEmail(context.admin, normalizedEmail)
  if (existingAuthUserResult.error) {
    return { status: 'error', message: existingAuthUserResult.error }
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
        return { status: 'error', message: fallbackAuthUserResult.error }
      }

      if (!fallbackAuthUserResult.user?.id) {
        return {
          status: 'error',
          message: formatDatabaseError(inviteError?.message ?? 'Unable to create invited user.'),
        }
      }

      targetUserId = fallbackAuthUserResult.user.id
    } else {
      targetUserId = inviteData.user.id
      invitedNow = true
    }
  }

  if (!targetUserId) {
    return { status: 'error', message: 'Unable to resolve invited user.' }
  }

  const { data: existingProfile, error: existingProfileError } = await context.admin
    .from('profiles')
    .select('company_id')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (existingProfileError) {
    return { status: 'error', message: formatDatabaseError(existingProfileError.message) }
  }

  if (existingProfile?.company_id && existingProfile.company_id !== context.companyId) {
    return { status: 'error', message: 'This user already belongs to another company.' }
  }

  const { error: upsertProfileError } = await context.admin.from('profiles').upsert(
    {
      user_id: targetUserId,
      company_id: context.companyId,
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      is_active: true,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (upsertProfileError) {
    return { status: 'error', message: formatDatabaseError(upsertProfileError.message) }
  }

  const clearDepartmentsResult = await clearMemberDepartments(context.admin, context.companyId, targetUserId)
  if (!clearDepartmentsResult.ok) {
    return { status: 'error', message: clearDepartmentsResult.message }
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
      return { status: 'error', message: formatDatabaseError(departmentError.message) }
    }

    if (!department) {
      return { status: 'error', message: 'Department not found.' }
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
      return { status: 'error', message: formatDatabaseError(assignmentError.message) }
    }
  }

  let emailMessage = invitedNow
    ? 'Member invited and profile created.'
    : 'Member profile created for existing auth user.'

  if (isResendInviteEnabled() && hasConfiguredResendKey()) {
    const inviteUrl = `${appBaseUrl()}${ROUTES.LOGIN}?email=${encodeURIComponent(normalizedEmail)}`
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
      emailMessage += ' Invite email failed to send via Resend.'
    } else {
      emailMessage += ' Invite email sent via Resend.'
    }
  } else {
    emailMessage += ' Invite delivery configured via Supabase Auth email.'
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return { status: 'success', message: emailMessage }
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
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { status: 'error', message: 'Insufficient permissions.' }
  }

  const { data: targetProfile, error: targetProfileError } = await context.admin
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', parsed.data.userId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (targetProfileError) {
    return { status: 'error', message: formatDatabaseError(targetProfileError.message) }
  }

  if (!targetProfile) {
    return { status: 'error', message: 'Member not found.' }
  }

  if (context.role !== 'owner' && (targetProfile.role === 'owner' || parsed.data.role === 'owner')) {
    return { status: 'error', message: 'Only owners can change owner roles.' }
  }

  const { error: updateError } = await context.admin
    .from('profiles')
    .update({
      role: parsed.data.role,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetProfile.user_id)
    .eq('company_id', context.companyId)

  if (updateError) {
    return { status: 'error', message: formatDatabaseError(updateError.message) }
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return { status: 'success', message: 'Member role updated.' }
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
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { status: 'error', message: 'Insufficient permissions.' }
  }

  const { data: targetProfile, error: targetProfileError } = await context.admin
    .from('profiles')
    .select('user_id, is_active')
    .eq('user_id', parsed.data.userId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (targetProfileError) {
    return { status: 'error', message: formatDatabaseError(targetProfileError.message) }
  }

  if (!targetProfile) {
    return { status: 'error', message: 'Member not found.' }
  }

  if (!targetProfile.is_active) {
    return { status: 'error', message: 'Cannot assign departments to an inactive member.' }
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
      return { status: 'error', message: formatDatabaseError(departmentError.message) }
    }

    if (!department) {
      return { status: 'error', message: 'Department not found.' }
    }
  }

  const clearDepartmentsResult = await clearMemberDepartments(context.admin, context.companyId, parsed.data.userId)
  if (!clearDepartmentsResult.ok) {
    return { status: 'error', message: clearDepartmentsResult.message }
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
      return { status: 'error', message: formatDatabaseError(upsertError.message) }
    }
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return { status: 'success', message: 'Member department updated.' }
}

export async function toggleMemberStatusAction(formData: FormData) {
  const parsed = toggleMemberStatusSchema.safeParse({
    userId: field(formData, 'userId'),
    nextStatus: field(formData, 'nextStatus'),
  })

  if (!parsed.success) {
    return
  }

  const context = await getActorContext()
  if (!context.ok) {
    return
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return
  }

  const { data: targetProfile, error: targetProfileError } = await context.admin
    .from('profiles')
    .select('user_id, role, is_active')
    .eq('user_id', parsed.data.userId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (targetProfileError || !targetProfile) {
    return
  }

  if (targetProfile.user_id === context.userId && parsed.data.nextStatus === 'inactive') {
    return
  }

  if (context.role !== 'owner' && targetProfile.role === 'owner') {
    return
  }

  const nextActive = parsed.data.nextStatus === 'active'
  if (targetProfile.is_active === nextActive) {
    return
  }

  await context.admin
    .from('profiles')
    .update({
      is_active: nextActive,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetProfile.user_id)
    .eq('company_id', context.companyId)

  if (!nextActive) {
    await clearMemberDepartments(context.admin, context.companyId, targetProfile.user_id)
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
}
