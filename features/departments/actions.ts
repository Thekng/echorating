'use server'

import { revalidatePath } from 'next/cache'
import { departmentIdSchema, departmentSchema } from './schemas'
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

type DepartmentFieldKey = 'departmentId' | 'name' | 'description'

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
  for (const key of ['departmentId', 'name', 'description'] as const) {
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
  if (lowered.includes('duplicate key value') || lowered.includes('idx_departments')) {
    return fail('database', 'A department with this name already exists.', {
      name: 'This department name is already in use.',
    })
  }
  return databaseFail(message)
}

const runCreateDepartment = wrapAction({
  name: 'createDepartment',
  role: 'manager',
  parse: (formData) =>
    parseWithZod(departmentSchema, {
      name: formField(formData, 'name'),
      description: formField(formData, 'description'),
    }),
  handler: async ({ input, context }) => {
    const { error } = await context.admin
      .from('departments')
      .insert({
        organization_id: context.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        is_active: true,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      return mapDuplicateNameError(error.message)
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
      description: formField(formData, 'description'),
    })
    if (!body.ok) return body
    return { ok: true, data: { ...id.data, ...body.data } }
  },
  handler: async ({ input, context }) => {
    const { data: current, error: lookupError } = await context.admin
      .from('departments')
      .select('id')
      .eq('id', input.departmentId)
      .eq('organization_id', context.organizationId)
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
        description: input.description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.departmentId)
      .eq('organization_id', context.organizationId)

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
      .select('id, name')
      .eq('id', input.departmentId)
      .eq('organization_id', context.organizationId)
      .maybeSingle()

    if (existingError) return databaseFail(existingError.message)
    if (!existing) {
      return fail('database', 'Department not found.', {
        departmentId: 'Department no longer exists.',
      })
    }

    // CASCADE on department_members and metrics handles cleanup
    const { error: deleteError } = await context.admin
      .from('departments')
      .delete()
      .eq('id', input.departmentId)
      .eq('organization_id', context.organizationId)

    if (deleteError) return databaseFail(deleteError.message)

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
      })
      .eq('id', input.departmentId)
      .eq('organization_id', context.organizationId)

    revalidatePath(ROUTES.SETTINGS_DEPARTMENTS)
    return ok(undefined)
  },
})

export async function toggleDepartmentStatusAction(formData: FormData) {
  await runToggleDepartmentStatus(formData)
}
