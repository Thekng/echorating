'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/rbac/guards'
import { type Role } from '@/lib/rbac/roles'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { dailyLogFormSchema } from './schemas'
import {
  type DailyLogActionState,
  type DailyLogKeyMetricsActionState,
  type DailyLogMetricDataType,
} from './types'
import { parseBooleanInput, parseDurationToSeconds } from '@/lib/daily-log/value-parser'
import { booleanLabels, normalizeMetricSettings, type DurationFormat } from '@/lib/metrics/data-types'
import {
  evaluateFormulaAst,
  evaluateFormulaExpression,
  type FormulaAstNode,
  type FormulaValueType,
} from '@/lib/metrics/formula'

const INITIAL_ERROR_STATE: DailyLogActionState = {
  status: 'error',
  message: 'Invalid request.',
  intent: null,
  entryStatus: null,
  savedAt: null,
  entryId: null,
}

const KEY_METRIC_ERROR_STATE: DailyLogKeyMetricsActionState = {
  status: 'error',
  message: 'Invalid request.',
}

const keyMetricsSchema = z.object({
  departmentId: z.string().uuid('Department is required.'),
  slot1: z.string().uuid().optional(),
  slot2: z.string().uuid().optional(),
  slot3: z.string().uuid().optional(),
})

const deleteDailyLogSchema = z.object({
  entryId: z.string().uuid('Invalid log entry.'),
})

function isMissingMetricsSettingsColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('column metrics.settings does not exist')
}

function isMissingTypedFormulaColumns(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('column metric_formulas.ast_json does not exist') ||
    normalized.includes('column metric_formulas.return_type does not exist') ||
    normalized.includes('column metric_formulas.engine_version does not exist')
  )
}

function isMissingEntryValuesBoolColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('entry_values') && normalized.includes('value_bool') && normalized.includes('does not exist')
}

function isMissingCalculatedValuesBoolColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('calculated_values') && normalized.includes('value_bool') && normalized.includes('does not exist')
}

function requiresCalculatedValuesVersionHash(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('version_hash') && normalized.includes('null value in column')
}

function isMissingCalculatedValuesVersionHashColumn(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('version_hash') && normalized.includes('does not exist')
}

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function optionalUuidField(formData: FormData, key: string) {
  const value = field(formData, key).trim()
  return value || undefined
}

function numericField(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: true as const, value: null as number | null }
  }

  const value = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(value)) {
    return { ok: false as const, message: 'Invalid numeric value.' }
  }

  return { ok: true as const, value }
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
}

async function getActorContext() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false as const, message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.' }
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
    .select('company_id, role, is_active, deleted_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id || !profile?.role || profile.is_active === false || profile.deleted_at) {
    return { ok: false as const, message: 'Active company profile not found.' }
  }

  return {
    ok: true as const,
    admin,
    userId: user.id,
    companyId: profile.company_id as string,
    role: profile.role as Role,
  }
}

async function getAccessibleDepartmentIds(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
  role: Role,
) {
  if (role === 'owner' || role === 'manager') {
    const { data, error } = await admin
      .from('departments')
      .select('department_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (error) {
      return { ok: false as const, message: formatDatabaseError(error.message), departmentIds: [] as string[] }
    }

    return {
      ok: true as const,
      departmentIds: (data ?? []).map((item) => item.department_id as string),
    }
  }

  const { data, error } = await admin
    .from('department_members')
    .select('department_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message), departmentIds: [] as string[] }
  }

  return {
    ok: true as const,
    departmentIds: (data ?? []).map((item) => item.department_id as string),
  }
}

async function isUserInDepartment(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  userId: string,
) {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile) {
    return { ok: false as const, message: 'Agent not found in company.' }
  }

  const { data: membership, error: membershipError } = await admin
    .from('department_members')
    .select('department_id')
    .eq('department_id', departmentId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, message: formatDatabaseError(membershipError.message) }
  }

  if (!membership) {
    return { ok: false as const, message: 'Agent is not active in this department.' }
  }

  return { ok: true as const }
}

