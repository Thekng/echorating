'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  assignMemberDepartmentSchema,
  updateMemberRoleSchema,
  toggleMemberStatusSchema,
  createMemberSchema,
} from './schemas'
import { getActorContext } from '@/lib/supabase/actor-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { type Role, isRole } from '@/lib/rbac/roles'
import { syncSessionClaims } from '@/lib/supabase/session-claims'
import { logAuditEvent } from '@/lib/audit/log'

type MemberFieldKey = 'role' | 'departmentId' | 'userId' | 'nextStatus'

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

async function getTargetOrgMember(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
) {
  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership || !isRole(membership.role)) {
    return { ok: false as const, message: 'Member not found.' }
  }

  return {
    ok: true as const,
    membership: {
      user_id: membership.user_id as string,
      role: membership.role,
    },
  }
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

  const targetMemberResult = await getTargetOrgMember(context.admin, context.organizationId, parsed.data.userId)
  if (!targetMemberResult.ok) {
    return actionError('Member not found.', {
      userId: 'Member no longer exists.',
    })
  }

  const targetMembership = targetMemberResult.membership

  // Only owner can set owner/admin roles
  if (context.role !== 'owner' && (parsed.data.role === 'owner' || parsed.data.role === 'admin')) {
    return actionError('Only owners can assign owner or admin roles.', {
      role: 'Only owners can assign owner or admin roles.',
    })
  }

  // Cannot downgrade if the target is an owner and you're not an owner
  if (context.role !== 'owner' && targetMembership.role === 'owner') {
    return actionError('Only owners can change owner roles.', {
      role: 'Only owners can change owner roles.',
    })
  }

  // Cannot downgrade the last owner
  if (targetMembership.role === 'owner' && parsed.data.role !== 'owner') {
    const { data: ownerCount } = await context.admin
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .eq('role', 'owner')

    if ((ownerCount as unknown as number) <= 1 || (await context.admin
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .eq('role', 'owner')).count === 1) {
      return actionError('Cannot downgrade the last owner.', {
        role: 'There must be at least one owner.',
      })
    }
  }

  const { error: updateError } = await context.admin
    .from('organization_members')
    .update({
      role: parsed.data.role,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', parsed.data.userId)
    .eq('organization_id', context.organizationId)

  if (updateError) {
    return actionError(formatDatabaseError(updateError.message))
  }

  const newRole = isRole(parsed.data.role) ? parsed.data.role : null
  await syncSessionClaims(parsed.data.userId, context.organizationId, newRole)

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'member.role_updated',
    entityType: 'member',
    entityId: parsed.data.userId,
    metadata: { newRole: parsed.data.role, previousRole: targetMembership.role },
  })

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Member role updated.')
}

export async function removeMemberAction(
  formData: FormData,
): Promise<MemberActionState> {
  const userId = field(formData, 'userId')
  if (!userId) {
    return actionError('User ID is required.')
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

  const targetMemberResult = await getTargetOrgMember(context.admin, context.organizationId, userId)
  if (!targetMemberResult.ok) {
    return actionError(targetMemberResult.message)
  }

  // Cannot remove yourself
  if (userId === context.userId) {
    return actionError('You cannot remove yourself.')
  }

  // Cannot remove the last owner
  if (targetMemberResult.membership.role === 'owner') {
    const { count } = await context.admin
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      return actionError('Cannot remove the last owner.')
    }
  }

  // Only owner can remove owner/admin
  if (context.role !== 'owner' && (targetMemberResult.membership.role === 'owner' || targetMemberResult.membership.role === 'admin')) {
    return actionError('Only owners can remove owners or admins.')
  }

  // DELETE from organization_members (CASCADE removes department_members)
  const { error: deleteError } = await context.admin
    .from('organization_members')
    .delete()
    .eq('user_id', userId)
    .eq('organization_id', context.organizationId)

  if (deleteError) {
    return actionError(formatDatabaseError(deleteError.message))
  }

  await syncSessionClaims(userId, null, null)

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Member removed.')
}

