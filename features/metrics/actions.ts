'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { metricDeleteSchema, metricFormSchema, metricReorderSchema, metricStatusSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { type Role } from '@/lib/rbac/roles'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { validateFormulaExpression, type FormulaValueType } from '@/lib/metrics/formula'
import {
  isCalculatedSupportedType,
  normalizeMetricSettings,
  parseSelectionOptions,
  type MetricDataType,
  type MetricSettings,
} from '@/lib/metrics/data-types'

type MetricFieldKey =
  | 'metricId'
  | 'departmentId'
  | 'name'
  | 'code'
  | 'description'
  | 'dataType'
  | 'unit'
  | 'inputMode'
  | 'expression'
  | 'selectionOptions'

export type MetricActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  fieldErrors: Partial<Record<MetricFieldKey, string>>
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

function buildMetricSettings(dataType: MetricDataType, formData: FormData) {
  if (dataType === 'number') {
    return normalizeMetricSettings(dataType, {
      numberKind: field(formData, 'numberKind') || 'integer',
    })
  }

  if (dataType === 'currency') {
    return normalizeMetricSettings(dataType, {
      currencyCode: field(formData, 'currencyCode') || 'USD',
    })
  }

  if (dataType === 'boolean') {
    return normalizeMetricSettings(dataType, {
      booleanPreset: 'yes_no',
    })
  }

  if (dataType === 'duration') {
    return normalizeMetricSettings(dataType, {
      durationFormat: field(formData, 'durationFormat') || 'hh_mm_ss',
    })
  }

  if (dataType === 'text') {
    return normalizeMetricSettings(dataType, {
      textFormat: field(formData, 'textFormat') || 'short_text',
    })
  }

  if (dataType === 'datetime') {
    return normalizeMetricSettings(dataType, {
      datetimeFormat: field(formData, 'datetimeFormat') || 'date',
    })
  }

  if (dataType === 'selection') {
    const selectionOptions = parseSelectionOptions(field(formData, 'selectionOptions'))
    return normalizeMetricSettings(dataType, {
      selectionMode: field(formData, 'selectionMode') || 'single',
      selectionOptions,
    })
  }

  if (dataType === 'file') {
    return normalizeMetricSettings(dataType, {
      fileKind: field(formData, 'fileKind') || 'file',
    })
  }

  return {} as MetricSettings
}

function resolveTypedUnit(dataType: MetricDataType, rawUnit: string, settings: MetricSettings) {
  if (dataType === 'currency') {
    return (settings.currencyCode || rawUnit || 'USD').toLowerCase()
  }

  if (dataType === 'percent') {
    return 'pct'
  }

  if (dataType === 'boolean') {
    return 'bool'
  }

  if (dataType === 'duration') {
    return settings.durationFormat === 'hh_mm_ss' ? 'hh:mm:ss' : settings.durationFormat || rawUnit || 'hh:mm:ss'
  }

  if (dataType === 'text') {
    return settings.textFormat || rawUnit || 'text'
  }

  if (dataType === 'datetime') {
    return settings.datetimeFormat || rawUnit || 'date'
  }

  if (dataType === 'selection') {
    return settings.selectionMode || rawUnit || 'single'
  }

  if (dataType === 'file') {
    return settings.fileKind || rawUnit || 'file'
  }

  return rawUnit.trim()
}

function formulaValueTypeForMetricDataType(dataType: MetricDataType): FormulaValueType | null {
  if (dataType === 'boolean') {
    return 'boolean'
  }

  if (dataType === 'number' || dataType === 'currency' || dataType === 'percent' || dataType === 'duration') {
    return 'number'
  }

  return null
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
      key === 'unit' ||
      key === 'inputMode' ||
      key === 'expression' ||
      key === 'selectionOptions'
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

  if (lowered.includes('duplicate key value') || lowered.includes('idx_metrics_company_dept_code_active')) {
    return actionError('A metric with this code already exists in this department.', {
      code: 'Metric code already exists for this department.',
    })
  }

  return actionError(formatDatabaseError(message))
}

