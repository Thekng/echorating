'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { updateMetricAction } from '@/features/metrics/actions'
import { Button } from '@/components/ui/button'
import { FormulaBuilder } from '@/components/metrics/formula-builder'
import { validateFormulaExpression } from '@/lib/metrics/formula'
import { Pencil, ChevronDown } from 'lucide-react'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type MetricDataType =
  | 'number'
  | 'currency'
  | 'percent'
  | 'boolean'
  | 'duration'
  | 'text'
  | 'datetime'
  | 'selection'
  | 'file'

type MetricItem = {
  metric_id: string
  department_id: string
  name: string
  code: string
  description: string | null
  data_type: MetricDataType
  unit: string
  settings: Record<string, unknown> | null
  direction: 'higher_is_better' | 'lower_is_better'
  input_mode: 'manual' | 'calculated'
  precision_scale: number
  formula_expression: string | null
}

type EditMetricModalProps = {
  metric: MetricItem
  departments: Array<{
    department_id: string
    name: string
  }>
  dependencyMetrics: Array<{
    metric_id: string
    name: string
    code: string
    department_id: string
    department_name: string
  }>
}

const DATA_TYPES = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'duration', label: 'Duration' },
  { value: 'text', label: 'Text' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'selection', label: 'Selection' },
  { value: 'file', label: 'File' },
] as const

const DIRECTIONS = [
  { value: 'higher_is_better', label: 'Higher is better' },
  { value: 'lower_is_better', label: 'Lower is better' },
] as const

const MODES = [
  { value: 'manual', label: 'Manual' },
  { value: 'calculated', label: 'Calculated' },
] as const

const CALCULATED_ALLOWED_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration']

const UNIT_OPTIONS: Record<MetricDataType, string[]> = {
  number: ['count', 'points', 'items', 'hours', 'days'],
  currency: ['usd', 'brl', 'eur'],
  percent: ['pct'],
  boolean: ['bool'],
  duration: ['hh:mm:ss', 'minutes', 'hours', 'days'],
  text: ['text'],
  datetime: ['datetime'],
  selection: ['option'],
  file: ['file'],
}

const INITIAL_STATE: ActionState = {
  status: 'idle',
  message: '',
}

