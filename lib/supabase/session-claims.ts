import { createAdminClient } from './admin'
import { type Role } from '@/lib/rbac/roles'

export type SessionClaims = {
  active_company_id: string | null
  active_role: Role | null
}

export async function syncSessionClaims(
  userId: string,
  companyId: string | null,
  role: Role | null,
) {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      active_company_id: companyId,
      active_role: role,
    },
  })

  if (error) {
    console.error('[SESSION_CLAIMS] Failed to sync claims for user', userId, error.message)
  }
}

export function getSessionClaims(user: { app_metadata?: Record<string, unknown> }): SessionClaims {
  const meta = user.app_metadata ?? {}
  return {
    active_company_id: typeof meta.active_company_id === 'string' ? meta.active_company_id : null,
    active_role: isValidRole(meta.active_role) ? meta.active_role : null,
  }
}

function isValidRole(value: unknown): value is Role {
  return value === 'owner' || value === 'manager' || value === 'member'
}