async function getManualMetricsForDepartment(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
) {
  const withSettings = await admin
    .from('metrics')
    .select('metric_id, data_type, settings')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)

  if (!withSettings.error) {
    return {
      ok: true as const,
      metrics: (withSettings.data ?? []) as Array<{ metric_id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
    }
  }

  if (!isMissingMetricsSettingsColumn(withSettings.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(withSettings.error.message),
      metrics: [] as Array<{ metric_id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
    }
  }

  const fallback = await admin
    .from('metrics')
    .select('metric_id, data_type')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .eq('input_mode', 'manual')
    .is('deleted_at', null)

  if (fallback.error) {
    return {
      ok: false as const,
      message: formatDatabaseError(fallback.error.message),
      metrics: [] as Array<{ metric_id: string; data_type: DailyLogMetricDataType; settings: unknown }>,
    }
  }

  const metrics = ((fallback.data ?? []) as Array<{ metric_id: string; data_type: DailyLogMetricDataType }>).map(
    (metric) => ({
      ...metric,
      settings: null,
    }),
  )

  return {
    ok: true as const,
    metrics,
  }
}

function durationToSeconds(rawValue: string, format: DurationFormat) {
  if (format === 'hh_mm_ss') {
    return parseDurationToSeconds(rawValue)
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return { ok: true as const, value: null as number | null }
  }

  const numberValue = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(numberValue) || numberValue < 0) {
    return { ok: false as const, message: 'Invalid duration value.' }
  }

  const multiplier = format === 'minutes' ? 60 : format === 'hours' ? 3600 : 86400
  return { ok: true as const, value: numberValue * multiplier }
}

function parseMetricValue(
  metricType: DailyLogMetricDataType,
  metricSettings: unknown,
  rawValue: string,
):
  | { ok: true; hasValue: false }
  | { ok: true; hasValue: true; value_numeric: number | null; value_text: string | null; value_bool: boolean | null }
  | { ok: false; message: string } {
  const settings = normalizeMetricSettings(metricType, metricSettings)

  if (metricType === 'boolean') {
    const normalized = rawValue.trim()
    if (!normalized) {
      return { ok: true, hasValue: false }
    }

    const labels = booleanLabels(settings)
    const parsedBool = parseBooleanInput(normalized, labels)
    if (parsedBool === null) {
      return { ok: false, message: 'Invalid boolean value.' }
    }

    return {
      ok: true,
      hasValue: true,
      value_numeric: null,
      value_text: null,
      value_bool: parsedBool,
    }
  }

  if (metricType === 'duration') {
    const durationResult = durationToSeconds(rawValue, settings.durationFormat ?? 'hh_mm_ss')
    if (!durationResult.ok) {
      return { ok: false, message: durationResult.message }
    }

    if (durationResult.value === null) {
      return { ok: true, hasValue: false }
    }

    return {
      ok: true,
      hasValue: true,
      value_numeric: durationResult.value,
      value_text: null,
      value_bool: null,
    }
  }

  if (metricType === 'text' || metricType === 'datetime' || metricType === 'selection' || metricType === 'file') {
    const value = rawValue.trim()
    if (!value) {
      return { ok: true, hasValue: false }
    }

    if (metricType === 'text') {
      if (settings.textFormat === 'email') {
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        if (!validEmail) {
          return { ok: false, message: 'Invalid email format.' }
        }
      }

      if (settings.textFormat === 'url') {
        try {
          new URL(value)
        } catch {
          return { ok: false, message: 'Invalid URL format.' }
        }
      }
    }

    if (metricType === 'datetime') {
      if (settings.datetimeFormat === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { ok: false, message: 'Invalid date format.' }
      }
      if (settings.datetimeFormat === 'time' && !/^\d{2}:\d{2}$/.test(value)) {
        return { ok: false, message: 'Invalid time format.' }
      }
      if (settings.datetimeFormat === 'datetime' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
        return { ok: false, message: 'Invalid date/time format.' }
      }
    }

    if (metricType === 'selection') {
      const options = settings.selectionOptions ?? []
      if (options.length === 0) {
        return { ok: false, message: 'Selection metric has no options.' }
      }

      if (settings.selectionMode === 'multi') {
        let selected: string[] = []
        try {
          selected = JSON.parse(value) as string[]
        } catch {
          selected = value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        }

        if (selected.length === 0) {
          return { ok: true, hasValue: false }
        }

        if (selected.some((item) => !options.includes(item))) {
          return { ok: false, message: 'Invalid selection option.' }
        }

        return {
          ok: true,
          hasValue: true,
          value_numeric: null,
          value_text: JSON.stringify(selected),
          value_bool: null,
        }
      }

      if (!options.includes(value)) {
        return { ok: false, message: 'Invalid selection option.' }
      }
    }

    if (metricType === 'file') {
      try {
        new URL(value)
      } catch {
        return { ok: false, message: 'Invalid file URL.' }
      }
    }

    return {
      ok: true,
      hasValue: true,
      value_numeric: null,
      value_text: value,
      value_bool: null,
    }
  }

  const parsedNumber = numericField(rawValue)
  if (!parsedNumber.ok) {
    return { ok: false, message: parsedNumber.message }
  }

  if (parsedNumber.value === null) {
    return { ok: true, hasValue: false }
  }

  if (metricType === 'number' && settings.numberKind === 'integer' && !Number.isInteger(parsedNumber.value)) {
    return { ok: false, message: 'Only whole numbers are allowed.' }
  }

  return {
    ok: true,
    hasValue: true,
    value_numeric: parsedNumber.value,
    value_text: null,
    value_bool: null,
  }
}

