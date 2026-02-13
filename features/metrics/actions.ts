'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { metricDeleteSchema, metricFormSchema, metricStatusSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { validateFormulaExpression } from '@/lib/metrics/formula'

type MetricActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function resolvedUnit(formData: FormData) {
  const unit = field(formData, 'unit')
  if (unit !== 'custom') {
    return unit
  }

  return field(formData, 'unitCustom')
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
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

async function validateDepartment(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const { data, error } = await admin
    .from('departments')
    .select('department_id')
    .eq('department_id', departmentId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message) }
  }

  if (!data) {
    return { ok: false as const, message: 'Department not found.' }
  }

  return { ok: true as const }
}

async function getFormulaCodeIndexes(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
) {
  const { data: allMetrics, error: allMetricsError } = await admin
    .from('metrics')
    .select('metric_id, code, is_active')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  if (allMetricsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(allMetricsError.message),
      activeCodeToMetricId: new Map<string, string>(),
      duplicateActiveCodes: new Set<string>(),
      allCodes: new Set<string>(),
    }
  }

  const activeCodeToMetricId = new Map<string, string>()
  const duplicateActiveCodes = new Set<string>()
  const allCodes = new Set<string>()

  for (const metric of allMetrics ?? []) {
    const code = String(metric.code ?? '').toLowerCase()
    if (!code) {
      continue
    }

    allCodes.add(code)
    if (!metric.is_active) {
      continue
    }

    if (activeCodeToMetricId.has(code)) {
      duplicateActiveCodes.add(code)
      continue
    }

    activeCodeToMetricId.set(code, metric.metric_id as string)
  }

  return {
    ok: true as const,
    activeCodeToMetricId,
    duplicateActiveCodes,
    allCodes,
  }
}

async function resolveFormulaDependencies(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  expression: string,
  currentMetricId?: string,
) {
  const indexesResult = await getFormulaCodeIndexes(admin, companyId)
  if (!indexesResult.ok) {
    return {
      ok: false as const,
      message: indexesResult.message,
      metricIds: [] as string[],
      normalizedExpression: '',
    }
  }

  const parsed = validateFormulaExpression(expression)
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error,
      metricIds: [] as string[],
      normalizedExpression: '',
    }
  }

  const metricIds: string[] = []
  for (const code of parsed.metricCodes) {
    if (indexesResult.duplicateActiveCodes.has(code)) {
      return {
        ok: false as const,
        message: `Metric code "${code}" is duplicated across active departments. Use a unique code.`,
        metricIds: [] as string[],
        normalizedExpression: '',
      }
    }

    const dependencyId = indexesResult.activeCodeToMetricId.get(code)
    if (!dependencyId) {
      if (indexesResult.allCodes.has(code)) {
        return {
          ok: false as const,
          message: `Metric code "${code}" is inactive and cannot be used in formulas.`,
          metricIds: [] as string[],
          normalizedExpression: '',
        }
      }

      return {
        ok: false as const,
        message: `Unknown metric code "${code}" in formula.`,
        metricIds: [] as string[],
        normalizedExpression: '',
      }
    }

    if (currentMetricId && dependencyId === currentMetricId) {
      return {
        ok: false as const,
        message: 'A metric cannot reference itself in its own formula.',
        metricIds: [] as string[],
        normalizedExpression: '',
      }
    }

    metricIds.push(dependencyId)
  }

  return {
    ok: true as const,
    metricIds,
    normalizedExpression: parsed.normalizedExpression,
  }
}

async function replaceDependencies(
  admin: ReturnType<typeof createAdminClient>,
  metricId: string,
  dependencyIds: string[],
) {
  const { error: deleteError } = await admin
    .from('metric_formula_dependencies')
    .delete()
    .eq('metric_id', metricId)

  if (deleteError) {
    return { ok: false as const, message: formatDatabaseError(deleteError.message) }
  }

  if (dependencyIds.length === 0) {
    return { ok: true as const }
  }

  const { error: insertError } = await admin
    .from('metric_formula_dependencies')
    .insert(
      dependencyIds.map((dependencyId) => ({
        metric_id: metricId,
        depends_on_metric_id: dependencyId,
      })),
    )

  if (insertError) {
    if (/circular dependency/i.test(insertError.message)) {
      return {
        ok: false as const,
        message: 'Circular dependency detected between calculated metrics.',
      }
    }

    return { ok: false as const, message: formatDatabaseError(insertError.message) }
  }

  return { ok: true as const }
}

