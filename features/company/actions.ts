'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { companySchema, companyStatusSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

type CompanyActionState = {
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

async function getUserCompanyAndRole() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.',
    }
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, message: 'Authentication required.' }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || !profile?.role) {
    return { ok: false as const, message: 'Company profile not found.' }
  }

  return {
    ok: true as const,
    admin,
    companyId: profile.company_id as string,
    role: profile.role as string,
  }
}

export async function updateCompanyAction(
  _prevState: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const parsed = companySchema.safeParse({
    name: field(formData, 'name'),
    timezone: field(formData, 'timezone'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'owner')
  } catch {
    return { status: 'error', message: 'Only owners can update company settings.' }
  }

  const { error } = await context.admin
    .from('companies')
    .update({
      name: parsed.data.name.trim(),
      timezone: parsed.data.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', context.companyId)

  if (error) {
    return { status: 'error', message: formatDatabaseError(error.message) }
  }

  revalidatePath(ROUTES.SETTINGS_COMPANY)
  return { status: 'success', message: 'Company updated successfully.' }
}

export async function toggleCompanyStatusAction(formData: FormData) {
  const parsed = companyStatusSchema.safeParse({
    nextStatus: field(formData, 'nextStatus'),
  })

  if (!parsed.success) {
    return
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return
  }

  try {
    requireRole(context.role, 'owner')
  } catch {
    return
  }

  const nextActive = parsed.data.nextStatus === 'active'

  await context.admin
    .from('companies')
    .update({
      is_active: nextActive,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', context.companyId)

  revalidatePath(ROUTES.SETTINGS_COMPANY)
}
