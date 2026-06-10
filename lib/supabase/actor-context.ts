import { createClient } from './server'
import { createAdminClient } from './admin'
import { getSessionClaims } from './session-claims'
import { type Role, isRole } from '@/lib/rbac/roles'
import { formatDatabaseError } from './error-messages'

export type ActorContextError = {
  ok: false
  message: string
}

export type ActorContextSuccess = {
  ok: true
  admin: ReturnType<typeof createAdminClient>
  userId: string
  organizationId: string
  /** @deprecated Use organizationId instead. Kept for backward compatibility with legacy feature files. */
  companyId: string
  role: Role
}

export type ActorContext = ActorContextError | ActorContextSuccess

export async function getActorContext(): Promise<ActorContext> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.' }
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, message: 'Authentication required.' }
  }

  const claims = getSessionClaims(user)

  if (!claims.active_organization_id) {
    return { ok: false, message: 'No active organization. Complete onboarding or select an organization.' }
  }

  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', claims.active_organization_id)
    .maybeSingle()

  if (membershipError) {
    return { ok: false, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership || !isRole(membership.role)) {
    return { ok: false, message: 'Active organization membership not found.' }
  }

  return {
    ok: true,
    admin,
    userId: user.id,
    organizationId: claims.active_organization_id,
    companyId: claims.active_organization_id,
    role: membership.role,
  }
}
