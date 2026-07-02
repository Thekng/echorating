'use server'

import { revalidatePath } from 'next/cache'
import { metricDeleteSchema, metricFormSchema, metricReorderSchema, metricStatusSchema } from './schemas'
import { getActorContext } from '@/lib/supabase/actor-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { normalizeMetricSettings, isCalculatedSupportedType, type MetricDataType } from '@/lib/metrics/data-types'
import { parseFormulaExpression } from '@/lib/metrics/formula'
import { z } from 'zod'
import { logAuditEvent } from '@/lib/audit/log'

type MetricFieldKey =
  | 'metricId'
  | 'departmentId'
  | 'name'
  | 'code'
  | 'description'
  | 'dataType'
  | 'isRequired'

export type MetricActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  fieldErrors: Partial<Record<MetricFieldKey, string>>
}

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
}

function zodFieldErrors(error: z.ZodError): Partial<Record<MetricFieldKey, string>> {
  const errors: Partial<Record<MetricFieldKey, string>> = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (
      key === 'metricId' ||
      key === 'departmentId' ||
      key === 'name' ||
      key === 'code' ||
      key === 'description' ||
      key === 'dataType' ||
      key === 'isRequired'
    ) {
      if (!errors[key]) {
        errors[key] = issue.message
      }
    }
  }

  return errors
}

function actionSuccess(message: string): MetricActionState {
  return {
    status: 'success',
    message,
    fieldErrors: {},
  }
}

function actionError(
  message: string,
  fieldErrors: Partial<Record<MetricFieldKey, string>> = {},
): MetricActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function mapMetricDatabaseError(message: string): MetricActionState {
  const lowered = message.toLowerCase()

  if (lowered.includes('duplicate key value') || lowered.includes('idx_metrics_dept_code')) {
    return actionError('A metric with this code already exists in this department.', {
      code: 'Metric code already exists for this department.',
    })
  }

  return actionError(formatDatabaseError(message))
}

async function syncMetricFormula(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  metricId: string,
  inputMode: string,
  formulaExpression: string | undefined,
) {
  if (inputMode === 'calculated' && formulaExpression?.trim()) {
    const parsed = parseFormulaExpression(formulaExpression)
    if (!parsed.success) {
      return { ok: false as const, message: parsed.error }
    }

    // Upsert metric_formulas
    const { error: formulaError } = await admin
      .from('metric_formulas')
      .upsert(
        {
          metric_id: metricId,
          organization_id: organizationId,
          expression: parsed.normalizedExpression,
          return_type: parsed.returnType,
        },
        { onConflict: 'metric_id' },
      )

    if (formulaError) {
      return { ok: false as const, message: formatDatabaseError(formulaError.message) }
    }

    // Sync dependencies: delete old, insert new
    await admin
      .from('metric_formula_dependencies')
      .delete()
      .eq('metric_id', metricId)

    if (parsed.metricCodes.length > 0) {
      // Resolve metric codes to IDs in same department
      const { data: depMetrics } = await admin
        .from('metrics')
        .select('id, code')
        .eq('organization_id', organizationId)
        .in('code', parsed.metricCodes)

      const dependencyRows = ((depMetrics ?? []) as Array<{ id: string; code: string }>).map((m) => ({
        metric_id: metricId,
        depends_on_metric_id: m.id,
      }))

      if (dependencyRows.length > 0) {
        await admin.from('metric_formula_dependencies').insert(dependencyRows)
      }
    }

    // Update the metric's input_mode
    await admin
      .from('metrics')
      .update({ input_mode: 'calculated', updated_at: new Date().toISOString() })
      .eq('id', metricId)
      .eq('organization_id', organizationId)

    return { ok: true as const }
  }

  // Switching to manual or not calculated — clean up
  if (inputMode === 'manual') {
    await admin.from('metric_formula_dependencies').delete().eq('metric_id', metricId)
    await admin.from('metric_formulas').delete().eq('metric_id', metricId)
    await admin
      .from('metrics')
      .update({ input_mode: 'manual', updated_at: new Date().toISOString() })
      .eq('id', metricId)
      .eq('organization_id', organizationId)
  }

  return { ok: true as const }
}

function revalidateMetricConsumerPaths() {
  revalidatePath(ROUTES.SETTINGS_METRICS)
  revalidatePath(ROUTES.DAILY_LOG)
  revalidatePath(ROUTES.DASHBOARD)
  revalidatePath(ROUTES.LEADERBOARD)
  revalidatePath(ROUTES.ACCOUNTABILITY)
}

function toMetricCode(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (base) {
    return base
  }

  return `metric_${Date.now()}`
}

async function getNextMetricSortOrder(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  departmentId: string,
) {
  const { data, error } = await admin
    .from('metrics')
    .select('sort_order')
    .eq('organization_id', organizationId)
    .eq('department_id', departmentId)
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return 1
  }

  const currentMax = typeof data?.sort_order === 'number' ? data.sort_order : 0
  return currentMax + 1
}

