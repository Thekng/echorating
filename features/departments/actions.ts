'use server'

import { revalidatePath } from 'next/cache'
import { departmentIdSchema, departmentSchema } from './schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import {
  databaseFail,
  fail,
  formField,
  ok,
  parseWithZod,
  wrapAction,
  type ActionResult,
} from '@/lib/actions/wrap-action'

type DepartmentFieldKey = 'departmentId' | 'name' | 'type'

export type DepartmentActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  fieldErrors: Partial<Record<DepartmentFieldKey, string>>
}

function narrowFieldErrors(
  fieldErrors: Record<string, string> | undefined,
): Partial<Record<DepartmentFieldKey, string>> {
  if (!fieldErrors) return {}
  const out: Partial<Record<DepartmentFieldKey, string>> = {}
  for (const key of ['departmentId', 'name', 'type'] as const) {
    if (fieldErrors[key]) out[key] = fieldErrors[key]
  }
  return out
}

function toDepartmentState(
  result: ActionResult<unknown>,
  successMessage: string,
): DepartmentActionState {
  if (result.ok) {
    return { status: 'success', message: successMessage, fieldErrors: {} }
  }
  return {
    status: 'error',
    message: result.message,
    fieldErrors: narrowFieldErrors(result.fieldErrors),
  }
}

function mapDuplicateNameError(message: string) {
  const lowered = message.toLowerCase()
  if (lowered.includes('duplicate key value') || lowered.includes('idx_departments_company_name_active')) {
    return fail('database', 'A department with this name already exists.', {
      name: 'This department name is already in use.',
    })
  }
  return databaseFail(message)
}

function requiresLegacyMetricColumns(message: string) {
  const lowered = message.toLowerCase()
  return (
    lowered.includes('null value in column "direction"') ||
    lowered.includes('null value in column "precision_scale"')
  )
}

