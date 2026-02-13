'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { onboardingSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

type OnboardingActionState = {
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

export async function completeOnboardingAction(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = onboardingSchema.safeParse({
    companyName: field(formData, 'companyName'),
    industry: field(formData, 'industry'),
    teamSize: field(formData, 'teamSize'),
    timezone: field(formData, 'timezone'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      status: 'error',
      message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { status: 'error', message: 'You need to be logged in to complete onboarding.' }
  }

  const admin = createAdminClient()

  const { data: existingProfile, error: existingProfileError } = await admin
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingProfileError) {
    return { status: 'error', message: formatDatabaseError(existingProfileError.message) }
  }

  if (existingProfile?.company_id) {
    redirect(ROUTES.DASHBOARD)
  }

  const profileName =
    typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
      ? user.user_metadata.name
      : user.email ?? 'User'

  const { data: companyId, error: createCompanyError } = await admin.rpc(
    'create_company_with_owner_profile',
    {
      p_user_id: user.id,
      p_user_name: profileName,
      p_company_name: parsed.data.companyName,
      p_timezone: parsed.data.timezone,
      p_industry: parsed.data.industry,
      p_team_size: parsed.data.teamSize,
    },
  )

  if (createCompanyError) {
    const missingRpc = createCompanyError.message.includes(
      'create_company_with_owner_profile',
    )

    if (missingRpc) {
      return {
        status: 'error',
        message:
          'Database migration missing: run 2026-02-13_onboarding_atomic_company.sql in Supabase.',
      }
    }

    return { status: 'error', message: formatDatabaseError(createCompanyError.message) }
  }

  if (!companyId) {
    return { status: 'error', message: 'Company creation failed.' }
  }

  redirect(ROUTES.DASHBOARD)
}
