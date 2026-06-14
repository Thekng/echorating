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
  daily_report_id: string
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

export async function recomputeCalculatedMetricsForEntry(
  admin: AdminClient,
  organizationId: string,
  departmentId: string,
  reportId: string,
) {
  const { data: metricsData, error: metricsError } = await admin
    .from('metrics')
    .select('id, code, data_type, input_mode')
    .eq('organization_id', organizationId)
    .eq('department_id', departmentId)
    .eq('is_active', true)

  if (metricsError) {
    return { ok: false as const, message: formatDatabaseError(metricsError.message) }
  }

  const metrics = (metricsData ?? []) as Array<{
    id: string
    code: string
    data_type: DailyLogMetricDataType
    input_mode: 'manual' | 'calculated'
  }>
  const calculatedMetrics = metrics.filter((metric) => metric.input_mode === 'calculated')
  const calculatedMetricIds = calculatedMetrics.map((metric) => metric.id)

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
    if (!formulaByMetricId.has(metric.id)) {
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

  const { data: entryValuesData, error: entryValuesError } = await admin
    .from('daily_report_values')
    .select('metric_id, value_number, value_boolean')
    .eq('daily_report_id', reportId)

  if (entryValuesError) {
    return { ok: false as const, message: formatDatabaseError(entryValuesError.message) }
  }

  const entryValues = (entryValuesData ?? []) as Array<{ metric_id: string; value_number: number | null; value_boolean: boolean | null }>
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
    const metric = calculatedMetrics.find((item) => item.id === metricId)
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

      const value = valueByMetricId.get(dependencyMetric.id)
      metricValues[code] = formulaType === 'boolean' ? value?.value_boolean ?? null : value?.value_number ?? null
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
      value_number: nextValue.value_numeric,
      value_boolean: nextValue.value_bool,
    })

    calculatedRows.push({
      daily_report_id: reportId,
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
    // Try inserting into calculated_values (legacy table)
    const legacyRows = calculatedRows.map((row) => ({
      entry_id: row.daily_report_id,
      metric_id: row.metric_id,
      value_numeric: row.value_numeric,
      value_bool: row.value_bool,
      computed_at: row.computed_at,
      formula_id: row.formula_id,
      calc_trace: row.calc_trace,
    }))

    const { error: insertCalculatedError } = await admin.from('calculated_values').insert(legacyRows)
    if (!insertCalculatedError) {
      return { ok: true as const }
    }

    if (requiresCalculatedValuesVersionHash(insertCalculatedError.message)) {
      const withVersionHashRows = legacyRows.map((row) => ({
        ...row,
        version_hash: `notion_v1:${row.formula_id}`,
      }))
      const { error: insertWithVersionHashError } = await admin
        .from('calculated_values')
        .insert(withVersionHashRows)

      if (!insertWithVersionHashError) {
        return { ok: true as const }
      }

      if (!isMissingCalculatedValuesVersionHashColumn(insertWithVersionHashError.message)) {
        return { ok: false as const, message: formatDatabaseError(insertWithVersionHashError.message) }
      }
    }

    // If all insert attempts failed, log but don't fail the recompute
    console.warn('[CALCULATED_VALUES_INSERT_FAILED]', insertCalculatedError.message)
  }

  return { ok: true as const }
}

export async function enqueueCalculatedRecomputeJob(
  admin: AdminClient,
  organizationId: string,
  departmentId: string,
  reportId: string,
) {
  const { error } = await admin.rpc('enqueue_calculated_recompute_job', {
    p_report_id: reportId,
    p_organization_id: organizationId,
    p_department_id: departmentId,
  })

  if (error) {
    return { ok: false as const, message: formatDatabaseError(error.message) }
  }

  return { ok: true as const }
}
