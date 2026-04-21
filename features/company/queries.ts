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
  if (!claims.active_company_id) {
    return { success: false, error: 'No active company selected.', data: null }
  }

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] =
    await Promise.all([
      admin
        .from('company_members')
        .select('role, is_active')
        .eq('user_id', user.id)
        .eq('company_id', claims.active_company_id)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

  if (membershipError) {
    return { success: false, error: formatDatabaseError(membershipError.message), data: null }
  }

  if (profileError) {
    return { success: false, error: formatDatabaseError(profileError.message), data: null }
  }

  if (!membership?.role || membership.is_active === false) {
    return { success: false, error: 'Active company membership not found.', data: null }
  }

  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('company_id, name, timezone, is_active, created_at, updated_at, contact_email, owner_user_id')
    .eq('company_id', claims.active_company_id)
    .maybeSingle()

  if (companyError) {
    return { success: false, error: formatDatabaseError(companyError.message), data: null }
  }

  if (!company) {
    return { success: false, error: 'Company not found.', data: null }
  }

  return {
    success: true,
    data: {
      company,
      role: membership.role,
      profileName: profile?.name ?? null,
    },
  }
}