function formulaValueTypeForMetricDataType(dataType: DailyLogMetricDataType): FormulaValueType | null {
  if (dataType === 'boolean') {
    return 'boolean'
  }

  if (dataType === 'number' || dataType === 'currency' || dataType === 'percent' || dataType === 'duration') {
    return 'number'
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

type RecomputedCalculatedRow = {
  entry_id: string
  metric_id: string
  value_numeric: number | null
  value_bool: boolean | null
  computed_at: string
  formula_id: string
  calc_trace: Record<string, unknown>
}

async function insertLegacyNumericCalculatedRows(
  admin: ReturnType<typeof createAdminClient>,
  rows: RecomputedCalculatedRow[],
) {
  if (rows.some((row) => row.value_bool !== null)) {
    return {
      ok: false as const,
      message: 'Boolean calculated metrics require the latest database migration. Please run migrations and try again.',
    }
  }

  const baseRows = rows.map((row) => ({
    entry_id: row.entry_id,
    metric_id: row.metric_id,
    value_numeric: row.value_numeric,
    computed_at: row.computed_at,
    formula_id: row.formula_id,
    calc_trace: row.calc_trace,
  }))

  const firstAttempt = await admin.from('calculated_values').insert(baseRows)
  if (!firstAttempt.error) {
    return { ok: true as const }
  }

  if (!requiresCalculatedValuesVersionHash(firstAttempt.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(firstAttempt.error.message),
    }
  }

  const withVersionHashRows = baseRows.map((row) => ({
    ...row,
    version_hash: `notion_v1:${row.formula_id}`,
  }))
  const secondAttempt = await admin.from('calculated_values').insert(withVersionHashRows)
  if (!secondAttempt.error) {
    return { ok: true as const }
  }

  if (isMissingCalculatedValuesVersionHashColumn(secondAttempt.error.message)) {
    return {
      ok: false as const,
      message: formatDatabaseError(firstAttempt.error.message),
    }
  }

  return {
    ok: false as const,
    message: formatDatabaseError(secondAttempt.error.message),
  }
}

async function recomputeCalculatedMetricsForEntry(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  departmentId: string,
  entryId: string,
) {
  const { data: metricsData, error: metricsError } = await admin
    .from('metrics')
    .select('metric_id, code, data_type, input_mode')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (metricsError) {
    return { ok: false as const, message: formatDatabaseError(metricsError.message) }
  }

  const metrics = (metricsData ?? []) as Array<{
    metric_id: string
    code: string
    data_type: DailyLogMetricDataType
    input_mode: 'manual' | 'calculated'
  }>
  const calculatedMetrics = metrics.filter((metric) => metric.input_mode === 'calculated')
  const calculatedMetricIds = calculatedMetrics.map((metric) => metric.metric_id)

  if (calculatedMetricIds.length === 0) {
    const { error: clearMirrorError } = await admin
      .from('entry_values')
      .delete()
      .eq('entry_id', entryId)
      .eq('value_source', 'calculated')

    if (clearMirrorError) {
      return { ok: false as const, message: formatDatabaseError(clearMirrorError.message) }
    }

    const { error: clearCalculatedValuesError } = await admin
      .from('calculated_values')
      .delete()
      .eq('entry_id', entryId)

    if (clearCalculatedValuesError) {
      return { ok: false as const, message: formatDatabaseError(clearCalculatedValuesError.message) }
    }

    return { ok: true as const }
  }

  const typedFormulas = await admin
    .from('metric_formulas')
    .select('formula_id, metric_id, expression, ast_json, return_type')
    .in('metric_id', calculatedMetricIds)
    .eq('is_current', true)

  let formulas: Array<{
    formula_id: string
    metric_id: string
    expression: string
    ast_json: unknown
    return_type: string | null
  }> = []

  if (!typedFormulas.error) {
    formulas = (typedFormulas.data ?? []) as typeof formulas
  } else if (isMissingTypedFormulaColumns(typedFormulas.error.message)) {
    const legacyFormulas = await admin
      .from('metric_formulas')
      .select('formula_id, metric_id, expression')
      .in('metric_id', calculatedMetricIds)
      .eq('is_current', true)

    if (legacyFormulas.error) {
      return { ok: false as const, message: formatDatabaseError(legacyFormulas.error.message) }
    }

    formulas = ((legacyFormulas.data ?? []) as Array<{
      formula_id: string
      metric_id: string
      expression: string
    }>).map((formula) => ({
      ...formula,
      ast_json: null,
      return_type: null,
    }))
  } else {
    return { ok: false as const, message: formatDatabaseError(typedFormulas.error.message) }
  }

  const formulaByMetricId = new Map(formulas.map((formula) => [formula.metric_id, formula]))

  for (const metric of calculatedMetrics) {
    if (!formulaByMetricId.has(metric.metric_id)) {
      return {
        ok: false as const,
        message: `Calculated metric "${metric.code}" is missing a current formula.`,
      }
    }
  }

  const { data: depsData, error: depsError } = await admin
    .from('metric_formula_dependencies')
    .select('metric_id, depends_on_metric_id')
    .in('metric_id', calculatedMetricIds)

  if (depsError) {
    return { ok: false as const, message: formatDatabaseError(depsError.message) }
  }

  const calculatedMetricSet = new Set(calculatedMetricIds)
  const dependencyMap = new Map<string, string[]>()
  for (const item of (depsData ?? []) as Array<{ metric_id: string; depends_on_metric_id: string }>) {
    if (!calculatedMetricSet.has(item.metric_id)) {
      continue
    }
    const existing = dependencyMap.get(item.metric_id) ?? []
    existing.push(item.depends_on_metric_id)
    dependencyMap.set(item.metric_id, existing)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const evaluationOrder: string[] = []

  function visit(metricId: string) {
    if (visited.has(metricId)) {
      return
    }
    if (visiting.has(metricId)) {
      throw new Error('Circular dependency detected while recalculating formulas.')
    }

    visiting.add(metricId)
    for (const dependsOnMetricId of dependencyMap.get(metricId) ?? []) {
      if (calculatedMetricSet.has(dependsOnMetricId)) {
        visit(dependsOnMetricId)
      }
    }
    visiting.delete(metricId)
    visited.add(metricId)
    evaluationOrder.push(metricId)
  }

  try {
    for (const metricId of calculatedMetricIds) {
      visit(metricId)
    }
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : 'Failed to sort calculated metric dependencies.',
    }
  }

  const entryValuesWithBool = await admin
    .from('entry_values')
    .select('metric_id, value_numeric, value_bool')
    .eq('entry_id', entryId)

  let entryValues: Array<{ metric_id: string; value_numeric: number | null; value_bool: boolean | null }> = []
  if (!entryValuesWithBool.error) {
    entryValues = (entryValuesWithBool.data ?? []) as typeof entryValues
  } else if (isMissingEntryValuesBoolColumn(entryValuesWithBool.error.message)) {
    const legacyEntryValues = await admin
      .from('entry_values')
      .select('metric_id, value_numeric')
      .eq('entry_id', entryId)

    if (legacyEntryValues.error) {
      return { ok: false as const, message: formatDatabaseError(legacyEntryValues.error.message) }
    }

    entryValues = ((legacyEntryValues.data ?? []) as Array<{ metric_id: string; value_numeric: number | null }>).map(
      (item) => ({
        metric_id: item.metric_id,
        value_numeric: item.value_numeric,
        value_bool: null,
      }),
    )
  } else {
    return { ok: false as const, message: formatDatabaseError(entryValuesWithBool.error.message) }
  }

  const valueByMetricId = new Map(entryValues.map((row) => [row.metric_id, row]))

  const metricsByCode = new Map(
    metrics
      .map((metric) => [metric.code.toLowerCase().trim(), metric] as const)
      .filter(([code]) => Boolean(code)),
  )
  const formulaTypeByCode = new Map<string, FormulaValueType>()
  for (const [code, metric] of metricsByCode.entries()) {
    const formulaType = formulaValueTypeForMetricDataType(metric.data_type)
    if (formulaType) {
      formulaTypeByCode.set(code, formulaType)
    }
  }

  const now = new Date().toISOString()
  const calculatedRows: RecomputedCalculatedRow[] = []

  for (const metricId of evaluationOrder) {
    const metric = calculatedMetrics.find((item) => item.metric_id === metricId)
    const formula = formulaByMetricId.get(metricId)
    if (!metric || !formula) {
      continue
    }

    const metricValues: Record<string, number | boolean | null | undefined> = {}
    for (const [code, dependencyMetric] of metricsByCode.entries()) {
      const formulaType = formulaTypeByCode.get(code)
      if (!formulaType) {
        continue
      }

      const value = valueByMetricId.get(dependencyMetric.metric_id)
      metricValues[code] = formulaType === 'boolean' ? value?.value_bool ?? null : value?.value_numeric ?? null
    }

    const astFromDb = isRecord(formula.ast_json) ? (formula.ast_json as FormulaAstNode) : null
    const expectedType = formula.return_type === 'boolean' || formula.return_type === 'number'
      ? formula.return_type
      : formulaValueTypeForMetricDataType(metric.data_type)

    if (!expectedType) {
      return {
        ok: false as const,
        message: `Calculated metric "${metric.code}" uses unsupported output type.`,
      }
    }

    let evaluated: { kind: FormulaValueType; value: number | boolean } | null = null
    if (astFromDb) {
      try {
        const astResult = evaluateFormulaAst(astFromDb, {
          metricValues,
          metricReturnTypes: formulaTypeByCode,
        })

        evaluated = {
          kind: astResult.kind,
          value: astResult.value,
        }
      } catch {
        // fallback to expression parse/evaluation below
      }
    }

    if (!evaluated) {
      const expressionResult = evaluateFormulaExpression(formula.expression, {
        metricValues,
        metricReturnTypes: formulaTypeByCode,
      })

      if (!expressionResult.success) {
        return {
          ok: false as const,
          message: `Formula evaluation failed for "${metric.code}": ${expressionResult.error}`,
        }
      }

      evaluated = {
        kind: expressionResult.value.kind,
        value: expressionResult.value.value,
      }
    }

    if (evaluated.kind !== expectedType) {
      return {
        ok: false as const,
        message: `Formula return type mismatch for "${metric.code}". Expected ${expectedType}.`,
      }
    }

    const nextValue =
      evaluated.kind === 'boolean'
        ? { value_numeric: null, value_bool: Boolean(evaluated.value) }
        : { value_numeric: Number(evaluated.value), value_bool: null }

    valueByMetricId.set(metricId, {
      metric_id: metricId,
      value_numeric: nextValue.value_numeric,
      value_bool: nextValue.value_bool,
    })

    calculatedRows.push({
      entry_id: entryId,
      metric_id: metricId,
      value_numeric: nextValue.value_numeric,
      value_bool: nextValue.value_bool,
      computed_at: now,
      formula_id: formula.formula_id,
      calc_trace: {
        engine: 'notion_v1',
        evaluated_at: now,
      },
    })
  }

  const { error: deleteCalculatedError } = await admin
    .from('calculated_values')
    .delete()
    .eq('entry_id', entryId)

  if (deleteCalculatedError) {
    return { ok: false as const, message: formatDatabaseError(deleteCalculatedError.message) }
  }

  const { error: deleteMirrorError } = await admin
    .from('entry_values')
    .delete()
    .eq('entry_id', entryId)
    .eq('value_source', 'calculated')

  if (deleteMirrorError) {
    return { ok: false as const, message: formatDatabaseError(deleteMirrorError.message) }
  }

  if (calculatedRows.length > 0) {
    const { error: insertCalculatedError } = await admin.from('calculated_values').insert(calculatedRows)
    if (!insertCalculatedError) {
      return { ok: true as const }
    }

    if (requiresCalculatedValuesVersionHash(insertCalculatedError.message)) {
      const typedRowsWithVersionHash = calculatedRows.map((row) => ({
        ...row,
        version_hash: `notion_v1:${row.formula_id}`,
      }))
      const { error: insertTypedWithVersionHashError } = await admin
        .from('calculated_values')
        .insert(typedRowsWithVersionHash)

      if (!insertTypedWithVersionHashError) {
        return { ok: true as const }
      }

      const shouldStopOnTypedVersionHashError =
        !isMissingCalculatedValuesBoolColumn(insertTypedWithVersionHashError.message) &&
        !isMissingCalculatedValuesVersionHashColumn(insertTypedWithVersionHashError.message) &&
        !requiresCalculatedValuesVersionHash(insertTypedWithVersionHashError.message)

      if (shouldStopOnTypedVersionHashError) {
        return { ok: false as const, message: formatDatabaseError(insertTypedWithVersionHashError.message) }
      }
    }

    const shouldFallbackToLegacyInsert =
      isMissingCalculatedValuesBoolColumn(insertCalculatedError.message) ||
      requiresCalculatedValuesVersionHash(insertCalculatedError.message) ||
      isMissingCalculatedValuesVersionHashColumn(insertCalculatedError.message)

    if (!shouldFallbackToLegacyInsert) {
      return { ok: false as const, message: formatDatabaseError(insertCalculatedError.message) }
    }

    const legacyInsertResult = await insertLegacyNumericCalculatedRows(admin, calculatedRows)
    if (!legacyInsertResult.ok) {
      return legacyInsertResult
    }
  }

  return { ok: true as const }
}

export async function saveDailyLogAction(
  _prevState: DailyLogActionState,
  formData: FormData,
): Promise<DailyLogActionState> {
  const parsed = dailyLogFormSchema.safeParse({
    date: field(formData, 'date'),
    departmentId: field(formData, 'departmentId'),
    userId: optionalUuidField(formData, 'userId'),
    notes: field(formData, 'notes'),
    intent: field(formData, 'intent') || 'draft',
  })

  if (!parsed.success) {
    return {
      ...INITIAL_ERROR_STATE,
      message: zodMessage(parsed.error),
    }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: context.message,
      intent: parsed.data.intent,
    }
  }

  try {
    requireRole(context.role, 'member')
  } catch {
    return {
      ...INITIAL_ERROR_STATE,
      message: 'Insufficient permissions.',
      intent: parsed.data.intent,
    }
  }

  const accessibleDepartments = await getAccessibleDepartmentIds(
    context.admin,
    context.companyId,
    context.userId,
    context.role,
  )

  if (!accessibleDepartments.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: accessibleDepartments.message,
      intent: parsed.data.intent,
    }
  }

  if (!accessibleDepartments.departmentIds.includes(parsed.data.departmentId)) {
    return {
      ...INITIAL_ERROR_STATE,
      message: 'You do not have access to this department.',
      intent: parsed.data.intent,
    }
  }

  const targetUserId =
    context.role === 'owner' || context.role === 'manager'
      ? (parsed.data.userId ?? '')
      : context.userId

  if (!targetUserId) {
    return {
      ...INITIAL_ERROR_STATE,
      message: 'Select an agent first.',
      intent: parsed.data.intent,
    }
  }

  if (context.role === 'owner' || context.role === 'manager') {
    const targetValidation = await isUserInDepartment(
      context.admin,
      context.companyId,
      parsed.data.departmentId,
      targetUserId,
    )

    if (!targetValidation.ok) {
      return {
        ...INITIAL_ERROR_STATE,
        message: targetValidation.message,
        intent: parsed.data.intent,
      }
    }
  }

  const metricsResult = await getManualMetricsForDepartment(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
  )

  if (!metricsResult.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: metricsResult.message,
      intent: parsed.data.intent,
    }
  }

  const valueRows: Array<{
    metric_id: string
    value_numeric: number | null
    value_text: string | null
    value_bool: boolean | null
  }> = []

  for (const metric of metricsResult.metrics) {
    const raw = field(formData, `metric_${metric.metric_id}`)
    const parsedValue = parseMetricValue(metric.data_type, metric.settings, raw)

    if (!parsedValue.ok) {
      return {
        ...INITIAL_ERROR_STATE,
        message: `${metric.data_type === 'duration' ? 'Duration' : 'Metric'}: ${parsedValue.message}`,
        intent: parsed.data.intent,
      }
    }

    if (!parsedValue.hasValue) {
      continue
    }

    valueRows.push({
      metric_id: metric.metric_id,
      value_numeric: parsedValue.value_numeric,
      value_text: parsedValue.value_text,
      value_bool: parsedValue.value_bool,
    })
  }

  const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null
  const now = new Date().toISOString()
  const submitting = parsed.data.intent === 'submit'

  const { data: existingEntry, error: existingEntryError } = await context.admin
    .from('daily_entries')
    .select('entry_id, status, submitted_at')
    .eq('company_id', context.companyId)
    .eq('department_id', parsed.data.departmentId)
    .eq('user_id', targetUserId)
    .eq('entry_date', parsed.data.date)
    .maybeSingle()

  if (existingEntryError) {
    return {
      ...INITIAL_ERROR_STATE,
      message: formatDatabaseError(existingEntryError.message),
      intent: parsed.data.intent,
    }
  }

  const nextEntryStatus = submitting || existingEntry?.status === 'submitted' ? 'submitted' : 'draft'
  const nextSubmittedAt =
    submitting ? now : nextEntryStatus === 'submitted' ? (existingEntry?.submitted_at ?? now) : null

  const { data: entry, error: entryError } = await context.admin
    .from('daily_entries')
    .upsert(
      {
        company_id: context.companyId,
        department_id: parsed.data.departmentId,
        user_id: targetUserId,
        entry_date: parsed.data.date,
        status: nextEntryStatus,
        submitted_at: nextSubmittedAt,
        notes,
        updated_at: now,
      },
      { onConflict: 'company_id,department_id,user_id,entry_date' },
    )
    .select('entry_id')
    .maybeSingle()

  if (entryError || !entry?.entry_id) {
    return {
      ...INITIAL_ERROR_STATE,
      message: formatDatabaseError(entryError?.message ?? 'Failed to save entry.'),
      intent: parsed.data.intent,
    }
  }

  const { error: deleteValuesError } = await context.admin
    .from('entry_values')
    .delete()
    .eq('entry_id', entry.entry_id)
    .eq('value_source', 'manual')

  if (deleteValuesError) {
    return {
      ...INITIAL_ERROR_STATE,
      message: formatDatabaseError(deleteValuesError.message),
      intent: parsed.data.intent,
      entryId: entry.entry_id,
    }
  }

  if (valueRows.length > 0) {
    const { error: insertValuesError } = await context.admin.from('entry_values').insert(
      valueRows.map((row) => ({
        entry_id: entry.entry_id,
        metric_id: row.metric_id,
        value_numeric: row.value_numeric,
        value_text: row.value_text,
        value_bool: row.value_bool,
        value_source: 'manual',
      })),
    )

    if (insertValuesError) {
      return {
        ...INITIAL_ERROR_STATE,
        message: formatDatabaseError(insertValuesError.message),
        intent: parsed.data.intent,
        entryId: entry.entry_id,
      }
    }
  }

  const recalcResult = await recomputeCalculatedMetricsForEntry(
    context.admin,
    context.companyId,
    parsed.data.departmentId,
    entry.entry_id,
  )

  if (!recalcResult.ok) {
    return {
      ...INITIAL_ERROR_STATE,
      message: recalcResult.message,
      intent: parsed.data.intent,
      entryId: entry.entry_id,
    }
  }

  revalidatePath(ROUTES.DAILY_LOG)

  return {
    status: 'success',
    message: submitting ? 'Log submitted successfully.' : 'Draft saved.',
    intent: parsed.data.intent,
    entryStatus: nextEntryStatus,
    savedAt: now,
    entryId: entry.entry_id,
  }
}

