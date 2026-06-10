'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { getSessionClaims } from '@/lib/supabase/session-claims'

export async function getCompanyDetails() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.',
      data: null,
    }
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Authentication required.', data: null }
  }

  const claims = getSessionClaims(user)
  if (!claims.active_organization_id) {
    return { success: false, error: 'No active organization selected.', data: null }
  }

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] =
    await Promise.all([
      admin
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', claims.active_organization_id)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle(),
    ])

  if (membershipError) {
    return { success: false, error: formatDatabaseError(membershipError.message), data: null }
  }

  if (profileError) {
    return { success: false, error: formatDatabaseError(profileError.message), data: null }
  }

  if (!membership?.role) {
    return { success: false, error: 'Active organization membership not found.', data: null }
  }

  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .select('id, name, timezone, status, created_at, updated_at')
    .eq('id', claims.active_organization_id)
    .maybeSingle()

  if (organizationError) {
    return { success: false, error: formatDatabaseError(organizationError.message), data: null }
  }

  if (!organization) {
    return { success: false, error: 'Organization not found.', data: null }
  }

  return {
    success: true,
    data: {
      company: organization,
      role: membership.role,
      profileName: profile?.full_name ?? null,
    },
  }
}
