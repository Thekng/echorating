import { createClient } from '@supabase/supabase-js'
import { parseFormulaExpression, type FormulaValueType } from '../lib/metrics/formula.ts'

type MetricRow = {
  metric_id: string
  department_id: string
  code: string
  data_type: string
  is_active: boolean
  deleted_at: string | null
}

type FormulaRow = {
  formula_id: string
  metric_id: string
  expression: string
  is_current: boolean
}

type DependencyRow = {
  metric_id: string
  depends_on_metric_id: string
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function toSortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort()
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

function formulaTypeForMetricDataType(dataType: string): FormulaValueType | null {
  if (dataType === 'boolean') {
    return 'boolean'
  }

  if (dataType === 'number' || dataType === 'currency' || dataType === 'percent' || dataType === 'duration') {
    return 'number'
  }

  return null
}

async function main() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: metricsData, error: metricsError } = await admin
    .from('metrics')
    .select('metric_id, department_id, code, data_type, is_active, deleted_at')
    .is('deleted_at', null)

  if (metricsError) {
    throw new Error(`Unable to load metrics: ${metricsError.message}`)
  }

  const metrics = (metricsData ?? []) as MetricRow[]
  const metricById = new Map(metrics.map((metric) => [metric.metric_id, metric]))
  const activeMetricIdByDeptCode = new Map<string, string>()
  const activeMetricTypeByDeptCode = new Map<string, FormulaValueType>()

  for (const metric of metrics) {
    if (!metric.is_active) {
      continue
    }

    const code = metric.code.trim().toLowerCase()
    if (!code) {
      continue
    }

    const key = `${metric.department_id}:${code}`
    if (activeMetricIdByDeptCode.has(key)) {
      throw new Error(`Duplicate active metric code "${metric.code}" in department ${metric.department_id}.`)
    }

    activeMetricIdByDeptCode.set(key, metric.metric_id)

    const formulaType = formulaTypeForMetricDataType(metric.data_type)
    if (formulaType) {
      activeMetricTypeByDeptCode.set(key, formulaType)
    }
  }

  const { data: formulasData, error: formulasError } = await admin
    .from('metric_formulas')
    .select('formula_id, metric_id, expression, is_current')
    .order('formula_id', { ascending: true })

  if (formulasError) {
    throw new Error(`Unable to load metric formulas: ${formulasError.message}`)
  }

  const formulas = (formulasData ?? []) as FormulaRow[]
  if (formulas.length === 0) {
    console.log('No formulas found. Nothing to migrate.')
    return
  }

  const { data: dependencyData, error: dependencyError } = await admin
    .from('metric_formula_dependencies')
    .select('metric_id, depends_on_metric_id')

  if (dependencyError) {
    throw new Error(`Unable to load formula dependencies: ${dependencyError.message}`)
  }

  const existingDepsByMetric = new Map<string, string[]>()
  for (const row of (dependencyData ?? []) as DependencyRow[]) {
    const current = existingDepsByMetric.get(row.metric_id) ?? []
    current.push(row.depends_on_metric_id)
    existingDepsByMetric.set(row.metric_id, current)
  }

  const computedDepsByMetric = new Map<string, string[]>()
  const formulaUpdates: Array<{
    formula_id: string
    ast_json: Record<string, unknown>
    return_type: 'number'
    engine_version: 'notion_v1'
  }> = []

  for (const formula of formulas) {
    const metric = metricById.get(formula.metric_id)
    if (!metric) {
      throw new Error(`Formula ${formula.formula_id} references missing metric ${formula.metric_id}.`)
    }

    const metricReturnTypes = new Map<string, FormulaValueType>()
    for (const [deptCode, type] of activeMetricTypeByDeptCode.entries()) {
      const [departmentId, code] = deptCode.split(':', 2)
      if (departmentId === metric.department_id) {
        metricReturnTypes.set(code, type)
      }
    }

    const parsed = parseFormulaExpression(formula.expression ?? '')
    if (!parsed.success) {
      throw new Error(`Formula ${formula.formula_id} failed to parse: ${parsed.error}`)
    }

    if (parsed.returnType !== 'number') {
      throw new Error(
        `Formula ${formula.formula_id} for metric ${formula.metric_id} is ${parsed.returnType}. Existing formulas must resolve to number.`,
      )
    }

    formulaUpdates.push({
      formula_id: formula.formula_id,
      ast_json: parsed.ast as unknown as Record<string, unknown>,
      return_type: 'number',
      engine_version: 'notion_v1',
    })

    if (!formula.is_current) {
      continue
    }

    const dependencyIds = parsed.metricCodes.map((code) => {
      const metricKey = `${metric.department_id}:${code}`
      const dependencyId = activeMetricIdByDeptCode.get(metricKey)

      if (!dependencyId) {
        throw new Error(
          `Formula ${formula.formula_id} references unknown/inactive metric code "${code}" in department ${metric.department_id}.`,
        )
      }

      if (dependencyId === metric.metric_id) {
        throw new Error(`Formula ${formula.formula_id} has a self-reference on metric ${metric.metric_id}.`)
      }

      if (!metricReturnTypes.has(code)) {
        throw new Error(
          `Formula ${formula.formula_id} references unsupported metric code "${code}" for typed formulas.`,
        )
      }

      return dependencyId
    })

    computedDepsByMetric.set(metric.metric_id, toSortedUnique(dependencyIds))
  }

  const currentMetricIds = toSortedUnique(
    formulas.filter((formula) => formula.is_current).map((formula) => formula.metric_id),
  )

  for (const metricId of currentMetricIds) {
    const expected = computedDepsByMetric.get(metricId) ?? []
    const existing = toSortedUnique(existingDepsByMetric.get(metricId) ?? [])

    if (!arraysEqual(expected, existing)) {
      throw new Error(
        `Dependency mismatch for metric ${metricId}. expected=[${expected.join(', ')}] existing=[${existing.join(', ')}]`,
      )
    }
  }

  for (const metricId of currentMetricIds) {
    const expected = computedDepsByMetric.get(metricId) ?? []

    const { error: clearError } = await admin
      .from('metric_formula_dependencies')
      .delete()
      .eq('metric_id', metricId)

    if (clearError) {
      throw new Error(`Failed clearing dependencies for metric ${metricId}: ${clearError.message}`)
    }

    if (expected.length === 0) {
      continue
    }

    const { error: insertDepsError } = await admin.from('metric_formula_dependencies').insert(
      expected.map((dependsOnMetricId) => ({
        metric_id: metricId,
        depends_on_metric_id: dependsOnMetricId,
      })),
    )

    if (insertDepsError) {
      throw new Error(`Failed rebuilding dependencies for metric ${metricId}: ${insertDepsError.message}`)
    }
  }

  for (const update of formulaUpdates) {
    const { error: updateError } = await admin
      .from('metric_formulas')
      .update({
        ast_json: update.ast_json,
        return_type: update.return_type,
        engine_version: update.engine_version,
        updated_at: new Date().toISOString(),
      })
      .eq('formula_id', update.formula_id)

    if (updateError) {
      throw new Error(`Failed updating formula ${update.formula_id}: ${updateError.message}`)
    }
  }

  console.log(
    `Formula migration complete. Updated ${formulaUpdates.length} formulas and rebuilt dependencies for ${currentMetricIds.length} current metrics.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
