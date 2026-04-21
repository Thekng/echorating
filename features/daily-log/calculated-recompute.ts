import { createAdminClient } from '@/lib/supabase/admin'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { type DailyLogMetricDataType } from './types'
import {
  evaluateFormulaAst,
  evaluateFormulaExpression,
  type FormulaAstNode,
  type FormulaValueType,
} from '@/lib/metrics/formula'

type AdminClient = ReturnType<typeof createAdminClient>

type RecomputedCalculatedRow = {
  entry_id: string
  metric_id: string
  value_numeric: number | null
  value_bool: boolean | null
  computed_at: string
  formula_id: string
  calc_trace: Record<string, unknown>
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

async function insertLegacyNumericCalculatedRows(admin: AdminClient, rows: RecomputedCalculatedRow[]) {
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
    return { ok: false as const, message: formatDatabaseError(firstAttempt.error.message) }
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
    return { ok: false as const, message: formatDatabaseError(firstAttempt.error.message) }
  }

  return { ok: false as const, message: formatDatabaseError(secondAttempt.error.message) }
}

export async function recomputeCalculatedMetricsForEntry(
  admin: AdminClient,
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

export async function enqueueCalculatedRecomputeJob(
  admin: AdminClient,
  companyId: string,
  departmentId: string,
  entryId: string,
) {
  const { error } = await admin.rpc('enqueue_calculated_recompute_job', {
    p_entry_id: entryId,
    p_company_id: companyId,
    p_department_id: departmentId,
  })

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message) }
  }

  return { ok: true as const }
}