function revalidateMetricConsumerPaths() {
  revalidateMetricConsumerPaths()
  revalidatePath(ROUTES.DAILY_LOG)
  revalidatePath(ROUTES.DASHBOARD)
  revalidatePath(ROUTES.LEADERBOARD)
  revalidatePath(ROUTES.ACCOUNTABILITY)
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

function isMissingTypedFormulaColumns(message: string) {
  const lowered = message.toLowerCase()
  return (
    lowered.includes('column metric_formulas.ast_json does not exist') ||
    lowered.includes('column metric_formulas.return_type does not exist') ||
    lowered.includes('column metric_formulas.engine_version does not exist')
  )
}

function legacyPrecisionScaleForDataType(dataType: MetricDataType) {
  if (dataType === 'currency') {
    return 2
  }

  if (dataType === 'number' || dataType === 'percent' || dataType === 'duration') {
    return 1
  }

  return 0
}

async function getNextMetricSortOrder(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  excludeMetricId?: string,
) {
  let withSortQuery = admin
    .from('metrics')
    .select('sort_order')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1)

  if (excludeMetricId) {
    withSortQuery = withSortQuery.neq('metric_id', excludeMetricId)
  }

  const withSort = await withSortQuery.maybeSingle()

  if (!withSort.error) {
    const currentMax = typeof withSort.data?.sort_order === 'number' ? withSort.data.sort_order : 0
    return { ok: true as const, nextSortOrder: currentMax + 1 }
  }

  if (!isMissingMetricsSortOrderColumn(withSort.error.message)) {
    return { ok: false as const, message: formatDatabaseError(withSort.error.message), nextSortOrder: 1 }
  }

  let fallbackCountQuery = admin
    .from('metrics')
    .select('metric_id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .is('deleted_at', null)

  if (excludeMetricId) {
    fallbackCountQuery = fallbackCountQuery.neq('metric_id', excludeMetricId)
  }

  const fallbackCount = await fallbackCountQuery
  if (fallbackCount.error) {
    return {
      ok: false as const,
      message: formatDatabaseError(fallbackCount.error.message),
      nextSortOrder: 1,
    }
  }

  return { ok: true as const, nextSortOrder: (fallbackCount.count ?? 0) + 1 }
}

async function listDepartmentMetricIdsInOrder(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const withSort = await admin
    .from('metrics')
    .select('metric_id, sort_order, created_at')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .order('metric_id', { ascending: true })

  if (!withSort.error) {
    return {
      ok: true as const,
      metricIds: ((withSort.data ?? []) as Array<{ metric_id: string }>).map((row) => row.metric_id),
    }
  }

  if (!isMissingMetricsSortOrderColumn(withSort.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(withSort.error.message),
      metricIds: [] as string[],
    }
  }

  const fallback = await admin
    .from('metrics')
    .select('metric_id, created_at')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('metric_id', { ascending: true })

  if (fallback.error) {
    return {
      ok: false as const,
      message: formatDatabaseError(fallback.error.message),
      metricIds: [] as string[],
    }
  }

  return {
    ok: true as const,
    metricIds: ((fallback.data ?? []) as Array<{ metric_id: string }>).map((row) => row.metric_id),
  }
}

async function persistDepartmentMetricOrder(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  orderedMetricIds: string[],
) {
  for (let index = 0; index < orderedMetricIds.length; index += 1) {
    const metricId = orderedMetricIds[index]
    const { error: updateError } = await admin
      .from('metrics')
      .update({
        sort_order: index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('department_id', departmentId)
      .eq('metric_id', metricId)
      .is('deleted_at', null)

    if (updateError) {
      return { ok: false as const, message: formatDatabaseError(updateError.message) }
    }
  }

  return { ok: true as const }
}

async function insertMetricCompat(
  admin: ReturnType<typeof createAdminClient>,
  payload: {
    company_id: string
    department_id: string
    name: string
    code: string
    description: string | null
    data_type: MetricDataType
    unit: string
    settings: MetricSettings
    input_mode: 'manual' | 'calculated'
    sort_order?: number
    is_active: boolean
  },
) {
  const payloadWithoutSort = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== 'sort_order'),
  ) as Omit<typeof payload, 'sort_order'>

  const firstAttempt = await admin
    .from('metrics')
    .insert(payload)
    .select('metric_id')
    .maybeSingle()

  if (!firstAttempt.error) {
    return firstAttempt
  }

  if (isMissingMetricsSortOrderColumn(firstAttempt.error.message)) {
    const retryWithoutSort = await admin
      .from('metrics')
      .insert(payloadWithoutSort)
      .select('metric_id')
      .maybeSingle()

    if (!retryWithoutSort.error) {
      return retryWithoutSort
    }

    if (!requiresLegacyMetricColumns(retryWithoutSort.error.message)) {
      return retryWithoutSort
    }

    return admin
      .from('metrics')
      .insert({
        ...payloadWithoutSort,
        direction: 'higher_is_better',
        precision_scale: legacyPrecisionScaleForDataType(payload.data_type),
      })
      .select('metric_id')
      .maybeSingle()
  }

  if (!requiresLegacyMetricColumns(firstAttempt.error.message)) {
    return firstAttempt
  }

  return admin
    .from('metrics')
    .insert({
      ...payload,
      direction: 'higher_is_better',
      precision_scale: legacyPrecisionScaleForDataType(payload.data_type),
    })
    .select('metric_id')
    .maybeSingle()
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
  departmentId: string,
) {
  const { data: allMetrics, error: allMetricsError } = await admin
    .from('metrics')
    .select('metric_id, code, is_active, data_type')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .is('deleted_at', null)

  if (allMetricsError) {
    return {
      ok: false as const,
      message: formatDatabaseError(allMetricsError.message),
      activeCodeToMetricId: new Map<string, string>(),
      activeCodeToFormulaType: new Map<string, FormulaValueType | null>(),
      duplicateActiveCodes: new Set<string>(),
      allCodes: new Set<string>(),
    }
  }

  const activeCodeToMetricId = new Map<string, string>()
  const activeCodeToFormulaType = new Map<string, FormulaValueType | null>()
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
    activeCodeToFormulaType.set(
      code,
      formulaValueTypeForMetricDataType(metric.data_type as MetricDataType),
    )
  }

  return {
    ok: true as const,
    activeCodeToMetricId,
    activeCodeToFormulaType,
    duplicateActiveCodes,
    allCodes,
  }
}