function toMetricCode(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function settingString(settings: Record<string, unknown> | null, key: string) {
  const value = settings?.[key]
  return typeof value === 'string' ? value : ''
}

export function EditMetricModal({ metric, departments, dependencyMetrics }: EditMetricModalProps) {
  const [open, setOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mode, setMode] = useState<'manual' | 'calculated'>(metric.input_mode)
  const [name, setName] = useState(metric.name)
  const [code, setCode] = useState(metric.code)
  const [dataType, setDataType] = useState<MetricDataType>(metric.data_type)
  const [direction, setDirection] = useState<'higher_is_better' | 'lower_is_better'>(metric.direction)
  const [precisionScale, setPrecisionScale] = useState(metric.precision_scale)
  const [expression, setExpression] = useState(metric.formula_expression ?? '')
  const [description, setDescription] = useState(metric.description ?? '')
  const [numberKind, setNumberKind] = useState<'integer' | 'decimal'>('integer')
  const [currencyCode, setCurrencyCode] = useState<'USD' | 'EUR' | 'BRL'>('USD')
  const [state, formAction, pending] = useActionState(updateMetricAction, INITIAL_STATE)

  useEffect(() => {
    if (state.status === 'success') {
      setOpen(false)
    }
  }, [state.status])

  useEffect(() => {
    if (!open) {
      return
    }

    setMode(metric.input_mode)
    setName(metric.name)
    setCode(metric.code)
    setDataType(metric.data_type)
    setDirection(metric.direction)
    setPrecisionScale(metric.precision_scale)
    setExpression(metric.formula_expression ?? '')
    setDescription(metric.description ?? '')
    setNumberKind(settingString(metric.settings, 'numberKind') === 'decimal' ? 'decimal' : 'integer')
    const rawCurrency = settingString(metric.settings, 'currencyCode')
    setCurrencyCode(rawCurrency === 'EUR' || rawCurrency === 'BRL' ? rawCurrency : 'USD')
  }, [metric, open])

  const knownMetricCodes = useMemo(
    () => dependencyMetrics.map((item) => item.code.toLowerCase()),
    [dependencyMetrics],
  )
  const formulaValidation = useMemo(
    () =>
      validateFormulaExpression(expression, {
        knownMetricCodes,
        disallowMetricCodes: [code.toLowerCase()],
      }),
    [expression, knownMetricCodes, code],
  )
  const unitOptions = UNIT_OPTIONS[dataType]

  function onNameChange(value: string) {
    setName(value)
    setCode(toMetricCode(value))
  }

  function onDataTypeChange(nextType: MetricDataType) {
    setDataType(nextType)
    if (mode === 'calculated' && !CALCULATED_ALLOWED_TYPES.includes(nextType)) {
      setMode('manual')
    }
  }

  const disableSubmit =
    pending ||
    (mode === 'calculated' && !formulaValidation.success)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="size-8 p-0"
        onClick={() => setOpen(true)}
        title={`Edit ${metric.name}`}
        aria-label={`Edit ${metric.name}`}
      >
        <Pencil className="size-3.5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Edit KPI</h2>
              <p className="text-sm text-muted-foreground">
                Update values with automatic code and strict formula validation.
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="metricId" value={metric.metric_id} />
              <input type="hidden" name="departmentId" value={metric.department_id} />
              <input type="hidden" name="unit" value="count" />
              <input type="hidden" name="direction" value={direction} />
              <input type="hidden" name="precisionScale" value={precisionScale} />

              {/* Mode */}
              <div className="space-y-2">
                <label htmlFor={`edit-metric-mode-${metric.metric_id}`} className="text-sm font-medium">
                  Type of metric
                </label>
                <select
                  id={`edit-metric-mode-${metric.metric_id}`}
                  name="inputMode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as 'manual' | 'calculated')}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="manual">Manual entry</option>
                  <option value="calculated" disabled={!CALCULATED_ALLOWED_TYPES.includes(dataType)}>
                    Calculated formula
                  </option>
                </select>
              </div>

              {/* Name & Code (auto-filled) */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-name-${metric.metric_id}`} className="text-sm font-medium">
                    Metric name
                  </label>
                  <input
                    id={`edit-metric-name-${metric.metric_id}`}
                    name="name"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    required
                    minLength={2}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="e.g., Close Rate"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`edit-metric-code-${metric.metric_id}`} className="text-sm font-medium">
                    Code (auto-filled)
                  </label>
                  <input
                    id={`edit-metric-code-${metric.metric_id}`}
                    name="code"
                    value={code}
                    readOnly
                    className="h-10 w-full rounded-md border border-input bg-muted px-3 text-sm font-mono text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor={`edit-metric-description-${metric.metric_id}`} className="text-sm font-medium">
                  Short description (optional)
                </label>
                <textarea
                  id={`edit-metric-description-${metric.metric_id}`}
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="A brief sentence shown under the KPI title"
                />
              </div>

              {/* Data Type */}
              <div className="space-y-2">
                <label htmlFor={`edit-metric-type-${metric.metric_id}`} className="text-sm font-medium">
                  Data type
                </label>
                <select
                  id={`edit-metric-type-${metric.metric_id}`}
                  name="dataType"
                  value={dataType}
                  onChange={(event) => onDataTypeChange(event.target.value as MetricDataType)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="number">Number</option>
                  <option value="currency">Currency</option>
                  <option value="percent">Percentage</option>
                  <option value="duration">Duration</option>
                </select>
              </div>

              {/* Format options based on data type */}
              {dataType === 'number' && (
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-number-kind-${metric.metric_id}`} className="text-sm font-medium">
                    Number format
                  </label>
                  <select
                    id={`edit-metric-number-kind-${metric.metric_id}`}
                    name="numberKind"
                    value={numberKind}
                    onChange={(event) => setNumberKind(event.target.value as 'integer' | 'decimal')}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="integer">Whole numbers</option>
                    <option value="decimal">Decimal numbers</option>
                  </select>
                </div>
              )}

              {dataType === 'currency' && (
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-currency-code-${metric.metric_id}`} className="text-sm font-medium">
                    Currency
                  </label>
                  <select
                    id={`edit-metric-currency-code-${metric.metric_id}`}
                    name="currencyCode"
                    value={currencyCode}
                    onChange={(event) => setCurrencyCode(event.target.value as 'USD' | 'EUR' | 'BRL')}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="BRL">BRL (R$)</option>
                  </select>
                </div>
              )}

              {mode === 'calculated' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Calculated formula</label>
                  <p className="text-xs text-muted-foreground mb-2">Create a formula by combining other metrics. Use +, -, *, / and parentheses.</p>
                  <FormulaBuilder
                    id={`edit-metric-expression-${metric.metric_id}`}
                    name="expression"
                    value={expression}
                    metrics={dependencyMetrics.filter((item) => item.metric_id !== metric.metric_id)}
                    currentMetricCode={code}
                    onChange={setExpression}
                    required
                  />
                </div>
              ) : null}

              {state.status !== 'idle' ? (
                <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                  {state.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={disableSubmit}>
                  {pending ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