async function upsertCurrentFormula(
  admin: ReturnType<typeof createAdminClient>,
  metricId: string,
  expression: string,
) {
  const trimmedExpression = expression.trim()

  const { data: currentFormula, error: currentFormulaError } = await admin
    .from('metric_formulas')
    .select('formula_id, expression, version')
    .eq('metric_id', metricId)
    .eq('is_current', true)
    .maybeSingle()

  if (currentFormulaError) {
    return { ok: false as const, message: formatDatabaseError(currentFormulaError.message) }
  }

  if (!currentFormula) {
    const { error: insertError } = await admin
      .from('metric_formulas')
      .insert({
        metric_id: metricId,
        expression: trimmedExpression,
        version: 1,
        is_current: true,
      })

    if (insertError) {
      return { ok: false as const, message: formatDatabaseError(insertError.message) }
    }

    return { ok: true as const }
  }

  if (currentFormula.expression.trim() === trimmedExpression) {
    return { ok: true as const }
  }

  const { data: nextFormula, error: insertNextError } = await admin
    .from('metric_formulas')
    .insert({
      metric_id: metricId,
      expression: trimmedExpression,
      version: currentFormula.version + 1,
      is_current: false,
    })
    .select('formula_id')
    .maybeSingle()

  if (insertNextError || !nextFormula?.formula_id) {
    return { ok: false as const, message: formatDatabaseError(insertNextError?.message ?? 'Unable to save formula.') }
  }

  const { error: closeCurrentError } = await admin
    .from('metric_formulas')
    .update({
      is_current: false,
      superseded_by: nextFormula.formula_id,
      updated_at: new Date().toISOString(),
    })
    .eq('formula_id', currentFormula.formula_id)

  if (closeCurrentError) {
    return { ok: false as const, message: formatDatabaseError(closeCurrentError.message) }
  }

  const { error: activateNextError } = await admin
    .from('metric_formulas')
    .update({
      is_current: true,
      updated_at: new Date().toISOString(),
    })
    .eq('formula_id', nextFormula.formula_id)

  if (activateNextError) {
    return { ok: false as const, message: formatDatabaseError(activateNextError.message) }
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
    unit: resolvedUnit(formData),
    direction: field(formData, 'direction'),
    inputMode: field(formData, 'inputMode'),
    precisionScale: field(formData, 'precisionScale'),
    expression: field(formData, 'expression'),
    dependsOnMetricIds: [],
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { status: 'error', message: 'Insufficient permissions.' }
  }

  const departmentValidation = await validateDepartment(context.admin, context.companyId, parsed.data.departmentId)
  if (!departmentValidation.ok) {
    return { status: 'error', message: departmentValidation.message }
  }

  let formulaDependencies: string[] = []
  let normalizedExpression = ''
  if (parsed.data.inputMode === 'calculated') {
    const formulaDependenciesResult = await resolveFormulaDependencies(
      context.admin,
      context.companyId,
      parsed.data.expression ?? '',
    )

    if (!formulaDependenciesResult.ok) {
      return { status: 'error', message: formulaDependenciesResult.message }
    }

    formulaDependencies = formulaDependenciesResult.metricIds
    normalizedExpression = formulaDependenciesResult.normalizedExpression
  }

  const code = (parsed.data.code?.trim() || toMetricCode(parsed.data.name)).toLowerCase()

  const { data: metric, error: createMetricError } = await context.admin
    .from('metrics')
    .insert({
      company_id: context.companyId,
      department_id: parsed.data.departmentId,
      name: parsed.data.name.trim(),
      code,
      description: parsed.data.description?.trim() || null,
      data_type: parsed.data.dataType,
      unit: parsed.data.unit.trim(),
      direction: parsed.data.direction,
      input_mode: parsed.data.inputMode,
      precision_scale: parsed.data.precisionScale,
      is_active: true,
    })
    .select('metric_id')
    .maybeSingle()

  if (createMetricError || !metric?.metric_id) {
    return {
      status: 'error',
      message: formatDatabaseError(createMetricError?.message ?? 'Failed to create metric.'),
    }
  }

  if (parsed.data.inputMode === 'calculated') {
    const formulaResult = await upsertCurrentFormula(
      context.admin,
      metric.metric_id,
      normalizedExpression,
    )

    if (!formulaResult.ok) {
      return { status: 'error', message: formulaResult.message }
    }

    const dependencyResult = await replaceDependencies(
      context.admin,
      metric.metric_id,
      formulaDependencies,
    )

    if (!dependencyResult.ok) {
      return { status: 'error', message: dependencyResult.message }
    }
  }

  revalidatePath(ROUTES.SETTINGS_METRICS)
  return {
    status: 'success',
    message:
      parsed.data.inputMode === 'manual'
        ? 'Manual metric created.'
        : 'Calculated metric and formula created.',
  }
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
    unit: resolvedUnit(formData),
    direction: field(formData, 'direction'),
    inputMode: field(formData, 'inputMode'),
    precisionScale: field(formData, 'precisionScale'),
    expression: field(formData, 'expression'),
    dependsOnMetricIds: [],
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  if (!parsed.data.metricId) {
    return { status: 'error', message: 'Metric id is required.' }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { status: 'error', message: 'Insufficient permissions.' }
  }

  const { data: existingMetric, error: existingMetricError } = await context.admin
    .from('metrics')
    .select('metric_id')
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingMetricError) {
    return { status: 'error', message: formatDatabaseError(existingMetricError.message) }
  }

  if (!existingMetric) {
    return { status: 'error', message: 'Metric not found.' }
  }

  const departmentValidation = await validateDepartment(context.admin, context.companyId, parsed.data.departmentId)
  if (!departmentValidation.ok) {
    return { status: 'error', message: departmentValidation.message }
  }

  let formulaDependencies: string[] = []
  let normalizedExpression = ''
  if (parsed.data.inputMode === 'calculated') {
    const formulaDependenciesResult = await resolveFormulaDependencies(
      context.admin,
      context.companyId,
      parsed.data.expression ?? '',
      parsed.data.metricId,
    )

    if (!formulaDependenciesResult.ok) {
      return { status: 'error', message: formulaDependenciesResult.message }
    }

    formulaDependencies = formulaDependenciesResult.metricIds
    normalizedExpression = formulaDependenciesResult.normalizedExpression
  }

  const code = (parsed.data.code?.trim() || toMetricCode(parsed.data.name)).toLowerCase()

  const { error: updateMetricError } = await context.admin
    .from('metrics')
    .update({
      department_id: parsed.data.departmentId,
      name: parsed.data.name.trim(),
      code,
      description: parsed.data.description?.trim() || null,
      data_type: parsed.data.dataType,
      unit: parsed.data.unit.trim(),
      direction: parsed.data.direction,
      input_mode: parsed.data.inputMode,
      precision_scale: parsed.data.precisionScale,
      updated_at: new Date().toISOString(),
    })
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)

  if (updateMetricError) {
    return { status: 'error', message: formatDatabaseError(updateMetricError.message) }
  }

  if (parsed.data.inputMode === 'calculated') {
    const formulaResult = await upsertCurrentFormula(
      context.admin,
      parsed.data.metricId,
      normalizedExpression,
    )

    if (!formulaResult.ok) {
      return { status: 'error', message: formulaResult.message }
    }

    const dependencyResult = await replaceDependencies(
      context.admin,
      parsed.data.metricId,
      formulaDependencies,
    )

    if (!dependencyResult.ok) {
      return { status: 'error', message: dependencyResult.message }
    }
  } else {
    const { error: closeFormulaError } = await context.admin
      .from('metric_formulas')
      .update({
        is_current: false,
        updated_at: new Date().toISOString(),
      })
      .eq('metric_id', parsed.data.metricId)
      .eq('is_current', true)

    if (closeFormulaError) {
      return { status: 'error', message: formatDatabaseError(closeFormulaError.message) }
    }

    const dependencyResult = await replaceDependencies(
      context.admin,
      parsed.data.metricId,
      [],
    )

    if (!dependencyResult.ok) {
      return { status: 'error', message: dependencyResult.message }
    }
  }

  revalidatePath(ROUTES.SETTINGS_METRICS)
  return { status: 'success', message: 'Metric updated.' }
}