async function validateDepartment(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  departmentId: string,
) {
  const { data, error } = await admin
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message) }
  }

  if (!data) {
    return { ok: false as const, message: 'Department not found.' }
  }

  return { ok: true as const }
}

export async function createMetricAction(
  _prevState: MetricActionState,
  formData: FormData,
): Promise<MetricActionState> {
  const parsed = metricFormSchema.safeParse({
    metricId: '',
    departmentId: field(formData, 'departmentId'),
    name: field(formData, 'name'),
    code: field(formData, 'code'),
    description: field(formData, 'description'),
    dataType: field(formData, 'dataType'),
    isRequired: field(formData, 'isRequired'),
    settings: field(formData, 'settings'),
    inputMode: field(formData, 'inputMode'),
    formulaExpression: field(formData, 'formulaExpression'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  const departmentValidation = await validateDepartment(context.admin, context.organizationId, parsed.data.departmentId)
  if (!departmentValidation.ok) {
    return actionError(departmentValidation.message, {
      departmentId: 'Select a valid active department.',
    })
  }

  const code = (parsed.data.code?.trim() || toMetricCode(parsed.data.name)).toLowerCase()
  const settings = normalizeMetricSettings(parsed.data.dataType, parsed.data.settings)
  const sortOrder = await getNextMetricSortOrder(
    context.admin,
    context.organizationId,
    parsed.data.departmentId,
  )

  const { error: createError } = await context.admin
    .from('metrics')
    .insert({
      organization_id: context.organizationId,
      department_id: parsed.data.departmentId,
      name: parsed.data.name.trim(),
      code,
      description: parsed.data.description?.trim() || null,
      data_type: parsed.data.dataType,
      is_required: parsed.data.isRequired,
      settings,
      sort_order: sortOrder,
      is_active: true,
    })

  if (createError) {
    return mapMetricDatabaseError(createError.message)
  }

  // Fetch created metric id for audit
  const { data: createdMetric } = await context.admin
    .from('metrics')
    .select('id')
    .eq('organization_id', context.organizationId)
    .eq('department_id', parsed.data.departmentId)
    .eq('code', code)
    .maybeSingle()

  if (createdMetric) {
    // Sync formula if calculated mode
    if (parsed.data.inputMode === 'calculated' && isCalculatedSupportedType(parsed.data.dataType)) {
      const formulaResult = await syncMetricFormula(
        context.admin,
        context.organizationId,
        createdMetric.id as string,
        parsed.data.inputMode,
        parsed.data.formulaExpression,
      )
      if (!formulaResult.ok) {
        return actionError(formulaResult.message)
      }
    }

    logAuditEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      action: 'metric.created',
      entityType: 'metric',
      entityId: createdMetric.id as string,
      metadata: { name: parsed.data.name.trim(), dataType: parsed.data.dataType, inputMode: parsed.data.inputMode },
    })
  }

  revalidateMetricConsumerPaths()
  return actionSuccess('Metric created.')
}

export async function updateMetricAction(
  _prevState: MetricActionState,
  formData: FormData,
): Promise<MetricActionState> {
  const parsed = metricFormSchema.safeParse({
    metricId: field(formData, 'metricId'),
    departmentId: field(formData, 'departmentId'),
    name: field(formData, 'name'),
    code: field(formData, 'code'),
    description: field(formData, 'description'),
    dataType: field(formData, 'dataType'),
    isRequired: field(formData, 'isRequired'),
    settings: field(formData, 'settings'),
    inputMode: field(formData, 'inputMode'),
    formulaExpression: field(formData, 'formulaExpression'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  if (!parsed.data.metricId) {
    return actionError('Metric id is required.', {
      metricId: 'Metric id is required.',
    })
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  const { data: existingMetric, error: existingMetricError } = await context.admin
    .from('metrics')
    .select('id, department_id')
    .eq('id', parsed.data.metricId)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (existingMetricError) {
    return actionError(formatDatabaseError(existingMetricError.message))
  }

  if (!existingMetric) {
    return actionError('Metric not found.', {
      metricId: 'Metric no longer exists.',
    })
  }

  const departmentValidation = await validateDepartment(context.admin, context.organizationId, parsed.data.departmentId)
  if (!departmentValidation.ok) {
    return actionError(departmentValidation.message, {
      departmentId: 'Select a valid active department.',
    })
  }

  const code = (parsed.data.code?.trim() || toMetricCode(parsed.data.name)).toLowerCase()
  const settings = normalizeMetricSettings(parsed.data.dataType, parsed.data.settings)

  const { error: updateError } = await context.admin
    .from('metrics')
    .update({
      name: parsed.data.name.trim(),
      code,
      description: parsed.data.description?.trim() || null,
      data_type: parsed.data.dataType,
      is_required: parsed.data.isRequired,
      settings,
      department_id: parsed.data.departmentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.metricId)
    .eq('organization_id', context.organizationId)

  if (updateError) {
    return mapMetricDatabaseError(updateError.message)
  }

  // Sync formula for calculated metrics
  if (isCalculatedSupportedType(parsed.data.dataType)) {
    const formulaResult = await syncMetricFormula(
      context.admin,
      context.organizationId,
      parsed.data.metricId,
      parsed.data.inputMode ?? 'manual',
      parsed.data.formulaExpression,
    )
    if (!formulaResult.ok) {
      return actionError(formulaResult.message)
    }
  } else if (parsed.data.inputMode !== 'calculated') {
    // Clean up formula if switching to unsupported type
    await syncMetricFormula(context.admin, context.organizationId, parsed.data.metricId, 'manual', undefined)
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'metric.updated',
    entityType: 'metric',
    entityId: parsed.data.metricId,
    metadata: { name: parsed.data.name.trim(), dataType: parsed.data.dataType, inputMode: parsed.data.inputMode },
  })

  revalidateMetricConsumerPaths()
  return actionSuccess('Metric updated.')
}

export async function reorderMetricAction(formData: FormData): Promise<MetricActionState> {
  const parsed = metricReorderSchema.safeParse({
    metricId: field(formData, 'metricId'),
    direction: field(formData, 'direction'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('id, department_id')
    .eq('id', parsed.data.metricId)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (metricError || !metric) {
    return actionError('Metric not found.', {
      metricId: 'Metric not found.',
    })
  }

  const { data: orderedData, error: orderedError } = await context.admin
    .from('metrics')
    .select('id, sort_order')
    .eq('organization_id', context.organizationId)
    .eq('department_id', metric.department_id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (orderedError) {
    return actionError(formatDatabaseError(orderedError.message))
  }

  const orderedMetricIds = (orderedData ?? []).map((row) => row.id as string)
  const currentIndex = orderedMetricIds.findIndex((id) => id === parsed.data.metricId)
  if (currentIndex === -1) {
    return actionError('Metric not found in department order.')
  }

  const targetIndex = parsed.data.direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= orderedMetricIds.length) {
    return actionSuccess('Metric order unchanged.')
  }

  const reordered = orderedMetricIds.slice()
  const [current] = reordered.splice(currentIndex, 1)
  reordered.splice(targetIndex, 0, current)

  for (let index = 0; index < reordered.length; index += 1) {
    const { error: updateError } = await context.admin
      .from('metrics')
      .update({
        sort_order: index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reordered[index])
      .eq('organization_id', context.organizationId)

    if (updateError) {
      return actionError(formatDatabaseError(updateError.message))
    }
  }

  revalidateMetricConsumerPaths()
  return actionSuccess('Metric order updated.')
}

export async function toggleMetricStatusAction(formData: FormData): Promise<MetricActionState> {
  const parsed = metricStatusSchema.safeParse({
    metricId: field(formData, 'metricId'),
    nextStatus: field(formData, 'nextStatus'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('id, is_active')
    .eq('id', parsed.data.metricId)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (metricError || !metric) {
    return actionError('Metric not found.', {
      metricId: 'Metric not found.',
    })
  }

  const nextActive = parsed.data.nextStatus === 'active'
  if (metric.is_active === nextActive) {
    return actionSuccess(nextActive ? 'Metric is already active.' : 'Metric is already inactive.')
  }

  const { error: updateError } = await context.admin
    .from('metrics')
    .update({
      is_active: nextActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.metricId)
    .eq('organization_id', context.organizationId)

  if (updateError) {
    return actionError(formatDatabaseError(updateError.message))
  }

  revalidateMetricConsumerPaths()
  return actionSuccess(nextActive ? 'Metric activated.' : 'Metric deactivated.')
}

export async function deleteMetricAction(formData: FormData): Promise<MetricActionState> {
  const parsed = metricDeleteSchema.safeParse({
    metricId: field(formData, 'metricId'),
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('id, name')
    .eq('id', parsed.data.metricId)
    .eq('organization_id', context.organizationId)
    .maybeSingle()

  if (metricError || !metric) {
    return actionError('Metric not found.', {
      metricId: 'Metric not found.',
    })
  }

  const { error: deleteError } = await context.admin
    .from('metrics')
    .delete()
    .eq('id', parsed.data.metricId)
    .eq('organization_id', context.organizationId)

  if (deleteError) {
    return actionError(formatDatabaseError(deleteError.message))
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'metric.deleted',
    entityType: 'metric',
    entityId: parsed.data.metricId,
    metadata: { name: metric.name as string },
  })

  revalidatePath(ROUTES.SETTINGS_METRICS)
  return actionSuccess(`Metric "${metric.name}" deleted.`)
}
