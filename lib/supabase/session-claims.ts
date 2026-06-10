import { createAdminClient } from './admin'
import { type Role, isRole } from '@/lib/rbac/roles'

export type SessionClaims = {
  active_organization_id: string | null
  active_role: Role | null
}

type MembershipRow = {
  organization_id: string
  role: Role
}

function pickActiveMembership(
  memberships: MembershipRow[],
  preferredOrganizationId: string | null,
): MembershipRow | null {
  if (preferredOrganizationId) {
    const preferred = memberships.find((membership) => membership.organization_id === preferredOrganizationId)
    if (preferred) {
      return preferred
    }
  }

  if (memberships.length === 1) {
    return memberships[0]
  }

  return null
}

export async function syncSessionClaims(
  userId: string,
  organizationId: string | null = null,
  _role: Role | null = null,
) {
  const admin = createAdminClient()
  const [{ data: userResult, error: userError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId),
    ])

  if (userError) {
    console.error('[SESSION_CLAIMS] Failed to load auth user for', userId, userError.message)
    return
  }

  if (membershipError) {
    console.error('[SESSION_CLAIMS] Failed to load memberships for', userId, membershipError.message)
    return
  }

  const existingClaims = getSessionClaims({
    app_metadata: (userResult.user?.app_metadata as Record<string, unknown> | undefined) ?? {},
  })

  const activeMembership = pickActiveMembership(
    ((memberships ?? []) as Array<{ organization_id: string; role: unknown }>)
      .filter((membership): membership is { organization_id: string; role: Role } => isRole(membership.role))
      .map((membership) => ({
        organization_id: membership.organization_id,
        role: membership.role,
      })),
    organizationId ?? existingClaims.active_organization_id,
  )

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...((userResult.user?.app_metadata as Record<string, unknown> | undefined) ?? {}),
      active_organization_id: activeMembership?.organization_id ?? null,
      active_role: activeMembership?.role ?? null,
    },
  })

  if (error) {
    console.error('[SESSION_CLAIMS] Failed to sync claims for user', userId, error.message)
  }
}

export function getSessionClaims(user: { app_metadata?: Record<string, unknown> }): SessionClaims {
  const meta = user.app_metadata ?? {}
  return {
    active_organization_id: typeof meta.active_organization_id === 'string' ? meta.active_organization_id : null,
    active_role: isValidRole(meta.active_role) ? meta.active_role : null,
  }
}

function isValidRole(value: unknown): value is Role {
  return value === 'owner' || value === 'admin' || value === 'manager' || value === 'member'
}
