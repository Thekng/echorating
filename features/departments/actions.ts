'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { departmentIdSchema, departmentSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

type DepartmentFieldKey = 'departmentId' | 'name' | 'type'

export type DepartmentActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  fieldErrors: Partial<Record<DepartmentFieldKey, string>>
}

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function actionSuccess(message: string): DepartmentActionState {
  return {
    status: 'success',
    message,
    fieldErrors: {},
  }
}

function actionError(
  message: string,
  fieldErrors: Partial<Record<DepartmentFieldKey, string>> = {},
): DepartmentActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
}

function zodFieldErrors(error: z.ZodError): Partial<Record<DepartmentFieldKey, string>> {
  const errors: Partial<Record<DepartmentFieldKey, string>> = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (key === 'departmentId' || key === 'name' || key === 'type') {
      if (!errors[key]) {
        errors[key] = issue.message
      }
    }
  }

  return errors
}

function mapDepartmentDatabaseError(message: string): DepartmentActionState {
  const lowered = message.toLowerCase()
  if (lowered.includes('duplicate key value') || lowered.includes('idx_departments_company_name_active')) {
    return actionError('A department with this name already exists.', {
      name: 'This department name is already in use.',
    })
  }

  return actionError(formatDatabaseError(message))
}

function requiresLegacyMetricColumns(message: string) {
  const lowered = message.toLowerCase()
  return (
    lowered.includes('null value in column "direction"') ||
    lowered.includes('null value in column "precision_scale"')
  )
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
  const payload = {
    company_id: companyId,
    department_id: departmentId,
    name: 'Follow-Ups Completed',
    code: 'follow_ups_completed',
    description: 'Daily follow-up completion flag',
    data_type: 'boolean',
    unit: 'bool',
    input_mode: 'manual',
    is_active: true,
  }

  const firstAttempt = await admin.from('metrics').insert(payload)
  if (!firstAttempt.error) {
    return { ok: true as const }
  }

  if (!requiresLegacyMetricColumns(firstAttempt.error.message)) {
    return { ok: false as const, message: formatDatabaseError(firstAttempt.error.message) }
  }

  const { error } = await admin.from('metrics').insert({
    ...payload,
    direction: 'higher_is_better',
    precision_scale: 0,
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
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
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
    if (error) {
      return mapDepartmentDatabaseError(error.message)
    }

    return actionError('Failed to create department.')
  }

  const bootstrapMetrics = await createDefaultDepartmentMetrics(
    context.admin,
    context.companyId,
    department.department_id as string,
  )
  if (!bootstrapMetrics.ok) {
    return actionError(bootstrapMetrics.message)
  }

  revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
  return actionSuccess('Department created.')
}

export async function updateDepartmentAction(
  _prevState: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const idParsed = departmentIdSchema.safeParse({
    departmentId: field(formData, 'departmentId'),
  })
  const parsed = departmentSchema.safeParse({
    name: field(formData, 'name'),
    type: field(formData, 'type'),
  })

  if (!idParsed.success) {
    return actionError(zodMessage(idParsed.error), zodFieldErrors(idParsed.error))
  }

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: currentDepartment, error: departmentLookupError } = await context.admin
    .from('departments')
    .select('department_id')
    .eq('department_id', idParsed.data.departmentId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (departmentLookupError) {
    return actionError(formatDatabaseError(departmentLookupError.message))
  }

  if (!currentDepartment) {
    return actionError('Department not found.', {
      departmentId: 'Department no longer exists.',
    })
  }

  const { error } = await context.admin
    .from('departments')
    .update({
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      updated_at: new Date().toISOString(),
    })
    .eq('department_id', idParsed.data.departmentId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

  if (error) {
    return mapDepartmentDatabaseError(error.message)
  }

  revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
  return actionSuccess('Department updated.')
}

export async function deleteDepartmentAction(
  _prevState: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const idParsed = departmentIdSchema.safeParse({
    departmentId: field(formData, 'departmentId'),
  })

  if (!idParsed.success) {
    return actionError(zodMessage(idParsed.error), zodFieldErrors(idParsed.error))
  }

  const context = await getUserCompanyAndRole()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: existingDepartment, error: existingDepartmentError } = await context.admin
    .from('departments')
    .select('department_id, name')
    .eq('department_id', idParsed.data.departmentId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingDepartmentError) {
    return actionError(formatDatabaseError(existingDepartmentError.message))
  }

  if (!existingDepartment) {
    return actionError('Department not found.', {
      departmentId: 'Department no longer exists.',
    })
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const today = nowIso.slice(0, 10)

  const { error: membersUpdateError } = await context.admin
    .from('department_members')
    .update({
      is_active: false,
      end_date: today,
      updated_at: nowIso,
    })
    .eq('department_id', idParsed.data.departmentId)
    .is('deleted_at', null)

  if (membersUpdateError) {
    return actionError(formatDatabaseError(membersUpdateError.message))
  }

  const { error: targetsUpdateError } = await context.admin
    .from('targets')
    .update({
      is_active: false,
      deleted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('company_id', context.companyId)
    .eq('department_id', idParsed.data.departmentId)
    .is('deleted_at', null)

  if (targetsUpdateError) {
    return actionError(formatDatabaseError(targetsUpdateError.message))
  }

  const { error: metricsUpdateError } = await context.admin
    .from('metrics')
    .update({
      is_active: false,
      deleted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('company_id', context.companyId)
    .eq('department_id', idParsed.data.departmentId)
    .is('deleted_at', null)

  if (metricsUpdateError) {
    return actionError(formatDatabaseError(metricsUpdateError.message))
  }

  const { error: departmentDeleteError } = await context.admin
    .from('departments')
    .update({
      is_active: false,
      deleted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('department_id', idParsed.data.departmentId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

  if (departmentDeleteError) {
    return actionError(formatDatabaseError(departmentDeleteError.message))
  }

  revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
  return actionSuccess(`Department "${existingDepartment.name}" deleted.`)
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
    .is('deleted_at', null)

  revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
}