function isMissingMetricsSortOrderColumn(message: string) {
  return message.toLowerCase().includes('column metrics.sort_order does not exist')
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
    sort_order: 1,
    is_active: true,
  }

  const firstAttempt = await admin.from('metrics').insert(payload)
  if (!firstAttempt.error) {
    return { ok: true as const }
  }

  if (isMissingMetricsSortOrderColumn(firstAttempt.error.message)) {
    const withoutSortOrder = { ...payload }
    delete (withoutSortOrder as { sort_order?: number }).sort_order
    const retry = await admin.from('metrics').insert(withoutSortOrder)

    if (!retry.error) {
      return { ok: true as const }
    }

    if (!requiresLegacyMetricColumns(retry.error.message)) {
      return { ok: false as const, message: formatDatabaseError(retry.error.message) }
    }

    const { error: legacyRetryError } = await admin.from('metrics').insert({
      ...withoutSortOrder,
      direction: 'higher_is_better',
      precision_scale: 0,
    })

    if (legacyRetryError) {
      return { ok: false as const, message: formatDatabaseError(legacyRetryError.message) }
    }

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

const runCreateDepartment = wrapAction({
  name: 'createDepartment',
  role: 'manager',
  parse: (formData) =>
    parseWithZod(departmentSchema, {
      name: formField(formData, 'name'),
      type: formField(formData, 'type'),
    }),
  handler: async ({ input, context }) => {
    const { data: department, error } = await context.admin
      .from('departments')
      .insert({
        company_id: context.companyId,
        name: input.name.trim(),
        type: input.type,
        is_active: true,
      })
      .select('department_id')
      .maybeSingle()

    if (error) {
      return mapDuplicateNameError(error.message)
    }
    if (!department?.department_id) {
      return databaseFail('Failed to create department.')
    }

    const bootstrap = await createDefaultDepartmentMetrics(
      context.admin,
      context.companyId,
      department.department_id as string,
    )
    if (!bootstrap.ok) {
      return databaseFail(bootstrap.message)
    }

    revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
    return ok(undefined)
  },
})

export async function createDepartmentAction(
  _prevState: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const result = await runCreateDepartment(formData)
  return toDepartmentState(result, 'Department created.')
}

const runUpdateDepartment = wrapAction({
  name: 'updateDepartment',
  role: 'manager',
  parse: (formData) => {
    const id = parseWithZod(departmentIdSchema, {
      departmentId: formField(formData, 'departmentId'),
    })
    if (!id.ok) return id
    const body = parseWithZod(departmentSchema, {
      name: formField(formData, 'name'),
      type: formField(formData, 'type'),
    })
    if (!body.ok) return body
    return { ok: true, data: { ...id.data, ...body.data } }
  },
  handler: async ({ input, context }) => {
    const { data: current, error: lookupError } = await context.admin
      .from('departments')
      .select('department_id')
      .eq('department_id', input.departmentId)
      .eq('company_id', context.companyId)
      .is('deleted_at', null)
      .maybeSingle()

    if (lookupError) return databaseFail(lookupError.message)
    if (!current) {
      return fail('database', 'Department not found.', {
        departmentId: 'Department no longer exists.',
      })
    }

    const { error } = await context.admin
      .from('departments')
      .update({
        name: input.name.trim(),
        type: input.type,
        updated_at: new Date().toISOString(),
      })
      .eq('department_id', input.departmentId)
      .eq('company_id', context.companyId)
      .is('deleted_at', null)

    if (error) return mapDuplicateNameError(error.message)

    revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
    return ok(undefined)
  },
})

export async function updateDepartmentAction(
  _prevState: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const result = await runUpdateDepartment(formData)
  return toDepartmentState(result, 'Department updated.')
}

const runDeleteDepartment = wrapAction({
  name: 'deleteDepartment',
  role: 'manager',
  parse: (formData) =>
    parseWithZod(departmentIdSchema, {
      departmentId: formField(formData, 'departmentId'),
    }),
  handler: async ({ input, context }) => {
    const { data: existing, error: existingError } = await context.admin
      .from('departments')
      .select('department_id, name')
      .eq('department_id', input.departmentId)
      .eq('company_id', context.companyId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingError) return databaseFail(existingError.message)
    if (!existing) {
      return fail('database', 'Department not found.', {
        departmentId: 'Department no longer exists.',
      })
    }

    const nowIso = new Date().toISOString()
    const today = nowIso.slice(0, 10)

    const membersUpdate = await context.admin
      .from('department_members')
      .update({ is_active: false, end_date: today, updated_at: nowIso })
      .eq('department_id', input.departmentId)
      .is('deleted_at', null)
    if (membersUpdate.error) return databaseFail(membersUpdate.error.message)

    const targetsUpdate = await context.admin
      .from('targets')
      .update({ is_active: false, deleted_at: nowIso, updated_at: nowIso })
      .eq('company_id', context.companyId)
      .eq('department_id', input.departmentId)
      .is('deleted_at', null)
    if (targetsUpdate.error) return databaseFail(targetsUpdate.error.message)

    const metricsUpdate = await context.admin
      .from('metrics')
      .update({ is_active: false, deleted_at: nowIso, updated_at: nowIso })
      .eq('company_id', context.companyId)
      .eq('department_id', input.departmentId)
      .is('deleted_at', null)
    if (metricsUpdate.error) return databaseFail(metricsUpdate.error.message)

    const departmentUpdate = await context.admin
      .from('departments')
      .update({ is_active: false, deleted_at: nowIso, updated_at: nowIso })
      .eq('department_id', input.departmentId)
      .eq('company_id', context.companyId)
      .is('deleted_at', null)
    if (departmentUpdate.error) return databaseFail(departmentUpdate.error.message)

    revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
    return ok({ name: existing.name as string })
  },
})

export async function deleteDepartmentAction(
  _prevState: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const result = await runDeleteDepartment(formData)
  if (result.ok) {
    return {
      status: 'success',
      message: `Department "${result.data.name}" deleted.`,
      fieldErrors: {},
    }
  }
  return toDepartmentState(result, '')
}

const runToggleDepartmentStatus = wrapAction({
  name: 'toggleDepartmentStatus',
  role: 'manager',
  parse: (formData) => {
    const departmentId = formField(formData, 'departmentId')
    const nextStatus = formField(formData, 'nextStatus')
    if (!departmentId || (nextStatus !== 'active' && nextStatus !== 'inactive')) {
      return { ok: false, message: 'Invalid toggle request.' }
    }
    return { ok: true, data: { departmentId, nextActive: nextStatus === 'active' } }
  },
  handler: async ({ input, context }) => {
    await context.admin
      .from('departments')
      .update({
        is_active: input.nextActive,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      })
      .eq('department_id', input.departmentId)
      .eq('company_id', context.companyId)
      .is('deleted_at', null)

    revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
    return ok(undefined)
  },
})

export async function toggleDepartmentStatusAction(formData: FormData) {
  await runToggleDepartmentStatus(formData)
}