export async function deleteDailyLogAction(formData: FormData): Promise<void> {
  const parsed = deleteDailyLogSchema.safeParse({
    entryId: field(formData, 'entryId'),
  })

  if (!parsed.success) {
    return
  }

  const context = await getActorContext()
  if (!context.ok) {
    return
  }

  const { data: entry, error: entryError } = await context.admin
    .from('daily_entries')
    .select('entry_id, company_id, department_id, user_id')
    .eq('entry_id', parsed.data.entryId)
    .maybeSingle()

  if (entryError || !entry || entry.company_id !== context.companyId) {
    return
  }

  if (context.role === 'member' && entry.user_id !== context.userId) {
    return
  }

  if (context.role !== 'member') {
    const accessibleDepartments = await getAccessibleDepartmentIds(
      context.admin,
      context.companyId,
      context.userId,
      context.role,
    )

    if (!accessibleDepartments.ok || !accessibleDepartments.departmentIds.includes(entry.department_id as string)) {
      return
    }
  }

  const { error: deleteError } = await context.admin
    .from('daily_entries')
    .delete()
    .eq('entry_id', parsed.data.entryId)
    .eq('company_id', context.companyId)

  if (deleteError) {
    return
  }

  revalidatePath(ROUTES.DAILY_LOG)
}