export async function assignDepartmentAction(
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

  // Verify user is a member of the org
  const targetMemberResult = await getTargetOrgMember(context.admin, context.organizationId, parsed.data.userId)
  if (!targetMemberResult.ok) {
    return actionError('Member not found.', {
      userId: 'Member no longer exists.',
    })
  }

  if (!parsed.data.departmentId) {
    // Remove all department assignments for this user in this org
    const { data: orgDepts } = await context.admin
      .from('departments')
      .select('id')
      .eq('organization_id', context.organizationId)

    const deptIds = (orgDepts ?? []).map((d) => (d as { id: string }).id)
    if (deptIds.length > 0) {
      await context.admin
        .from('department_members')
        .delete()
        .eq('user_id', parsed.data.userId)
        .in('department_id', deptIds)
    }

    revalidatePath(ROUTES.SETTINGS_MEMBERS)
    return actionSuccess('Member department updated.')
  }

  // Validate department belongs to org
  const { data: department, error: departmentError } = await context.admin
    .from('departments')
    .select('id')
    .eq('id', parsed.data.departmentId)
    .eq('organization_id', context.organizationId)
    .eq('is_active', true)
    .maybeSingle()

  if (departmentError) {
    return actionError(formatDatabaseError(departmentError.message))
  }

  if (!department) {
    return actionError('Department not found.', {
      departmentId: 'Select a valid active department.',
    })
  }

  // Remove existing assignments in this org, then upsert new one
  const { data: orgDepts } = await context.admin
    .from('departments')
    .select('id')
    .eq('organization_id', context.organizationId)

  const deptIds = (orgDepts ?? []).map((d) => (d as { id: string }).id)
  if (deptIds.length > 0) {
    await context.admin
      .from('department_members')
      .delete()
      .eq('user_id', parsed.data.userId)
      .in('department_id', deptIds)
  }

  const { error: upsertError } = await context.admin.from('department_members').upsert(
    {
      department_id: parsed.data.departmentId,
      user_id: parsed.data.userId,
      role: 'member',
    },
    { onConflict: 'department_id,user_id' },
  )

  if (upsertError) {
    return actionError(formatDatabaseError(upsertError.message))
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Member department updated.')
}

export async function removeDepartmentAssignmentAction(
  formData: FormData,
): Promise<MemberActionState> {
  const userId = field(formData, 'userId')
  const departmentId = field(formData, 'departmentId')

  if (!userId || !departmentId) {
    return actionError('User ID and department ID are required.')
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

  const { error } = await context.admin
    .from('department_members')
    .delete()
    .eq('user_id', userId)
    .eq('department_id', departmentId)

  if (error) {
    return actionError(formatDatabaseError(error.message))
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Department assignment removed.')
}

export async function updateDepartmentMemberRoleAction(
  formData: FormData,
): Promise<MemberActionState> {
  const userId = field(formData, 'userId')
  const departmentId = field(formData, 'departmentId')
  const role = field(formData, 'role')

  if (!userId || !departmentId || (role !== 'lead' && role !== 'member')) {
    return actionError('Invalid request.')
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

  const { error } = await context.admin
    .from('department_members')
    .update({ role })
    .eq('user_id', userId)
    .eq('department_id', departmentId)

  if (error) {
    return actionError(formatDatabaseError(error.message))
  }

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Department member role updated.')
}

export async function deactivateMemberAction(
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = toggleMemberStatusSchema.safeParse({
    userId: field(formData, 'userId'),
    nextStatus: 'inactive',
  })

  if (!parsed.success) {
    return actionError('Invalid request.')
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

  if (parsed.data.userId === context.userId) {
    return actionError('You cannot deactivate yourself.')
  }

  const targetMemberResult = await getTargetOrgMember(context.admin, context.organizationId, parsed.data.userId)
  if (!targetMemberResult.ok) {
    return actionError(targetMemberResult.message)
  }

  const targetRole = targetMemberResult.membership.role

  // Only owner can deactivate owner/admin
  if (context.role !== 'owner' && (targetRole === 'owner' || targetRole === 'admin')) {
    return actionError('Only owners can deactivate owners or admins.')
  }

  // Cannot deactivate the last owner
  if (targetRole === 'owner') {
    const { count } = await context.admin
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .eq('role', 'owner')
      .eq('is_active', true)

    if ((count ?? 0) <= 1) {
      return actionError('Cannot deactivate the last owner.')
    }
  }

  // Set is_active = false
  const { error: updateError } = await context.admin
    .from('organization_members')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', parsed.data.userId)
    .eq('organization_id', context.organizationId)

  if (updateError) {
    return actionError(formatDatabaseError(updateError.message))
  }

  // Remove from all departments in this org
  const { data: orgDepts } = await context.admin
    .from('departments')
    .select('id')
    .eq('organization_id', context.organizationId)

  const deptIds = (orgDepts ?? []).map((d) => (d as { id: string }).id)
  if (deptIds.length > 0) {
    await context.admin
      .from('department_members')
      .delete()
      .eq('user_id', parsed.data.userId)
      .in('department_id', deptIds)
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'member.deactivated',
    entityType: 'member',
    entityId: parsed.data.userId,
  })

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Member deactivated.')
}

export async function reactivateMemberAction(
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = toggleMemberStatusSchema.safeParse({
    userId: field(formData, 'userId'),
    nextStatus: 'active',
  })

  if (!parsed.success) {
    return actionError('Invalid request.')
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

  const { error: updateError } = await context.admin
    .from('organization_members')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('user_id', parsed.data.userId)
    .eq('organization_id', context.organizationId)

  if (updateError) {
    return actionError(formatDatabaseError(updateError.message))
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'member.reactivated',
    entityType: 'member',
    entityId: parsed.data.userId,
  })

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Member reactivated.')
}

export async function createMemberAction(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = createMemberSchema.safeParse({
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

  // Only owner can assign owner/admin roles
  if (context.role !== 'owner' && (parsed.data.role === 'owner' || parsed.data.role === 'admin')) {
    return actionError('Only owners can assign owner or admin roles.', {
      role: 'Only owners can assign owner or admin roles.',
    })
  }

  // Validate department if provided
  const departmentId = parsed.data.departmentId || null
  if (departmentId) {
    const { data: department, error: departmentError } = await context.admin
      .from('departments')
      .select('id')
      .eq('id', departmentId)
      .eq('organization_id', context.organizationId)
      .eq('is_active', true)
      .maybeSingle()

    if (departmentError || !department) {
      return actionError('Department not found.')
    }
  }

  // Look up user by email via admin auth API
  const { data: usersData, error: usersError } = await context.admin.auth.admin.listUsers()

  if (usersError) {
    return actionError('Failed to look up user.')
  }

  const existingUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase(),
  )

  if (existingUser) {
    // Check not already a member
    const { data: existingMember } = await context.admin
      .from('organization_members')
      .select('user_id')
      .eq('user_id', existingUser.id)
      .eq('organization_id', context.organizationId)
      .maybeSingle()

    if (existingMember) {
      return actionError('This user is already a member of this organization.')
    }

    // Insert into organization_members
    const { error: insertError } = await context.admin.from('organization_members').insert({
      organization_id: context.organizationId,
      user_id: existingUser.id,
      role: parsed.data.role,
      is_active: true,
    })

    if (insertError) {
      return actionError(formatDatabaseError(insertError.message))
    }

    // Optionally assign to department
    if (departmentId) {
      await context.admin.from('department_members').upsert(
        {
          department_id: departmentId,
          user_id: existingUser.id,
          role: 'member',
        },
        { onConflict: 'department_id,user_id' },
      )
    }

    await syncSessionClaims(existingUser.id, context.organizationId, parsed.data.role)

    logAuditEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      action: 'member.created',
      entityType: 'member',
      entityId: existingUser.id,
      metadata: { email: parsed.data.email, role: parsed.data.role },
    })

    revalidatePath(ROUTES.SETTINGS_MEMBERS)
    return actionSuccess('Member added successfully.')
  }

  // User doesn't exist — create invitation
  const { error: inviteError } = await context.admin
    .from('organization_invitations')
    .upsert(
      {
        organization_id: context.organizationId,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        department_id: departmentId,
        invited_by: context.userId,
        accepted_at: null,
      },
      { onConflict: 'organization_id,email' },
    )

  if (inviteError) {
    return actionError(formatDatabaseError(inviteError.message))
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'member.invited',
    entityType: 'member',
    entityId: parsed.data.email,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  })

  revalidatePath(ROUTES.SETTINGS_MEMBERS)
  return actionSuccess('Invitation created. They\'ll be added when they sign up.')
}

export async function acceptInviteAction(
  userId: string,
  email: string,
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  // Look up pending invitations by email
  const { data: invitations, error: invitationsError } = await admin
    .from('organization_invitations')
    .select('id, organization_id, role, department_id')
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)

  if (invitationsError || !invitations || invitations.length === 0) {
    return { success: false, message: 'No pending invitations found.' }
  }

  let acceptedCount = 0

  for (const invitation of invitations) {
    const orgId = invitation.organization_id as string
    const role = invitation.role as string
    const departmentId = invitation.department_id as string | null

    // Check not already a member
    const { data: existingMember } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (existingMember) {
      // Already a member, just mark invitation as accepted
      await admin
        .from('organization_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)
      continue
    }

    // Insert into organization_members
    const { error: insertError } = await admin.from('organization_members').insert({
      organization_id: orgId,
      user_id: userId,
      role,
      is_active: true,
    })

    if (insertError) {
      continue
    }

    // Optionally assign to department
    if (departmentId) {
      await admin.from('department_members').upsert(
        {
          department_id: departmentId,
          user_id: userId,
          role: 'member',
        },
        { onConflict: 'department_id,user_id' },
      )
    }

    // Mark invitation as accepted
    await admin
      .from('organization_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    acceptedCount += 1
  }

  if (acceptedCount > 0) {
    await syncSessionClaims(userId)
  }

  return {
    success: acceptedCount > 0,
    message: acceptedCount > 0
      ? `Joined ${acceptedCount} organization${acceptedCount > 1 ? 's' : ''}.`
      : 'No new organizations to join.',
  }
}
