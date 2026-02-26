import { createClient } from '@supabase/supabase-js'
import {
  evaluateFormulaAst,
  evaluateFormulaExpression,
  type FormulaAstNode,
  type FormulaValueType,
} from '../lib/metrics/formula.ts'

type CliOptions = {
  companyId?: string
  departmentId?: string
  entryId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  batchSize: number
  dryRun: boolean
}

type EntryRow = {
  entry_id: string
  company_id: string
  department_id: string
  entry_date: string
}

type MetricRow = {
  metric_id: string
  code: string
  data_type: string
  input_mode: 'manual' | 'calculated'
}

type FormulaRow = {
  formula_id: string
  metric_id: string
  expression: string
  ast_json: unknown
  return_type: string | null
}

type FormulaDependencyRow = {
  metric_id: string
  depends_on_metric_id: string
}

type EntryValueRow = {
  metric_id: string
  value_numeric: number | null
  value_bool: boolean | null
}

type DepartmentComputeContext = {
  metrics: MetricRow[]
  calculatedMetrics: MetricRow[]
  formulaByMetricId: Map<string, FormulaRow>
  dependencyMap: Map<string, string[]>
  evaluationOrder: string[]
  metricsByCode: Map<string, MetricRow>
  formulaTypeByCode: Map<string, FormulaValueType>
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

type RecomputeResult =
  | { ok: true; inserted: number }
  | { ok: false; message: string }

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseOptions(): CliOptions {
  const options: CliOptions = {
    batchSize: 200,
    dryRun: false,
  }

  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg.startsWith('--company-id=')) {
      options.companyId = arg.slice('--company-id='.length).trim() || undefined
      continue
    }

    if (arg.startsWith('--department-id=')) {
      options.departmentId = arg.slice('--department-id='.length).trim() || undefined
      continue
    }

    if (arg.startsWith('--entry-id=')) {
      options.entryId = arg.slice('--entry-id='.length).trim() || undefined
      continue
    }

    if (arg.startsWith('--date-from=')) {
      options.dateFrom = arg.slice('--date-from='.length).trim() || undefined
      continue
    }

    if (arg.startsWith('--date-to=')) {
      options.dateTo = arg.slice('--date-to='.length).trim() || undefined
      continue
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length))
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed
      }
      continue
    }

    if (arg.startsWith('--batch-size=')) {
      const parsed = Number(arg.slice('--batch-size='.length))
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000) {
        options.batchSize = Math.floor(parsed)
      }
      continue
    }
  }

  return options
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function formulaValueTypeForMetricDataType(dataType: string): FormulaValueType | null {
  if (dataType === 'boolean') {
    return 'boolean'
  }

  if (dataType === 'number' || dataType === 'currency' || dataType === 'percent' || dataType === 'duration') {
    return 'number'
  }

  return null
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

async function loadDepartmentComputeContext(
  admin: any,
  companyId: string,
  departmentId: string,
): Promise<{ ok: true; context: DepartmentComputeContext } | { ok: false; message: string }> {
  const { data: metricsData, error: metricsError } = await admin
    .from('metrics')
    .select('metric_id, code, data_type, input_mode')
    .eq('company_id', companyId)
    .eq('department_id', departmentId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (metricsError) {
    return { ok: false, message: metricsError.message }
  }

  const metrics = (metricsData ?? []) as MetricRow[]
  const calculatedMetrics = metrics.filter((metric) => metric.input_mode === 'calculated')
  const calculatedMetricIds = calculatedMetrics.map((metric) => metric.metric_id)

  const formulaByMetricId = new Map<string, FormulaRow>()
  if (calculatedMetricIds.length > 0) {
    const typedFormulas = await admin
      .from('metric_formulas')
      .select('formula_id, metric_id, expression, ast_json, return_type')
      .in('metric_id', calculatedMetricIds)
      .eq('is_current', true)

    let formulas: FormulaRow[] = []
    if (!typedFormulas.error) {
      formulas = (typedFormulas.data ?? []) as FormulaRow[]
    } else if (isMissingTypedFormulaColumns(typedFormulas.error.message)) {
      const legacyFormulas = await admin
        .from('metric_formulas')
        .select('formula_id, metric_id, expression')
        .in('metric_id', calculatedMetricIds)
        .eq('is_current', true)

      if (legacyFormulas.error) {
        return { ok: false, message: legacyFormulas.error.message }
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
      return { ok: false, message: typedFormulas.error.message }
    }

    for (const formula of formulas) {
      formulaByMetricId.set(formula.metric_id, formula)
    }

    for (const metric of calculatedMetrics) {
      if (!formulaByMetricId.has(metric.metric_id)) {
        return {
          ok: false,
          message: `Calculated metric "${metric.code}" is missing a current formula.`,
        }
      }
    }
  }

  const dependencyMap = new Map<string, string[]>()
  if (calculatedMetricIds.length > 0) {
    const { data: dependencyData, error: dependencyError } = await admin
      .from('metric_formula_dependencies')
      .select('metric_id, depends_on_metric_id')
      .in('metric_id', calculatedMetricIds)

    if (dependencyError) {
      return { ok: false, message: dependencyError.message }
    }

    for (const row of (dependencyData ?? []) as FormulaDependencyRow[]) {
      const current = dependencyMap.get(row.metric_id) ?? []
      current.push(row.depends_on_metric_id)
      dependencyMap.set(row.metric_id, current)
    }
  }

  const calculatedMetricSet = new Set(calculatedMetricIds)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const evaluationOrder: string[] = []

  function visit(metricId: string) {
    if (visited.has(metricId)) {
      return
    }
    if (visiting.has(metricId)) {
      throw new Error('Circular dependency detected while backfilling calculated metrics.')
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
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to build formula evaluation order.',
    }
  }

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

  return {
    ok: true,
    context: {
      metrics,
      calculatedMetrics,
      formulaByMetricId,
      dependencyMap,
      evaluationOrder,
      metricsByCode,
      formulaTypeByCode,
    },
  }
}

async function loadEntryValues(
  admin: any,
  entryId: string,
): Promise<{ ok: true; values: EntryValueRow[] } | { ok: false; message: string }> {
  const withBool = await admin
    .from('entry_values')
    .select('metric_id, value_numeric, value_bool')
    .eq('entry_id', entryId)

  if (!withBool.error) {
    return {
      ok: true,
      values: (withBool.data ?? []) as EntryValueRow[],
    }
  }

  if (!isMissingEntryValuesBoolColumn(withBool.error.message)) {
    return { ok: false, message: withBool.error.message }
  }

  const legacy = await admin
    .from('entry_values')
    .select('metric_id, value_numeric')
    .eq('entry_id', entryId)

  if (legacy.error) {
    return { ok: false, message: legacy.error.message }
  }

  return {
    ok: true,
    values: ((legacy.data ?? []) as Array<{ metric_id: string; value_numeric: number | null }>).map((row) => ({
      metric_id: row.metric_id,
      value_numeric: row.value_numeric,
      value_bool: null,
    })),
  }
}

async function insertLegacyNumericCalculatedRows(
  admin: any,
  rows: RecomputedCalculatedRow[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (rows.some((row) => row.value_bool !== null)) {
    return {
      ok: false,
      message: 'Boolean calculated metrics require latest migration (calculated_values.value_bool).',
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

  const firstInsert = await admin.from('calculated_values').insert(baseRows)
  if (!firstInsert.error) {
    return { ok: true }
  }

  if (!requiresCalculatedValuesVersionHash(firstInsert.error.message)) {
    return { ok: false, message: firstInsert.error.message }
  }

  const withVersionHash = baseRows.map((row) => ({
    ...row,
    version_hash: `notion_v1:${row.formula_id}`,
  }))
  const secondInsert = await admin.from('calculated_values').insert(withVersionHash)
  if (!secondInsert.error) {
    return { ok: true }
  }

  if (isMissingCalculatedValuesVersionHashColumn(secondInsert.error.message)) {
    return { ok: false, message: firstInsert.error.message }
  }

  return { ok: false, message: secondInsert.error.message }
}

async function persistCalculatedRows(
  admin: any,
  entryId: string,
  rows: RecomputedCalculatedRow[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const deleteCalculated = await admin.from('calculated_values').delete().eq('entry_id', entryId)
  if (deleteCalculated.error) {
    return { ok: false, message: deleteCalculated.error.message }
  }

  const deleteMirror = await admin
    .from('entry_values')
    .delete()
    .eq('entry_id', entryId)
    .eq('value_source', 'calculated')

  if (deleteMirror.error) {
    return { ok: false, message: deleteMirror.error.message }
  }

  if (rows.length === 0) {
    return { ok: true }
  }

  const typedInsert = await admin.from('calculated_values').insert(rows)
  if (!typedInsert.error) {
    return { ok: true }
  }

  if (requiresCalculatedValuesVersionHash(typedInsert.error.message)) {
    const typedRowsWithVersionHash = rows.map((row) => ({
      ...row,
      version_hash: `notion_v1:${row.formula_id}`,
    }))
    const typedInsertWithHash = await admin.from('calculated_values').insert(typedRowsWithVersionHash)
    if (!typedInsertWithHash.error) {
      return { ok: true }
    }

    const shouldStop =
      !isMissingCalculatedValuesBoolColumn(typedInsertWithHash.error.message) &&
      !isMissingCalculatedValuesVersionHashColumn(typedInsertWithHash.error.message) &&
      !requiresCalculatedValuesVersionHash(typedInsertWithHash.error.message)

    if (shouldStop) {
      return { ok: false, message: typedInsertWithHash.error.message }
    }
  }

  const shouldFallback =
    isMissingCalculatedValuesBoolColumn(typedInsert.error.message) ||
    requiresCalculatedValuesVersionHash(typedInsert.error.message) ||
    isMissingCalculatedValuesVersionHashColumn(typedInsert.error.message)

  if (!shouldFallback) {
    return { ok: false, message: typedInsert.error.message }
  }

  return insertLegacyNumericCalculatedRows(admin, rows)
}

async function recomputeEntry(
  admin: any,
  entry: EntryRow,
  context: DepartmentComputeContext,
  dryRun: boolean,
): Promise<RecomputeResult> {
  if (context.calculatedMetrics.length === 0) {
    if (dryRun) {
      return { ok: true, inserted: 0 }
    }

    const persistResult = await persistCalculatedRows(admin, entry.entry_id, [])
    if (!persistResult.ok) {
      return { ok: false, message: persistResult.message }
    }
    return { ok: true, inserted: 0 }
  }

  const entryValuesResult = await loadEntryValues(admin, entry.entry_id)
  if (!entryValuesResult.ok) {
    return { ok: false, message: entryValuesResult.message }
  }

  const valueByMetricId = new Map(entryValuesResult.values.map((row) => [row.metric_id, row]))
  const now = new Date().toISOString()
  const calculatedRows: RecomputedCalculatedRow[] = []

  for (const metricId of context.evaluationOrder) {
    const metric = context.calculatedMetrics.find((item) => item.metric_id === metricId)
    const formula = context.formulaByMetricId.get(metricId)
    if (!metric || !formula) {
      continue
    }

    const metricValues: Record<string, number | boolean | null | undefined> = {}
    for (const [code, dependencyMetric] of context.metricsByCode.entries()) {
      const type = context.formulaTypeByCode.get(code)
      if (!type) {
        continue
      }
      const currentValue = valueByMetricId.get(dependencyMetric.metric_id)
      metricValues[code] = type === 'boolean' ? currentValue?.value_bool ?? null : currentValue?.value_numeric ?? null
    }

    const expectedType =
      formula.return_type === 'number' || formula.return_type === 'boolean'
        ? formula.return_type
        : formulaValueTypeForMetricDataType(metric.data_type)

    if (!expectedType) {
      return {
        ok: false,
        message: `Metric "${metric.code}" has unsupported formula output type.`,
      }
    }

    let evaluated: { kind: FormulaValueType; value: number | boolean } | null = null
    const astFromDb = isRecord(formula.ast_json) ? (formula.ast_json as FormulaAstNode) : null
    if (astFromDb) {
      try {
        const astResult = evaluateFormulaAst(astFromDb, {
          metricValues,
          metricReturnTypes: context.formulaTypeByCode,
        })
        evaluated = { kind: astResult.kind, value: astResult.value }
      } catch {
        // fall back to expression parse/evaluate
      }
    }

    if (!evaluated) {
      const expressionResult = evaluateFormulaExpression(formula.expression, {
        metricValues,
        metricReturnTypes: context.formulaTypeByCode,
      })

      if (!expressionResult.success) {
        return {
          ok: false,
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
        ok: false,
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
      entry_id: entry.entry_id,
      metric_id: metricId,
      value_numeric: nextValue.value_numeric,
      value_bool: nextValue.value_bool,
      computed_at: now,
      formula_id: formula.formula_id,
      calc_trace: {
        engine: 'notion_v1',
        evaluated_at: now,
        source: 'backfill_script',
      },
    })
  }

  if (dryRun) {
    return { ok: true, inserted: calculatedRows.length }
  }

  const persistResult = await persistCalculatedRows(admin, entry.entry_id, calculatedRows)
  if (!persistResult.ok) {
    return { ok: false, message: persistResult.message }
  }

  return { ok: true, inserted: calculatedRows.length }
}

async function main() {
  const options = parseOptions()
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  const admin = createClient(supabaseUrl, serviceRoleKey)

  let processed = 0
  let succeeded = 0
  let failed = 0
  let calculatedRowsWritten = 0
  let offset = 0

  const contextCache = new Map<string, DepartmentComputeContext>()

  console.log('Starting calculated metrics backfill...')
  console.log(
    JSON.stringify(
      {
        companyId: options.companyId ?? null,
        departmentId: options.departmentId ?? null,
        entryId: options.entryId ?? null,
        dateFrom: options.dateFrom ?? null,
        dateTo: options.dateTo ?? null,
        limit: options.limit ?? null,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
      },
      null,
      2,
    ),
  )

  while (true) {
    let query = admin
      .from('daily_entries')
      .select('entry_id, company_id, department_id, entry_date')
      .order('entry_date', { ascending: true })
      .order('entry_id', { ascending: true })

    if (options.entryId) {
      query = query.eq('entry_id', options.entryId)
    }
    if (options.companyId) {
      query = query.eq('company_id', options.companyId)
    }
    if (options.departmentId) {
      query = query.eq('department_id', options.departmentId)
    }
    if (options.dateFrom) {
      query = query.gte('entry_date', options.dateFrom)
    }
    if (options.dateTo) {
      query = query.lte('entry_date', options.dateTo)
    }

    const { data: entriesData, error: entriesError } = await query.range(offset, offset + options.batchSize - 1)
    if (entriesError) {
      throw new Error(`Unable to load daily entries: ${entriesError.message}`)
    }

    const entries = (entriesData ?? []) as EntryRow[]
    if (entries.length === 0) {
      break
    }

    for (const entry of entries) {
      if (options.limit && processed >= options.limit) {
        break
      }

      processed += 1
      const contextKey = `${entry.company_id}:${entry.department_id}`
      let context = contextCache.get(contextKey)

      if (!context) {
        const contextResult = await loadDepartmentComputeContext(admin, entry.company_id, entry.department_id)
        if (!contextResult.ok) {
          failed += 1
          console.error(
            `[${processed}] entry=${entry.entry_id} date=${entry.entry_date} ERROR (context): ${contextResult.message}`,
          )
          continue
        }

        context = contextResult.context
        contextCache.set(contextKey, context)
      }

      const recomputeResult = await recomputeEntry(admin, entry, context, options.dryRun)
      if (!recomputeResult.ok) {
        failed += 1
        console.error(`[${processed}] entry=${entry.entry_id} date=${entry.entry_date} ERROR: ${recomputeResult.message}`)
        continue
      }

      succeeded += 1
      calculatedRowsWritten += recomputeResult.inserted

      if (processed % 50 === 0) {
        console.log(
          `Progress: processed=${processed} succeeded=${succeeded} failed=${failed} calculatedRows=${calculatedRowsWritten}`,
        )
      }
    }

    if (options.limit && processed >= options.limit) {
      break
    }

    if (entries.length < options.batchSize || options.entryId) {
      break
    }

    offset += options.batchSize
  }

  console.log('Backfill finished.')
  console.log(
    JSON.stringify(
      {
        processed,
        succeeded,
        failed,
        calculatedRows: calculatedRowsWritten,
        dryRun: options.dryRun,
      },
      null,
      2,
    ),
  )

  if (failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
