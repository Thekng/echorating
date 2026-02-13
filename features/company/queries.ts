'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

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

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('company_id, role, name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { success: false, error: formatDatabaseError(profileError.message), data: null }
  }

  if (!profile?.company_id) {
    return { success: false, error: 'Company profile not found.', data: null }
  }

  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('company_id, name, timezone, is_active, created_at, updated_at')
    .eq('company_id', profile.company_id)
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
      role: profile.role,
      profileName: profile.name,
    },
  }
}
