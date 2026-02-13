'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  targetSchema,
  targetStatusSchema,
  upsertDailyDepartmentTargetSchema,
} from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { type Role } from '@/lib/rbac/roles'

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
}

async function getActorContext() {
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
    role: profile.role as Role,
  }
}

async function validateDepartmentAndMetric(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  metricId: string,
) {
  const { data: department, error: departmentError } = await admin
    .from('departments')
    .select('department_id')
    .eq('department_id', departmentId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (departmentError) {
    return { ok: false as const, message: formatDatabaseError(departmentError.message) }
  }

  if (!department) {
    return { ok: false as const, message: 'Department not found.' }
  }

  const { data: metric, error: metricError } = await admin
    .from('metrics')
    .select('metric_id')
    .eq('metric_id', metricId)
    .eq('department_id', departmentId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (metricError) {
    return { ok: false as const, message: formatDatabaseError(metricError.message) }
  }

  if (!metric) {
    return { ok: false as const, message: 'Metric not found or inactive for this department.' }
  }

  return { ok: true as const }
}

async function deactivateDailyDepartmentTarget(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  metricId: string,
) {
  const { error } = await admin
    .from('targets')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('metric_id', metricId)
    .eq('scope', 'department')
    .eq('period', 'daily')
    .is('user_id', null)
    .is('deleted_at', null)
    .eq('is_active', true)

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message) }
  }

  return { ok: true as const }
}

async function upsertDailyDepartmentTargetValue(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  metricId: string,
  value: number,
) {
  const { data: existingTarget, error: existingTargetError } = await admin
    .from('targets')
    .select('target_id')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('metric_id', metricId)
    .eq('scope', 'department')
    .eq('period', 'daily')
    .is('user_id', null)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingTargetError) {
    return { ok: false as const, message: formatDatabaseError(existingTargetError.message) }
  }

  if (existingTarget) {
    const { error: updateError } = await admin
      .from('targets')
      .update({
        value,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('target_id', existingTarget.target_id)
      .eq('company_id', companyId)

    if (updateError) {
      return { ok: false as const, message: formatDatabaseError(updateError.message) }
    }

    return { ok: true as const }
  }

  const { error: insertError } = await admin.from('targets').insert({
    company_id: companyId,
    department_id: departmentId,
    metric_id: metricId,
    scope: 'department',
    user_id: null,
    period: 'daily',
    value,
    is_active: true,
  })

  if (insertError) {
    return { ok: false as const, message: formatDatabaseError(insertError.message) }
  }

  return { ok: true as const }
}

export async function upsertDailyDepartmentTargetAction(
  formData: FormData,
): Promise<void> {
  const parsed = upsertDailyDepartmentTargetSchema.safeParse({
    metricId: field(formData, 'metricId'),
    departmentId: field(formData, 'departmentId'),
    value: field(formData, 'value'),
  })

  if (!parsed.success) {
    return
  }

  const context = await getActorContext()
  if (!context.ok) {
    return
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return
  }

  const validation = await validateDepartmentAndMetric(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
    parsed.data.metricId,
  )
  if (!validation.ok) {
    return
  }

  if (parsed.data.value === undefined) {
    const deactivateResult = await deactivateDailyDepartmentTarget(
      context.admin,
      context.companyId,
      parsed.data.departmentId,
      parsed.data.metricId,
    )

    if (!deactivateResult.ok) {
      return
    }

    revalidatePath(ROUTES.SETTINGS_METRICS)
    revalidatePath(ROUTES.SETTINGS_TARGETS)
    return
  }

  const upsertResult = await upsertDailyDepartmentTargetValue(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
    parsed.data.metricId,
    parsed.data.value,
  )

  if (!upsertResult.ok) {
    return
  }

  revalidatePath(ROUTES.SETTINGS_METRICS)
  revalidatePath(ROUTES.SETTINGS_TARGETS)
  return
}

export async function createTarget(
  data: z.infer<typeof targetSchema>,
): Promise<{ success: boolean; error?: string }> {
  const parsed = targetSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.' }
  }

  const validation = await validateDepartmentAndMetric(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
    parsed.data.metricId,
  )
  if (!validation.ok) {
    return { success: false, error: validation.message }
  }

  const upsertResult = await upsertDailyDepartmentTargetValue(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
    parsed.data.metricId,
    parsed.data.value,
  )

  if (!upsertResult.ok) {
    return { success: false, error: upsertResult.message }
  }

  revalidatePath(ROUTES.SETTINGS_TARGETS)
  return { success: true }
}

export async function updateTarget(
  id: string,
  data: z.infer<typeof targetSchema>,
): Promise<{ success: boolean; error?: string }> {
  if (!id) {
    return { success: false, error: 'Target id is required.' }
  }

  const parsed = targetSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.' }
  }

  const validation = await validateDepartmentAndMetric(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
    parsed.data.metricId,
  )
  if (!validation.ok) {
    return { success: false, error: validation.message }
  }

  const { error: updateError } = await context.admin
    .from('targets')
    .update({
      department_id: parsed.data.departmentId,
      metric_id: parsed.data.metricId,
      value: parsed.data.value,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('target_id', id)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

  if (updateError) {
    return { success: false, error: formatDatabaseError(updateError.message) }
  }

  revalidatePath(ROUTES.SETTINGS_TARGETS)
  return { success: true }
}

export async function deleteTarget(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id) {
    return { success: false, error: 'Target id is required.' }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { success: false, error: 'Insufficient permissions.' }
  }

  const { error } = await context.admin
    .from('targets')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('target_id', id)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

  if (error) {
    return { success: false, error: formatDatabaseError(error.message) }
  }

  revalidatePath(ROUTES.SETTINGS_TARGETS)
  return { success: true }
}

export async function toggleTargetStatusAction(formData: FormData) {
  const parsed = targetStatusSchema.safeParse({
    targetId: field(formData, 'targetId'),
    nextStatus: field(formData, 'nextStatus'),
  })

  if (!parsed.success) {
    return
  }

  const context = await getActorContext()
  if (!context.ok) {
    return
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return
  }

  await context.admin
    .from('targets')
    .update({
      is_active: parsed.data.nextStatus === 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('target_id', parsed.data.targetId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

  revalidatePath(ROUTES.SETTINGS_TARGETS)
}
