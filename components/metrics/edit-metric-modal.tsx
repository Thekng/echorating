'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { updateMetricAction } from '@/features/metrics/actions'
import { Button } from '@/components/ui/button'
import { FormulaBuilder } from '@/components/metrics/formula-builder'
import { validateFormulaExpression } from '@/lib/metrics/formula'
import { Pencil } from 'lucide-react'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type MetricDataType = 'number' | 'currency' | 'percent' | 'boolean' | 'duration'

type MetricItem = {
  metric_id: string
  department_id: string
  name: string
  code: string
  description: string | null
  data_type: MetricDataType
  unit: string
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
] as const

const DIRECTIONS = [
  { value: 'higher_is_better', label: 'Higher is better' },
  { value: 'lower_is_better', label: 'Lower is better' },
] as const

const MODES = [
  { value: 'manual', label: 'Manual' },
  { value: 'calculated', label: 'Calculated' },
] as const

const UNIT_OPTIONS: Record<MetricDataType, string[]> = {
  number: ['count', 'min', 'hours', 'points'],
  currency: ['usd', 'brl', 'eur'],
  percent: ['pct'],
  boolean: ['bool'],
  duration: ['sec'],
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

export function EditMetricModal({ metric, departments, dependencyMetrics }: EditMetricModalProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'manual' | 'calculated'>(metric.input_mode)
  const [name, setName] = useState(metric.name)
  const [code, setCode] = useState(metric.code)
  const [codeAuto, setCodeAuto] = useState(metric.code === toMetricCode(metric.name))
  const [dataType, setDataType] = useState<MetricDataType>(metric.data_type)
  const [unit, setUnit] = useState('count')
  const [unitCustom, setUnitCustom] = useState('')
  const [direction, setDirection] = useState<'higher_is_better' | 'lower_is_better'>(metric.direction)
  const [precisionScale, setPrecisionScale] = useState(metric.precision_scale)
  const [expression, setExpression] = useState(metric.formula_expression ?? '')
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
    setCodeAuto(metric.code === toMetricCode(metric.name))
    setDataType(metric.data_type)
    setDirection(metric.direction)
    setPrecisionScale(metric.precision_scale)
    setExpression(metric.formula_expression ?? '')

    const options = UNIT_OPTIONS[metric.data_type]
    if (options.includes(metric.unit)) {
      setUnit(metric.unit)
      setUnitCustom('')
    } else {
      setUnit('custom')
      setUnitCustom(metric.unit)
    }
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
    if (codeAuto) {
      setCode(toMetricCode(value))
    }
  }

  function onDataTypeChange(nextType: MetricDataType) {
    setDataType(nextType)
    const nextUnitOptions = UNIT_OPTIONS[nextType]
    if (unit !== 'custom' && !nextUnitOptions.includes(unit)) {
      setUnit(nextUnitOptions[0] ?? 'count')
    }
  }

  const disableSubmit = pending || (mode === 'calculated' && !formulaValidation.success)

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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-mode-${metric.metric_id}`} className="text-sm font-medium">
                    Mode
                  </label>
                  <select
                    id={`edit-metric-mode-${metric.metric_id}`}
                    name="inputMode"
                    value={mode}
                    onChange={(event) => setMode(event.target.value as 'manual' | 'calculated')}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {MODES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor={`edit-metric-department-${metric.metric_id}`} className="text-sm font-medium">
                    Department
                  </label>
                  <select
                    id={`edit-metric-department-${metric.metric_id}`}
                    name="departmentId"
                    defaultValue={metric.department_id}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    {departments.map((department) => (
                      <option key={department.department_id} value={department.department_id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-name-${metric.metric_id}`} className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id={`edit-metric-name-${metric.metric_id}`}
                    name="name"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    required
                    minLength={2}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`edit-metric-code-${metric.metric_id}`} className="text-sm font-medium">
                      Code
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-4"
                      onClick={() => {
                        setCode(toMetricCode(name))
                        setCodeAuto(true)
                      }}
                    >
                      Auto
                    </button>
                  </div>
                  <input
                    id={`edit-metric-code-${metric.metric_id}`}
                    name="code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value)
                      setCodeAuto(false)
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Spaces are automatically converted to `_`.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor={`edit-metric-description-${metric.metric_id}`} className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id={`edit-metric-description-${metric.metric_id}`}
                  name="description"
                  rows={2}
                  defaultValue={metric.description ?? ''}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                    {DATA_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor={`edit-metric-unit-${metric.metric_id}`} className="text-sm font-medium">
                    Unit
                  </label>
                  <select
                    id={`edit-metric-unit-${metric.metric_id}`}
                    name="unit"
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {unitOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    <option value="custom">custom</option>
                  </select>
                </div>
              </div>

              {unit === 'custom' ? (
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-unit-custom-${metric.metric_id}`} className="text-sm font-medium">
                    Custom unit
                  </label>
                  <input
                    id={`edit-metric-unit-custom-${metric.metric_id}`}
                    name="unitCustom"
                    value={unitCustom}
                    onChange={(event) => setUnitCustom(event.target.value)}
                    required
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              ) : null}

              <details className="rounded-md border border-border bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Advanced settings (optional)
                </summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor={`edit-metric-direction-${metric.metric_id}`} className="text-sm font-medium">
                      Direction
                    </label>
                    <select
                      id={`edit-metric-direction-${metric.metric_id}`}
                      name="direction"
                      value={direction}
                      onChange={(event) =>
                        setDirection(event.target.value as 'higher_is_better' | 'lower_is_better')
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {DIRECTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`edit-metric-precision-${metric.metric_id}`} className="text-sm font-medium">
                      Precision
                    </label>
                    <input
                      id={`edit-metric-precision-${metric.metric_id}`}
                      name="precisionScale"
                      type="number"
                      min={0}
                      max={6}
                      value={precisionScale}
                      onChange={(event) => setPrecisionScale(Number(event.target.value))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      required
                    />
                  </div>
                </div>
              </details>

              {mode === 'calculated' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Formula</label>
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