export async function toggleMetricStatusAction(formData: FormData) {
  const parsed = metricStatusSchema.safeParse({
    metricId: field(formData, 'metricId'),
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

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('metric_id, is_active')
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (metricError || !metric) {
    return
  }

  const nextActive = parsed.data.nextStatus === 'active'
  if (metric.is_active === nextActive) {
    return
  }

  await context.admin
    .from('metrics')
    .update({
      is_active: nextActive,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('metric_id', metric.metric_id)
    .eq('company_id', context.companyId)

  revalidatePath(ROUTES.SETTINGS_METRICS)
}

export async function deleteMetricAction(formData: FormData) {
  const parsed = metricDeleteSchema.safeParse({
    metricId: field(formData, 'metricId'),
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

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('metric_id')
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (metricError || !metric) {
    return
  }

  const { data: dependentLinks, error: dependentLinksError } = await context.admin
    .from('metric_formula_dependencies')
    .select('metric_id')
    .eq('depends_on_metric_id', parsed.data.metricId)

  if (dependentLinksError) {
    return
  }

  const dependentMetricIds = Array.from(
    new Set((dependentLinks ?? []).map((item) => item.metric_id as string).filter(Boolean)),
  )

  if (dependentMetricIds.length > 0) {
    const { data: activeDependents, error: activeDependentsError } = await context.admin
      .from('metrics')
      .select('metric_id')
      .eq('company_id', context.companyId)
      .in('metric_id', dependentMetricIds)
      .eq('is_active', true)
      .is('deleted_at', null)
      .neq('metric_id', parsed.data.metricId)

    if (activeDependentsError) {
      return
    }

    if ((activeDependents ?? []).length > 0) {
      return
    }
  }

  const now = new Date().toISOString()

  await context.admin
    .from('targets')
    .update({
      is_active: false,
      updated_at: now,
    })
    .eq('company_id', context.companyId)
    .eq('metric_id', parsed.data.metricId)
    .is('deleted_at', null)

  await context.admin
    .from('metrics')
    .update({
      is_active: false,
      deleted_at: now,
      updated_at: now,
    })
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

  revalidatePath(ROUTES.SETTINGS_METRICS)
  revalidatePath(ROUTES.SETTINGS_TARGETS)
}
