'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { updateMetricAction, type MetricActionState } from '@/features/metrics/actions'
import { DepartmentPicker } from '@/components/filters/department-picker'
import { FormulaBuilder } from '@/components/metrics/formula-builder'
import { validateFormulaExpression, type FormulaValueType } from '@/lib/metrics/formula'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

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

type MetricSettings = {
  numberKind?: 'integer' | 'decimal'
  currencyCode?: string
  booleanPreset?: 'yes_no' | 'true_false' | 'active_inactive' | 'qualified_not_qualified' | 'completed_not_completed'
  durationFormat?: 'hh_mm_ss' | 'minutes' | 'hours' | 'days'
  textFormat?: 'short_text' | 'long_text' | 'email' | 'phone' | 'url'
  datetimeFormat?: 'date' | 'datetime' | 'time'
  selectionMode?: 'single' | 'multi' | 'radio'
  selectionOptions?: string[]
  fileKind?: 'file' | 'image'
}

type MetricItem = {
  metric_id: string
  department_id: string
  name: string
  code: string
  description: string | null
  data_type: MetricDataType
  unit: string
  settings: MetricSettings | null
  input_mode: 'manual' | 'calculated'
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

function normalizeUnit(dataType: MetricDataType, rawUnit: string) {
  if (dataType === 'currency') {
    return rawUnit.toLowerCase()
  }

  return rawUnit
}

function selectionOptionsToText(value: unknown) {
  if (!Array.isArray(value)) {
    return ''
  }

  const items = value.filter((item): item is string => typeof item === 'string')
  return items.join('\n')
}

function getInitialFieldState(metric: MetricItem) {
  const normalizedUnit = normalizeUnit(metric.data_type, metric.unit)
  const unitOptions = UNIT_OPTIONS[metric.data_type]
  const hasKnownUnit = unitOptions.includes(normalizedUnit)

  const settings = metric.settings ?? {}
  const currencyCodeFromSettings = typeof settings.currencyCode === 'string' ? settings.currencyCode : 'USD'
  const unitCustom = hasKnownUnit ? '' : normalizedUnit

  return {
    departmentId: metric.department_id,
    mode: metric.input_mode,
    name: metric.name,
    code: metric.code,
    description: metric.description ?? '',
    dataType: metric.data_type,
    unit: hasKnownUnit ? normalizedUnit : 'custom',
    unitCustom,
    expression: metric.formula_expression ?? '',
    numberKind: settings.numberKind === 'decimal' ? 'decimal' : 'integer',
    currencyCode: currencyCodeFromSettings === 'EUR' || currencyCodeFromSettings === 'BRL' ? currencyCodeFromSettings : 'USD',
    durationFormat:
      settings.durationFormat === 'minutes' || settings.durationFormat === 'hours' || settings.durationFormat === 'days'
        ? settings.durationFormat
        : 'hh_mm_ss',
    textFormat:
      settings.textFormat === 'long_text' ||
      settings.textFormat === 'email' ||
      settings.textFormat === 'phone' ||
      settings.textFormat === 'url'
        ? settings.textFormat
        : 'short_text',
    datetimeFormat:
      settings.datetimeFormat === 'datetime' || settings.datetimeFormat === 'time'
        ? settings.datetimeFormat
        : 'date',
    selectionMode:
      settings.selectionMode === 'multi' || settings.selectionMode === 'radio' ? settings.selectionMode : 'single',
    selectionOptions: selectionOptionsToText(settings.selectionOptions),
    fileKind: settings.fileKind === 'image' ? 'image' : 'file',
  } as const
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

export function EditMetricModal({ metric, departments, dependencyMetrics, onSaved }: EditMetricModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MetricActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const initialState = useMemo(() => getInitialFieldState(metric), [metric])

  const [mode, setMode] = useState<'manual' | 'calculated'>(initialState.mode)
  const [departmentId, setDepartmentId] = useState(initialState.departmentId)
  const [name, setName] = useState(initialState.name)
  const [code, setCode] = useState(initialState.code)
  const [codeDirty, setCodeDirty] = useState(true)
  const [description, setDescription] = useState(initialState.description)
  const [dataType, setDataType] = useState<MetricDataType>(initialState.dataType)
  const [unit, setUnit] = useState(initialState.unit)
  const [unitCustom, setUnitCustom] = useState(initialState.unitCustom)
  const [expression, setExpression] = useState(initialState.expression)
  const [numberKind, setNumberKind] = useState<'integer' | 'decimal'>(initialState.numberKind)
  const [currencyCode, setCurrencyCode] = useState<'USD' | 'EUR' | 'BRL'>(initialState.currencyCode)
  const [durationFormat, setDurationFormat] = useState<'hh_mm_ss' | 'minutes' | 'hours' | 'days'>(
    initialState.durationFormat,
  )
  const [textFormat, setTextFormat] = useState<'short_text' | 'long_text' | 'email' | 'phone' | 'url'>(
    initialState.textFormat,
  )
  const [datetimeFormat, setDatetimeFormat] = useState<'date' | 'datetime' | 'time'>(initialState.datetimeFormat)
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi' | 'radio'>(initialState.selectionMode)
  const [selectionOptions, setSelectionOptions] = useState(initialState.selectionOptions)
  const [fileKind, setFileKind] = useState<'file' | 'image'>(initialState.fileKind)

  const unitOptions = UNIT_OPTIONS[dataType]
  const availableFormulaMetrics = useMemo(
    () =>
      dependencyMetrics.filter(
        (dependencyMetric) =>
          dependencyMetric.department_id === departmentId &&
          dependencyMetric.metric_id !== metric.metric_id &&
          formulaValueTypeForMetricDataType(dependencyMetric.data_type) !== null,
      ),
    [dependencyMetrics, departmentId, metric.metric_id],
  )
  const metricReturnTypes = useMemo(() => {
    const map = new Map<string, FormulaValueType>()

    for (const dependencyMetric of availableFormulaMetrics) {
      const type = formulaValueTypeForMetricDataType(dependencyMetric.data_type)
      if (!type) {
        continue
      }
      map.set(dependencyMetric.code.toLowerCase(), type)
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

  function hydrateForm(metricToHydrate: MetricItem) {
    const nextState = getInitialFieldState(metricToHydrate)
    setMode(nextState.mode)
    setDepartmentId(nextState.departmentId)
    setName(nextState.name)
    setCode(nextState.code)
    setCodeDirty(true)
    setDescription(nextState.description)
    setDataType(nextState.dataType)
    setUnit(nextState.unit)
    setUnitCustom(nextState.unitCustom)
    setExpression(nextState.expression)
    setNumberKind(nextState.numberKind)
    setCurrencyCode(nextState.currencyCode)
    setDurationFormat(nextState.durationFormat)
    setTextFormat(nextState.textFormat)
    setDatetimeFormat(nextState.datetimeFormat)
    setSelectionMode(nextState.selectionMode)
    setSelectionOptions(nextState.selectionOptions)
    setFileKind(nextState.fileKind)
  }

  function handleOpenModal() {
    setState(INITIAL_STATE)
    hydrateForm(metric)
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
      const nextState = await updateMetricAction(INITIAL_STATE, formData)
      setState(nextState)

      if (nextState.status === 'success') {
        onSaved?.(nextState.message)
        setOpen(false)
      }
    })
  }

  function normalizeUnitForDataType(nextType: MetricDataType) {
    const nextUnitOptions = UNIT_OPTIONS[nextType]
    if (unit !== 'custom' && !nextUnitOptions.includes(unit)) {
      setUnit(nextUnitOptions[0] ?? 'count')
    }
  }

  function onNameChange(value: string) {
    setName(value)
    if (!codeDirty) {
      setCode(toMetricCode(value))
    }
  }

  function onDataTypeChange(nextType: MetricDataType) {
    setDataType(nextType)
    normalizeUnitForDataType(nextType)
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
        variant="outline"
        size="icon"
        onClick={handleOpenModal}
        title={`Edit ${metric.name}`}
        aria-label={`Edit ${metric.name}`}
      >
        <Pencil className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleCloseModal}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto overflow-x-visible rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Edit KPI</h2>
              <p className="text-sm text-muted-foreground">
                Update metric configuration, data type, and formula behavior.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <input type="hidden" name="metricId" value={metric.metric_id} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Department</label>
                  <DepartmentPicker
                    departments={departments}
                    value={departmentId}
                    onChange={setDepartmentId}
                    placeholder="Select a department"
                    required
                  />
                  {state.fieldErrors.departmentId ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.departmentId}</p>
                  ) : null}
                </div>

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
                    {MODES.map((modeOption) => (
                      <option
                        key={modeOption.value}
                        value={modeOption.value}
                        disabled={modeOption.value === 'calculated' && !CALCULATED_ALLOWED_TYPES.includes(dataType)}
                      >
                        {modeOption.label}
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
                    <label htmlFor={`edit-metric-code-${metric.metric_id}`} className="text-sm font-medium">
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
                    id={`edit-metric-code-${metric.metric_id}`}
                    name="code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value)
                      setCodeDirty(true)
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
                  />
                  {state.fieldErrors.code ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.code}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor={`edit-metric-description-${metric.metric_id}`} className="text-sm font-medium">
                  Description (optional)
                </label>
                <textarea
                  id={`edit-metric-description-${metric.metric_id}`}
                  name="description"
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-data-type-${metric.metric_id}`} className="text-sm font-medium">
                    Data type
                  </label>
                  <select
                    id={`edit-metric-data-type-${metric.metric_id}`}
                    name="dataType"
                    value={dataType}
                    onChange={(event) => onDataTypeChange(event.target.value as MetricDataType)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {DATA_TYPES.map((dataTypeOption) => (
                      <option key={dataTypeOption.value} value={dataTypeOption.value}>
                        {dataTypeOption.label}
                      </option>
                    ))}
                  </select>
                  {state.fieldErrors.dataType ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.dataType}</p>
                  ) : null}
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
                    {unitOptions.map((unitOption) => (
                      <option key={unitOption} value={unitOption}>
                        {unitOption}
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
                  <label htmlFor={`edit-metric-custom-unit-${metric.metric_id}`} className="text-sm font-medium">
                    Custom unit
                  </label>
                  <input
                    id={`edit-metric-custom-unit-${metric.metric_id}`}
                    name="unitCustom"
                    value={unitCustom}
                    onChange={(event) => setUnitCustom(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              ) : null}

              {dataType === 'number' ? (
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
                    <option value="integer">Integer</option>
                    <option value="decimal">Decimal</option>
                  </select>
                </div>
              ) : null}

              {dataType === 'currency' ? (
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-currency-${metric.metric_id}`} className="text-sm font-medium">
                    Currency
                  </label>
                  <select
                    id={`edit-metric-currency-${metric.metric_id}`}
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
                  <label htmlFor={`edit-metric-duration-${metric.metric_id}`} className="text-sm font-medium">
                    Duration input
                  </label>
                  <select
                    id={`edit-metric-duration-${metric.metric_id}`}
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
                  <label htmlFor={`edit-metric-text-${metric.metric_id}`} className="text-sm font-medium">
                    Text format
                  </label>
                  <select
                    id={`edit-metric-text-${metric.metric_id}`}
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
                  <label htmlFor={`edit-metric-date-${metric.metric_id}`} className="text-sm font-medium">
                    Date & time format
                  </label>
                  <select
                    id={`edit-metric-date-${metric.metric_id}`}
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
                    <label htmlFor={`edit-metric-selection-mode-${metric.metric_id}`} className="text-sm font-medium">
                      Selection mode
                    </label>
                    <select
                      id={`edit-metric-selection-mode-${metric.metric_id}`}
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
                    <label htmlFor={`edit-metric-selection-options-${metric.metric_id}`} className="text-sm font-medium">
                      Options (one per line)
                    </label>
                    <textarea
                      id={`edit-metric-selection-options-${metric.metric_id}`}
                      name="selectionOptions"
                      value={selectionOptions}
                      onChange={(event) => setSelectionOptions(event.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  <label htmlFor={`edit-metric-file-kind-${metric.metric_id}`} className="text-sm font-medium">
                    File type
                  </label>
                  <select
                    id={`edit-metric-file-kind-${metric.metric_id}`}
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
                    id={`edit-metric-expression-${metric.metric_id}`}
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
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={pending}>
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
