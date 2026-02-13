'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { departmentSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

type DepartmentActionState = {
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

async function createDefaultDepartmentMetrics(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const { error } = await admin.from('metrics').insert({
    company_id: companyId,
    department_id: departmentId,
    name: 'Follow-Ups Completed',
    code: 'follow_ups_completed',
    description: 'Daily follow-up completion flag',
    data_type: 'boolean',
    unit: 'bool',
    direction: 'higher_is_better',
    input_mode: 'manual',
    precision_scale: 0,
    is_active: true,
  })

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message) }
  }

  return { ok: true as const }
}

export async function createDepartmentAction(
  _prevState: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const parsed = departmentSchema.safeParse({
    name: field(formData, 'name'),
    type: field(formData, 'type'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { status: 'error', message: 'Insufficient permissions.' }
  }

  const { data: department, error } = await context.admin
    .from('departments')
    .insert({
      company_id: context.companyId,
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      is_active: true,
    })
    .select('department_id')
    .maybeSingle()

  if (error || !department?.department_id) {
    return { status: 'error', message: formatDatabaseError(error?.message ?? 'Failed to create department.') }
  }

  const bootstrapMetrics = await createDefaultDepartmentMetrics(
    context.admin,
    context.companyId,
    department.department_id as string,
  )
  if (!bootstrapMetrics.ok) {
    return { status: 'error', message: bootstrapMetrics.message }
  }

  revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
  return { status: 'success', message: 'Department created.' }
}

export async function updateDepartmentAction(
  _prevState: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const departmentId = field(formData, 'departmentId')
  const parsed = departmentSchema.safeParse({
    name: field(formData, 'name'),
    type: field(formData, 'type'),
  })

  if (!departmentId) {
    return { status: 'error', message: 'Department id is required.' }
  }

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { status: 'error', message: 'Insufficient permissions.' }
  }

  const { error } = await context.admin
    .from('departments')
    .update({
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      updated_at: new Date().toISOString(),
    })
    .eq('department_id', departmentId)
    .eq('company_id', context.companyId)

  if (error) {
    return { status: 'error', message: formatDatabaseError(error.message) }
  }

  revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
  return { status: 'success', message: 'Department updated.' }
}

export async function toggleDepartmentStatusAction(formData: FormData) {
  const departmentId = field(formData, 'departmentId')
  const nextStatus = field(formData, 'nextStatus')
  const nextActive = nextStatus === 'active'

  if (!departmentId || !['active', 'inactive'].includes(nextStatus)) {
    return
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return
  }

  await context.admin
    .from('departments')
    .update({
      is_active: nextActive,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
    .eq('department_id', departmentId)
    .eq('company_id', context.companyId)

  revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
}
