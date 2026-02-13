'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { createMetricAction } from '@/features/metrics/actions'
import { Button } from '@/components/ui/button'
import { FormulaBuilder } from '@/components/metrics/formula-builder'
import { validateFormulaExpression } from '@/lib/metrics/formula'
import { Plus } from 'lucide-react'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type MetricDataType = 'number' | 'currency' | 'percent' | 'boolean' | 'duration'

type CreateMetricModalProps = {
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

function suggestedPrecision(dataType: MetricDataType) {
  if (dataType === 'currency' || dataType === 'percent') {
    return 2
  }

  return 0
}

function toMetricCode(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function CreateMetricModal({
  departments,
  dependencyMetrics,
}: CreateMetricModalProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createMetricAction, INITIAL_STATE)
  const [mode, setMode] = useState<'manual' | 'calculated'>('manual')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeDirty, setCodeDirty] = useState(false)
  const [dataType, setDataType] = useState<MetricDataType>('number')
  const [unit, setUnit] = useState('count')
  const [unitCustom, setUnitCustom] = useState('')
  const [direction, setDirection] = useState<'higher_is_better' | 'lower_is_better'>('higher_is_better')
  const [precisionScale, setPrecisionScale] = useState(0)
  const [precisionDirty, setPrecisionDirty] = useState(false)
  const [expression, setExpression] = useState('')

  const unitOptions = UNIT_OPTIONS[dataType]
  const knownMetricCodes = useMemo(
    () => dependencyMetrics.map((metric) => metric.code.toLowerCase()),
    [dependencyMetrics],
  )
  const formulaValidation = useMemo(
    () =>
      validateFormulaExpression(expression, {
        knownMetricCodes,
      }),
    [expression, knownMetricCodes],
  )

  useEffect(() => {
    if (state.status === 'success') {
      setOpen(false)
    }
  }, [state.status])

  useEffect(() => {
    if (!open) {
      setMode('manual')
      setName('')
      setCode('')
      setCodeDirty(false)
      setDataType('number')
      setUnit('count')
      setUnitCustom('')
      setDirection('higher_is_better')
      setPrecisionScale(0)
      setPrecisionDirty(false)
      setExpression('')
      return
    }

    if (!unitOptions.includes(unit) && unit !== 'custom') {
      setUnit(unitOptions[0] ?? 'count')
    }
  }, [open, unit, unitOptions])

  function onNameChange(value: string) {
    setName(value)
    if (!codeDirty) {
      setCode(toMetricCode(value))
    }
  }

  function onDataTypeChange(nextType: MetricDataType) {
    setDataType(nextType)
    const nextUnitOptions = UNIT_OPTIONS[nextType]
    if (unit !== 'custom' && !nextUnitOptions.includes(unit)) {
      setUnit(nextUnitOptions[0] ?? 'count')
    }
    if (!precisionDirty) {
      setPrecisionScale(suggestedPrecision(nextType))
    }
  }

  const disableSubmit = pending || (mode === 'calculated' && !formulaValidation.success)

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        title="Add custom KPI"
        aria-label="Add custom KPI"
        className="size-9 p-0"
      >
        <Plus className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Create KPI</h2>
              <p className="text-sm text-muted-foreground">
                Fast setup with automatic code, suggested units and formula builder.
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="create-metric-mode" className="text-sm font-medium">
                    Mode
                  </label>
                  <select
                    id="create-metric-mode"
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
                  <label htmlFor="create-metric-department" className="text-sm font-medium">
                    Department
                  </label>
                  <select
                    id="create-metric-department"
                    name="departmentId"
                    defaultValue={departments[0]?.department_id ?? ''}
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
                  <label htmlFor="create-metric-name" className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="create-metric-name"
                    name="name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="create-metric-code" className="text-sm font-medium">
                      Code
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-4"
                      onClick={() => {
                        setCode(toMetricCode(name))
                        setCodeDirty(false)
                      }}
                    >
                      Auto
                    </button>
                  </div>
                  <input
                    id="create-metric-code"
                    name="code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value)
                      setCodeDirty(true)
                    }}
                    placeholder="auto from name"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Spaces are automatically converted to `_`.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="create-metric-description" className="text-sm font-medium">
                  Description (optional)
                </label>
                <textarea
                  id="create-metric-description"
                  name="description"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="create-metric-data-type" className="text-sm font-medium">
                    Data type
                  </label>
                  <select
                    id="create-metric-data-type"
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
                  <label htmlFor="create-metric-unit" className="text-sm font-medium">
                    Unit
                  </label>
                  <select
                    id="create-metric-unit"
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
                  <label htmlFor="create-metric-unit-custom" className="text-sm font-medium">
                    Custom unit
                  </label>
                  <input
                    id="create-metric-unit-custom"
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
                    <label htmlFor="create-metric-direction" className="text-sm font-medium">
                      Direction
                    </label>
                    <select
                      id="create-metric-direction"
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
                    <label htmlFor="create-metric-precision" className="text-sm font-medium">
                      Precision
                    </label>
                    <input
                      id="create-metric-precision"
                      name="precisionScale"
                      type="number"
                      min={0}
                      max={6}
                      value={precisionScale}
                      onChange={(event) => {
                        setPrecisionScale(Number(event.target.value))
                        setPrecisionDirty(true)
                      }}
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
                    id="create-metric-expression"
                    name="expression"
                    value={expression}
                    metrics={dependencyMetrics}
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
                  {pending ? 'Saving...' : 'Create metric'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