async function resolveFormulaDependencies(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  expression: string,
  expectedReturnType: FormulaValueType,
  currentMetricId?: string,
) {
  const indexesResult = await getFormulaCodeIndexes(admin, companyId, departmentId)
  if (!indexesResult.ok) {
    return {
      ok: false as const,
      message: indexesResult.message,
      metricIds: [] as string[],
      normalizedExpression: '',
      astJson: {} as Record<string, unknown>,
      returnType: expectedReturnType,
    }
  }

  const dependencyMetricTypes = new Map<string, FormulaValueType>()
  for (const [code, type] of indexesResult.activeCodeToFormulaType.entries()) {
    if (type) {
      dependencyMetricTypes.set(code, type)
    }
  }

  const parsed = validateFormulaExpression(expression, {
    metricReturnTypes: dependencyMetricTypes,
  })
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error,
      metricIds: [] as string[],
      normalizedExpression: '',
      astJson: {} as Record<string, unknown>,
      returnType: expectedReturnType,
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
        astJson: {} as Record<string, unknown>,
        returnType: expectedReturnType,
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
          astJson: {} as Record<string, unknown>,
          returnType: expectedReturnType,
        }
      }

      return {
        ok: false as const,
        message: `Unknown metric code "${code}" in formula.`,
        metricIds: [] as string[],
        normalizedExpression: '',
        astJson: {} as Record<string, unknown>,
        returnType: expectedReturnType,
      }
    }

    const dependencyType = indexesResult.activeCodeToFormulaType.get(code) ?? null
    if (!dependencyType) {
      return {
        ok: false as const,
        message: `Metric code "${code}" uses an unsupported data type for formulas.`,
        metricIds: [] as string[],
        normalizedExpression: '',
        astJson: {} as Record<string, unknown>,
        returnType: expectedReturnType,
      }
    }

    if (currentMetricId && dependencyId === currentMetricId) {
      return {
        ok: false as const,
        message: 'A metric cannot reference itself in its own formula.',
        metricIds: [] as string[],
        normalizedExpression: '',
        astJson: {} as Record<string, unknown>,
        returnType: expectedReturnType,
      }
    }

    metricIds.push(dependencyId)
  }

  if (parsed.returnType !== expectedReturnType) {
    return {
      ok: false as const,
      message: `Formula must return ${expectedReturnType} for this metric type.`,
      metricIds: [] as string[],
      normalizedExpression: '',
      astJson: {} as Record<string, unknown>,
      returnType: expectedReturnType,
    }
  }

  return {
    ok: true as const,
    metricIds,
    normalizedExpression: parsed.normalizedExpression,
    astJson: parsed.ast,
    returnType: parsed.returnType,
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
  astJson: Record<string, unknown>,
  returnType: FormulaValueType,
) {
  const trimmedExpression = expression.trim()
  type CurrentFormulaRow = {
    formula_id: string
    expression: string
    version: number
    ast_json?: unknown
    return_type?: string | null
    engine_version?: string | null
  }

  const typedCurrentFormula = await admin
    .from('metric_formulas')
    .select('formula_id, expression, version, ast_json, return_type, engine_version')
    .eq('metric_id', metricId)
    .eq('is_current', true)
    .maybeSingle()

  let supportsTypedFormulaColumns = true
  let currentFormula: CurrentFormulaRow | null = null

  if (!typedCurrentFormula.error) {
    currentFormula = (typedCurrentFormula.data ?? null) as CurrentFormulaRow | null
  } else if (isMissingTypedFormulaColumns(typedCurrentFormula.error.message)) {
    supportsTypedFormulaColumns = false
    const legacyCurrentFormula = await admin
      .from('metric_formulas')
      .select('formula_id, expression, version')
      .eq('metric_id', metricId)
      .eq('is_current', true)
      .maybeSingle()

    if (legacyCurrentFormula.error) {
      return { ok: false as const, message: formatDatabaseError(legacyCurrentFormula.error.message) }
    }

    currentFormula = (legacyCurrentFormula.data ?? null) as CurrentFormulaRow | null
  } else {
    return { ok: false as const, message: formatDatabaseError(typedCurrentFormula.error.message) }
  }

  if (!currentFormula) {
    const createFormulaPayload = supportsTypedFormulaColumns
      ? {
        metric_id: metricId,
        expression: trimmedExpression,
        ast_json: astJson,
        return_type: returnType,
        engine_version: 'notion_v1',
        version: 1,
        is_current: true,
      }
      : {
        metric_id: metricId,
        expression: trimmedExpression,
        version: 1,
        is_current: true,
      }

    const { error: insertError } = await admin
      .from('metric_formulas')
      .insert(createFormulaPayload)

    if (insertError) {
      return { ok: false as const, message: formatDatabaseError(insertError.message) }
    }

    return { ok: true as const }
  }

  const hasSameExpression = currentFormula.expression.trim() === trimmedExpression
  const hasSameTypedMetadata = supportsTypedFormulaColumns
    ? (
      String(currentFormula.return_type ?? 'number') === returnType &&
      JSON.stringify(currentFormula.ast_json ?? {}) === JSON.stringify(astJson) &&
      String(currentFormula.engine_version ?? 'notion_v1') === 'notion_v1'
    )
    : true

  if (hasSameExpression && hasSameTypedMetadata) {
    return { ok: true as const }
  }

  const nextFormulaVersion = Number(currentFormula.version ?? 0) + 1
  const nextFormulaPayload = supportsTypedFormulaColumns
    ? {
      metric_id: metricId,
      expression: trimmedExpression,
      ast_json: astJson,
      return_type: returnType,
      engine_version: 'notion_v1',
      version: nextFormulaVersion,
      is_current: false,
    }
    : {
      metric_id: metricId,
      expression: trimmedExpression,
      version: nextFormulaVersion,
      is_current: false,
    }

  const { data: nextFormula, error: insertNextError } = await admin
    .from('metric_formulas')
    .insert(nextFormulaPayload)
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
    inputMode: field(formData, 'inputMode'),
    expression: field(formData, 'expression'),
    dependsOnMetricIds: [],
  })

  if (!parsed.success) {
    return actionError(zodMessage(parsed.error), zodFieldErrors(parsed.error))
  }

  const context = await getActorContext()
  if (!context.ok) {
    return actionError(context.message)
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const departmentValidation = await validateDepartment(context.admin, context.companyId, parsed.data.departmentId)
  if (!departmentValidation.ok) {
    return actionError(departmentValidation.message, {
      departmentId: 'Select a valid active department.',
    })
  }

  const metricSettings = buildMetricSettings(parsed.data.dataType, formData)
  if (parsed.data.dataType === 'selection' && (!metricSettings.selectionOptions || metricSettings.selectionOptions.length === 0)) {
    return actionError('Selection metrics must have at least one option.', {
      selectionOptions: 'Selection options are required.',
    })
  }
  const unit = resolveTypedUnit(parsed.data.dataType, parsed.data.unit, metricSettings)

  let formulaDependencies: string[] = []
  let normalizedExpression = ''
  let formulaAstJson: Record<string, unknown> = {}
  let formulaReturnType: FormulaValueType | null = null
  if (parsed.data.inputMode === 'calculated') {
    const expectedReturnType = formulaValueTypeForMetricDataType(parsed.data.dataType)
    if (!expectedReturnType || !isCalculatedSupportedType(parsed.data.dataType)) {
      return actionError(
        'Calculated metrics are only supported for numeric/currency/percent/duration/boolean types.',
        { dataType: 'Choose a supported data type for calculated mode.' },
      )
    }

    const formulaDependenciesResult = await resolveFormulaDependencies(
      context.admin,
      context.companyId,
      parsed.data.departmentId,
      parsed.data.expression ?? '',
      expectedReturnType,
    )

    if (!formulaDependenciesResult.ok) {
      return actionError(formulaDependenciesResult.message, {
        expression: formulaDependenciesResult.message,
      })
    }

    formulaDependencies = formulaDependenciesResult.metricIds
    normalizedExpression = formulaDependenciesResult.normalizedExpression
    formulaAstJson = formulaDependenciesResult.astJson
    formulaReturnType = formulaDependenciesResult.returnType
  }

  const code = (parsed.data.code?.trim() || toMetricCode(parsed.data.name)).toLowerCase()
  const sortOrderResult = await getNextMetricSortOrder(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
  )
  if (!sortOrderResult.ok) {
    return actionError(sortOrderResult.message)
  }

  const { data: metric, error: createMetricError } = await insertMetricCompat(context.admin, {
    company_id: context.companyId,
    department_id: parsed.data.departmentId,
    name: parsed.data.name.trim(),
    code,
    description: parsed.data.description?.trim() || null,
    data_type: parsed.data.dataType,
    unit,
    settings: metricSettings,
    input_mode: parsed.data.inputMode,
    sort_order: sortOrderResult.nextSortOrder,
    is_active: true,
  })

  if (createMetricError || !metric?.metric_id) {
    if (createMetricError) {
      return mapMetricDatabaseError(createMetricError.message)
    }

    return actionError('Failed to create metric.')
  }

  if (parsed.data.inputMode === 'calculated') {
    const formulaResult = await upsertCurrentFormula(
      context.admin,
      metric.metric_id,
      normalizedExpression,
      formulaAstJson,
      formulaReturnType ?? 'number',
    )

    if (!formulaResult.ok) {
      return actionError(formulaResult.message, {
        expression: formulaResult.message,
      })
    }

    const dependencyResult = await replaceDependencies(
      context.admin,
      metric.metric_id,
      formulaDependencies,
    )

    if (!dependencyResult.ok) {
      return actionError(dependencyResult.message, {
        expression: dependencyResult.message,
      })
    }
  }

  revalidateMetricConsumerPaths()
  return actionSuccess(
    parsed.data.inputMode === 'manual'
      ? 'Manual metric created.'
      : 'Calculated metric and formula created.',
  )
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
    inputMode: field(formData, 'inputMode'),
    expression: field(formData, 'expression'),
    dependsOnMetricIds: [],
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

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: existingMetric, error: existingMetricError } = await context.admin
    .from('metrics')
    .select('metric_id, department_id, sort_order')
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingMetricError) {
    return actionError(formatDatabaseError(existingMetricError.message))
  }

  if (!existingMetric) {
    return actionError('Metric not found.', {
      metricId: 'Metric no longer exists.',
    })
  }

  const departmentValidation = await validateDepartment(context.admin, context.companyId, parsed.data.departmentId)
  if (!departmentValidation.ok) {
    return actionError(departmentValidation.message, {
      departmentId: 'Select a valid active department.',
    })
  }

  const metricSettings = buildMetricSettings(parsed.data.dataType, formData)
  if (parsed.data.dataType === 'selection' && (!metricSettings.selectionOptions || metricSettings.selectionOptions.length === 0)) {
    return actionError('Selection metrics must have at least one option.', {
      selectionOptions: 'Selection options are required.',
    })
  }
  const unit = resolveTypedUnit(parsed.data.dataType, parsed.data.unit, metricSettings)

  let formulaDependencies: string[] = []
  let normalizedExpression = ''
  let formulaAstJson: Record<string, unknown> = {}
  let formulaReturnType: FormulaValueType | null = null
  if (parsed.data.inputMode === 'calculated') {
    const expectedReturnType = formulaValueTypeForMetricDataType(parsed.data.dataType)
    if (!expectedReturnType || !isCalculatedSupportedType(parsed.data.dataType)) {
      return actionError(
        'Calculated metrics are only supported for numeric/currency/percent/duration/boolean types.',
        { dataType: 'Choose a supported data type for calculated mode.' },
      )
    }

    const formulaDependenciesResult = await resolveFormulaDependencies(
      context.admin,
      context.companyId,
      parsed.data.departmentId,
      parsed.data.expression ?? '',
      expectedReturnType,
      parsed.data.metricId,
    )

    if (!formulaDependenciesResult.ok) {
      return actionError(formulaDependenciesResult.message, {
        expression: formulaDependenciesResult.message,
      })
    }

    formulaDependencies = formulaDependenciesResult.metricIds
    normalizedExpression = formulaDependenciesResult.normalizedExpression
    formulaAstJson = formulaDependenciesResult.astJson
    formulaReturnType = formulaDependenciesResult.returnType
  }

  const code = (parsed.data.code?.trim() || toMetricCode(parsed.data.name)).toLowerCase()
  const departmentChanged = existingMetric.department_id !== parsed.data.departmentId
  let nextSortOrder: number | null = typeof existingMetric.sort_order === 'number' ? existingMetric.sort_order : null

  if (departmentChanged) {
    const sortOrderResult = await getNextMetricSortOrder(
      context.admin,
      context.companyId,
      parsed.data.departmentId,
      parsed.data.metricId,
    )
    if (!sortOrderResult.ok) {
      return actionError(sortOrderResult.message)
    }
    nextSortOrder = sortOrderResult.nextSortOrder
  } else if (nextSortOrder === null) {
    const sortOrderResult = await getNextMetricSortOrder(
      context.admin,
      context.companyId,
      parsed.data.departmentId,
      parsed.data.metricId,
    )
    if (!sortOrderResult.ok) {
      return actionError(sortOrderResult.message)
    }
    nextSortOrder = sortOrderResult.nextSortOrder
  }

  const updatePayload = {
    department_id: parsed.data.departmentId,
    name: parsed.data.name.trim(),
    code,
    description: parsed.data.description?.trim() || null,
    data_type: parsed.data.dataType,
    unit,
    settings: metricSettings,
    input_mode: parsed.data.inputMode,
    sort_order: nextSortOrder,
    updated_at: new Date().toISOString(),
  }

  const updateWithSort = await context.admin
    .from('metrics')
    .update(updatePayload)
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)

  if (updateWithSort.error && !isMissingMetricsSortOrderColumn(updateWithSort.error.message)) {
    return mapMetricDatabaseError(updateWithSort.error.message)
  }

  if (updateWithSort.error && isMissingMetricsSortOrderColumn(updateWithSort.error.message)) {
    const updateWithoutSort = { ...updatePayload }
    delete (updateWithoutSort as { sort_order?: number | null }).sort_order
    const updateFallback = await context.admin
      .from('metrics')
      .update(updateWithoutSort)
      .eq('metric_id', parsed.data.metricId)
      .eq('company_id', context.companyId)

    if (updateFallback.error) {
      return mapMetricDatabaseError(updateFallback.error.message)
    }
  }

  if (parsed.data.inputMode === 'calculated') {
    const formulaResult = await upsertCurrentFormula(
      context.admin,
      parsed.data.metricId,
      normalizedExpression,
      formulaAstJson,
      formulaReturnType ?? 'number',
    )

    if (!formulaResult.ok) {
      return actionError(formulaResult.message, {
        expression: formulaResult.message,
      })
    }

    const dependencyResult = await replaceDependencies(
      context.admin,
      parsed.data.metricId,
      formulaDependencies,
    )

    if (!dependencyResult.ok) {
      return actionError(dependencyResult.message, {
        expression: dependencyResult.message,
      })
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
      return actionError(formatDatabaseError(closeFormulaError.message))
    }

    const dependencyResult = await replaceDependencies(
      context.admin,
      parsed.data.metricId,
      [],
    )

    if (!dependencyResult.ok) {
      return actionError(dependencyResult.message)
    }
  }

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

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('metric_id, department_id')
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (metricError || !metric) {
    return actionError(formatDatabaseError(metricError?.message ?? 'Metric not found.'), {
      metricId: 'Metric not found.',
    })
  }

  const orderedResult = await listDepartmentMetricIdsInOrder(
    context.admin,
    context.companyId,
    metric.department_id as string,
  )
  if (!orderedResult.ok) {
    return actionError(orderedResult.message)
  }

  const orderedMetricIds = orderedResult.metricIds
  const currentIndex = orderedMetricIds.findIndex((metricId) => metricId === parsed.data.metricId)
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

  const persistResult = await persistDepartmentMetricOrder(
    context.admin,
    context.companyId,
    metric.department_id as string,
    reordered,
  )
  if (!persistResult.ok) {
    return actionError(persistResult.message)
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

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('metric_id, is_active')
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (metricError || !metric) {
    return actionError(formatDatabaseError(metricError?.message ?? 'Metric not found.'), {
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
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('metric_id', metric.metric_id)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

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

  try {
    requireRole(context.role, 'manager')
  } catch {
    return actionError('Insufficient permissions.')
  }

  const { data: metric, error: metricError } = await context.admin
    .from('metrics')
    .select('metric_id, name')
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (metricError || !metric) {
    return actionError(formatDatabaseError(metricError?.message ?? 'Metric not found.'), {
      metricId: 'Metric not found.',
    })
  }

  const { data: dependentLinks, error: dependentLinksError } = await context.admin
    .from('metric_formula_dependencies')
    .select('metric_id')
    .eq('depends_on_metric_id', parsed.data.metricId)

  if (dependentLinksError) {
    return actionError(formatDatabaseError(dependentLinksError.message))
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
      return actionError(formatDatabaseError(activeDependentsError.message))
    }

    if ((activeDependents ?? []).length > 0) {
      return actionError('Cannot delete this metric while active calculated metrics depend on it.', {
        metricId: 'Remove or disable dependent calculated metrics first.',
      })
    }
  }

  const now = new Date().toISOString()

  const { error: disableTargetsError } = await context.admin
    .from('targets')
    .update({
      is_active: false,
      updated_at: now,
    })
    .eq('company_id', context.companyId)
    .eq('metric_id', parsed.data.metricId)
    .is('deleted_at', null)

  if (disableTargetsError) {
    return actionError(formatDatabaseError(disableTargetsError.message))
  }

  const { error: softDeleteMetricError } = await context.admin
    .from('metrics')
    .update({
      is_active: false,
      deleted_at: now,
      updated_at: now,
    })
    .eq('metric_id', parsed.data.metricId)
    .eq('company_id', context.companyId)
    .is('deleted_at', null)

  if (softDeleteMetricError) {
    return actionError(formatDatabaseError(softDeleteMetricError.message))
  }

  revalidatePath(ROUTES.SETTINGS_METRICS)
  return actionSuccess(`Metric "${metric.name}" deleted.`)
}
