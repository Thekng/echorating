'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { createMetricAction, type MetricActionState } from '@/features/metrics/actions'
import { Button } from '@/components/ui/button'
import { DepartmentPicker } from '@/components/filters/department-picker'
import { FormulaBuilder } from '@/components/metrics/formula-builder'
import { validateFormulaExpression, type FormulaValueType } from '@/lib/metrics/formula'
import { Plus } from 'lucide-react'

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
    data_type: MetricDataType
  }>
  onSaved?: (message: string) => void
}

const DATA_TYPES = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'duration', label: 'Duration' },
  { value: 'text', label: 'Text' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'selection', label: 'Selection' },
  { value: 'file', label: 'File' },
] as const

const MODES = [
  { value: 'manual', label: 'Manual' },
  { value: 'calculated', label: 'Calculated' },
] as const

const CALCULATED_ALLOWED_TYPES: MetricDataType[] = ['number', 'currency', 'percent', 'duration', 'boolean']

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

const INITIAL_STATE: MetricActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
}

function toMetricCode(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
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

export function CreateMetricModal({
  departments,
  dependencyMetrics,
  onSaved,
}: CreateMetricModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MetricActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'manual' | 'calculated'>('manual')
  const [departmentId, setDepartmentId] = useState(departments[0]?.department_id ?? '')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeDirty, setCodeDirty] = useState(false)
  const [dataType, setDataType] = useState<MetricDataType>('number')
  const [unit, setUnit] = useState('count')
  const [unitCustom, setUnitCustom] = useState('')
  const [expression, setExpression] = useState('')
  const [numberKind, setNumberKind] = useState<'integer' | 'decimal'>('integer')
  const [currencyCode, setCurrencyCode] = useState<'USD' | 'EUR' | 'BRL'>('USD')
  const [durationFormat, setDurationFormat] = useState<'hh_mm_ss' | 'minutes' | 'hours' | 'days'>('hh_mm_ss')
  const [textFormat, setTextFormat] = useState<'short_text' | 'long_text' | 'email' | 'phone' | 'url'>('short_text')
  const [datetimeFormat, setDatetimeFormat] = useState<'date' | 'datetime' | 'time'>('date')
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi' | 'radio'>('single')
  const [selectionOptions, setSelectionOptions] = useState('')
  const [fileKind, setFileKind] = useState<'file' | 'image'>('file')

  const unitOptions = UNIT_OPTIONS[dataType]
  const availableFormulaMetrics = useMemo(
    () =>
      dependencyMetrics.filter(
        (metric) =>
          metric.department_id === departmentId &&
          formulaValueTypeForMetricDataType(metric.data_type) !== null,
      ),
    [dependencyMetrics, departmentId],
  )
  const metricReturnTypes = useMemo(() => {
    const map = new Map<string, FormulaValueType>()

    for (const metric of availableFormulaMetrics) {
      const type = formulaValueTypeForMetricDataType(metric.data_type)
      if (!type) {
        continue
      }
      map.set(metric.code.toLowerCase(), type)
    }

    return map
  }, [availableFormulaMetrics])
  const knownMetricCodes = useMemo(
    () => Array.from(metricReturnTypes.keys()),
    [metricReturnTypes],
  )
  const formulaValidation = useMemo(
    () =>
      validateFormulaExpression(expression, {
        knownMetricCodes,
        metricReturnTypes,
      }),
    [expression, knownMetricCodes, metricReturnTypes],
  )

  function resetFormState() {
    setDepartmentId(departments[0]?.department_id ?? '')
    setMode('manual')
    setName('')
    setCode('')
    setCodeDirty(false)
    setDataType('number')
    setUnit('count')
    setUnitCustom('')
    setExpression('')
    setNumberKind('integer')
    setCurrencyCode('USD')
    setDurationFormat('hh_mm_ss')
    setTextFormat('short_text')
    setDatetimeFormat('date')
    setSelectionMode('single')
    setSelectionOptions('')
    setFileKind('file')
  }

  function handleOpenModal() {
    setState(INITIAL_STATE)
    resetFormState()
    setOpen(true)
  }

  function handleCloseModal() {
    setOpen(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setState(INITIAL_STATE)
    startTransition(async () => {
      const nextState = await createMetricAction(INITIAL_STATE, formData)
      setState(nextState)

      if (nextState.status === 'success') {
        onSaved?.(nextState.message)
        setOpen(false)
      }
    })
  }

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
    if (mode === 'calculated' && !CALCULATED_ALLOWED_TYPES.includes(nextType)) {
      setMode('manual')
    }
    if (nextType === 'duration') {
      setDurationFormat('hh_mm_ss')
      setUnit('hh:mm:ss')
    }
  }

  const disableSubmit =
    pending ||
    (mode === 'calculated' && !formulaValidation.success) ||
    (dataType === 'selection' && selectionOptions.trim() === '')

  return (
    <>
      <Button
        type="button"
        onClick={handleOpenModal}
        title="Add custom KPI"
        aria-label="Add custom KPI"
        className="size-9 p-0"
        disabled={departments.length === 0}
      >
        <Plus className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleCloseModal}>
          <div 
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto overflow-x-visible rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Create KPI</h2>
              <p className="text-sm text-muted-foreground">
                Fast setup with automatic code, suggested units and formula builder.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Department</label>
                  <div className="flex flex-col gap-2">
                    <DepartmentPicker
                      departments={departments}
                      value={departmentId}
                      onChange={setDepartmentId}
                      placeholder="Select a department"
                      required
                    />
                  </div>
                  {state.fieldErrors.departmentId ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.departmentId}</p>
                  ) : null}
                </div>

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
                      <option
                        key={item.value}
                        value={item.value}
                        disabled={item.value === 'calculated' && !CALCULATED_ALLOWED_TYPES.includes(dataType)}
                      >
                        {item.label}
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
                  {state.fieldErrors.name ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
                  ) : null}
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
                  {state.fieldErrors.code ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.code}</p>
                  ) : null}
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
                  {state.fieldErrors.dataType ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.dataType}</p>
                  ) : null}
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
                  {state.fieldErrors.unit ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.unit}</p>
                  ) : null}
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
              
              <div className="space-y-2">
                <label htmlFor="create-metric-target" className="text-sm font-medium">
                  Daily Target (optional)
                </label>
                <input
                  id="create-metric-target"
                  name="target"
                  type="number"
                  step="any"
                  placeholder="e.g. 100"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Default daily target for this metric in the selected department.
                </p>
              </div>

              {dataType === 'number' ? (
                <div className="space-y-2">
                  <label htmlFor="create-metric-number-kind" className="text-sm font-medium">
                    Number format
                  </label>
                  <select
                    id="create-metric-number-kind"
                    name="numberKind"
                    value={numberKind}
                    onChange={(event) => setNumberKind(event.target.value as 'integer' | 'decimal')}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="integer">Integer</option>
                    <option value="decimal">Decimal</option>
                  </select>
                </div>
              ) : null}

              {dataType === 'currency' ? (
                <div className="space-y-2">
                  <label htmlFor="create-metric-currency-code" className="text-sm font-medium">
                    Currency
                  </label>
                  <select
                    id="create-metric-currency-code"
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
              ) : null}

              {dataType === 'boolean' ? (
                <div className="space-y-2">
                  <input type="hidden" name="booleanPreset" value="yes_no" />
                  <label className="text-sm font-medium">Boolean labels</label>
                  <p className="rounded-md border border-input bg-muted/20 px-3 py-2 text-sm">Yes / No</p>
                  <p className="text-xs text-muted-foreground">
                    Boolean metrics are always presented as Yes or No for clarity.
                  </p>
                </div>
              ) : null}

              {dataType === 'duration' ? (
                <div className="space-y-2">
                  <label htmlFor="create-metric-duration-format" className="text-sm font-medium">
                    Duration input
                  </label>
                  <select
                    id="create-metric-duration-format"
                    name="durationFormat"
                    value={durationFormat}
                    onChange={(event) => {
                      const next = event.target.value as 'hh_mm_ss' | 'minutes' | 'hours' | 'days'
                      setDurationFormat(next)
                      if (next === 'hh_mm_ss') {
                        setUnit('hh:mm:ss')
                      } else {
                        setUnit(next)
                      }
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="hh_mm_ss">hh:mm:ss</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              ) : null}

              {dataType === 'text' ? (
                <div className="space-y-2">
                  <label htmlFor="create-metric-text-format" className="text-sm font-medium">
                    Text format
                  </label>
                  <select
                    id="create-metric-text-format"
                    name="textFormat"
                    value={textFormat}
                    onChange={(event) =>
                      setTextFormat(event.target.value as 'short_text' | 'long_text' | 'email' | 'phone' | 'url')
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="short_text">Short text</option>
                    <option value="long_text">Long text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone number</option>
                    <option value="url">URL</option>
                  </select>
                </div>
              ) : null}

              {dataType === 'datetime' ? (
                <div className="space-y-2">
                  <label htmlFor="create-metric-datetime-format" className="text-sm font-medium">
                    Date & time format
                  </label>
                  <select
                    id="create-metric-datetime-format"
                    name="datetimeFormat"
                    value={datetimeFormat}
                    onChange={(event) => setDatetimeFormat(event.target.value as 'date' | 'datetime' | 'time')}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="date">Date</option>
                    <option value="datetime">Date & Time</option>
                    <option value="time">Time only</option>
                  </select>
                </div>
              ) : null}

              {dataType === 'selection' ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="create-metric-selection-mode" className="text-sm font-medium">
                      Selection mode
                    </label>
                    <select
                      id="create-metric-selection-mode"
                      name="selectionMode"
                      value={selectionMode}
                      onChange={(event) => setSelectionMode(event.target.value as 'single' | 'multi' | 'radio')}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="single">Single select</option>
                      <option value="multi">Multi select</option>
                      <option value="radio">Radio buttons</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="create-metric-selection-options" className="text-sm font-medium">
                      Options (one per line)
                    </label>
                    <textarea
                      id="create-metric-selection-options"
                      name="selectionOptions"
                      value={selectionOptions}
                      onChange={(event) => setSelectionOptions(event.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder={'Option A\nOption B\nOption C'}
                      required
                    />
                    {state.fieldErrors.selectionOptions ? (
                      <p className="text-xs text-destructive">{state.fieldErrors.selectionOptions}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {dataType === 'file' ? (
                <div className="space-y-2">
                  <label htmlFor="create-metric-file-kind" className="text-sm font-medium">
                    File type
                  </label>
                  <select
                    id="create-metric-file-kind"
                    name="fileKind"
                    value={fileKind}
                    onChange={(event) => setFileKind(event.target.value as 'file' | 'image')}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="file">File upload</option>
                    <option value="image">Image upload</option>
                  </select>
                </div>
              ) : null}

              {mode === 'calculated' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Formula</label>
                  <FormulaBuilder
                    id="create-metric-expression"
                    name="expression"
                    value={expression}
                    metrics={availableFormulaMetrics}
                    onChange={setExpression}
                    required
                  />
                  {availableFormulaMetrics.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No active metrics found for this department yet. Create a manual metric first, then reuse its code in formulas.
                    </p>
                  ) : null}
                  {!formulaValidation.success ? (
                    <p className="text-xs text-destructive">{formulaValidation.error}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Formula looks valid.</p>
                  )}
                  {state.fieldErrors.expression ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.expression}</p>
                  ) : null}
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