export async function updateDepartmentLogKeyMetricsAction(
  _prevState: DailyLogKeyMetricsActionState,
  formData: FormData,
): Promise<DailyLogKeyMetricsActionState> {
  const parsed = keyMetricsSchema.safeParse({
    departmentId: field(formData, 'departmentId'),
    slot1: optionalUuidField(formData, 'slot1'),
    slot2: optionalUuidField(formData, 'slot2'),
    slot3: optionalUuidField(formData, 'slot3'),
  })

  if (!parsed.success) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: zodMessage(parsed.error),
    }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: context.message,
    }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: 'Insufficient permissions.',
    }
  }

  const slotValues = [parsed.data.slot1, parsed.data.slot2, parsed.data.slot3].filter(Boolean) as string[]
  const uniqueMetricIds = new Set(slotValues)

  if (uniqueMetricIds.size !== slotValues.length) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: 'Choose different metrics for each slot.',
    }
  }

  const { data: department, error: departmentError } = await context.admin
    .from('departments')
    .select('department_id')
    .eq('department_id', parsed.data.departmentId)
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (departmentError || !department) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: formatDatabaseError(departmentError?.message ?? 'Department not found.'),
    }
  }

  if (slotValues.length > 0) {
    const { data: metrics, error: metricsError } = await context.admin
      .from('metrics')
      .select('metric_id')
      .eq('company_id', context.companyId)
      .eq('department_id', parsed.data.departmentId)
      .eq('is_active', true)
      .eq('input_mode', 'manual')
      .in('metric_id', slotValues)
      .is('deleted_at', null)

    if (metricsError) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: formatDatabaseError(metricsError.message),
      }
    }

    if ((metrics ?? []).length !== slotValues.length) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: 'One or more selected metrics are invalid for this department.',
      }
    }
  }

  const { error: clearError } = await context.admin
    .from('department_log_key_metrics')
    .delete()
    .eq('department_id', parsed.data.departmentId)

  if (clearError) {
    return {
      ...KEY_METRIC_ERROR_STATE,
      message: formatDatabaseError(clearError.message),
    }
  }

  const rows = [
    { slot: 1, metricId: parsed.data.slot1 },
    { slot: 2, metricId: parsed.data.slot2 },
    { slot: 3, metricId: parsed.data.slot3 },
  ].filter((item) => item.metricId)

  if (rows.length > 0) {
    const { error: insertError } = await context.admin.from('department_log_key_metrics').insert(
      rows.map((row) => ({
        department_id: parsed.data.departmentId,
        slot: row.slot,
        metric_id: row.metricId,
      })),
    )

    if (insertError) {
      return {
        ...KEY_METRIC_ERROR_STATE,
        message: formatDatabaseError(insertError.message),
      }
    }
  }

  revalidatePath(ROUTES.DAILY_LOG)

  return {
    status: 'success',
    message: 'History columns updated.',
  }
}
