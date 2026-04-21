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

  if (!claims.active_company_id) {
    return { ok: false, message: 'No active company. Complete onboarding or select a company.' }
  }

  const { data: membership, error: membershipError } = await admin
    .from('company_members')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('company_id', claims.active_company_id)
    .maybeSingle()

  if (membershipError) {
    return { ok: false, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership || !isRole(membership.role)) {
    return { ok: false, message: 'Active company membership not found.' }
  }

  if (membership.is_active === false) {
    return { ok: false, message: 'Your membership has been deactivated.' }
  }

  return {
    ok: true,
    admin,
    userId: user.id,
    companyId: claims.active_company_id,
    role: membership.role,
  }
}
