'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { onboardingSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { syncSessionClaims } from '@/lib/supabase/session-claims'

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
    organizationName: field(formData, 'organizationName'),
    slug: field(formData, 'slug'),
    industry: field(formData, 'industry'),
    locationName: field(formData, 'locationName'),
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

  const { data: organizationId, error: provisionError } = await admin.rpc(
    'provision_organization',
    {
      p_user_id: user.id,
      p_name: parsed.data.organizationName,
      p_slug: parsed.data.slug,
      p_timezone: parsed.data.timezone,
      p_industry: parsed.data.industry,
      p_location_name: parsed.data.locationName,
    },
  )

  if (provisionError) {
    const missingRpc = provisionError.message.includes('provision_organization')

    if (missingRpc) {
      return {
        status: 'error',
        message:
          'Database migration missing: run the Phase 2 migration in Supabase.',
      }
    }

    return { status: 'error', message: formatDatabaseError(provisionError.message) }
  }

  if (!organizationId) {
    return { status: 'error', message: 'Organization creation failed.' }
  }

  await syncSessionClaims(user.id, organizationId, 'owner')

  redirect(ROUTES.DASHBOARD)
}
