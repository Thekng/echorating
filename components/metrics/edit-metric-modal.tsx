'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { updateMetricAction, type MetricActionState } from '@/features/metrics/actions'
import { METRIC_DATA_TYPES } from '@/lib/metrics/data-types'
import { MetricSettingsFields } from '@/components/metrics/metric-settings-fields'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

type MetricItem = {
  id: string
  department_id: string
  name: string
  code: string | null
  description: string | null
  data_type: string
  is_required: boolean
  settings: unknown
}

type EditMetricModalProps = {
  metric: MetricItem
  departments: Array<{
    id: string
    name: string
  }>
  onSaved?: (message: string) => void
}

const DATA_TYPE_LABELS: Record<string, string> = {
  number: 'Number',
  currency: 'Currency',
  percentage: 'Percentage',
  boolean: 'Yes / No',
  text: 'Text',
  duration: 'Duration',
  datetime: 'Date / Time',
  selection: 'Selection',
  file: 'File / Link',
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

export function EditMetricModal({ metric, departments, onSaved }: EditMetricModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MetricActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const [departmentId, setDepartmentId] = useState(metric.department_id)
  const [name, setName] = useState(metric.name)
  const [code, setCode] = useState(metric.code ?? '')
  const [codeDirty, setCodeDirty] = useState(true)
  const [description, setDescription] = useState(metric.description ?? '')
  const [dataType, setDataType] = useState(metric.data_type)
  const [isRequired, setIsRequired] = useState(metric.is_required)
  const [settings, setSettings] = useState<Record<string, unknown>>(
    (metric.settings && typeof metric.settings === 'object' && !Array.isArray(metric.settings))
      ? metric.settings as Record<string, unknown>
      : {}
  )

  function hydrateForm() {
    setDepartmentId(metric.department_id)
    setName(metric.name)
    setCode(metric.code ?? '')
    setCodeDirty(true)
    setDescription(metric.description ?? '')
    setDataType(metric.data_type)
    setIsRequired(metric.is_required)
    setSettings(
      (metric.settings && typeof metric.settings === 'object' && !Array.isArray(metric.settings))
        ? metric.settings as Record<string, unknown>
        : {}
    )
  }

  function handleOpenModal() {
    setState(INITIAL_STATE)
    hydrateForm()
    setOpen(true)
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

  function onNameChange(value: string) {
    setName(value)
    if (!codeDirty) {
      setCode(toMetricCode(value))
    }
  }

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Edit Metric</h2>
              <p className="text-sm text-muted-foreground">
                Update metric configuration.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <input type="hidden" name="metricId" value={metric.id} />
              <input type="hidden" name="settings" value={JSON.stringify(settings)} />

              <div className="space-y-2">
                <label htmlFor={`edit-metric-department-${metric.id}`} className="text-sm font-medium">
                  Department
                </label>
                <select
                  id={`edit-metric-department-${metric.id}`}
                  name="departmentId"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {state.fieldErrors.departmentId ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.departmentId}</p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-name-${metric.id}`} className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id={`edit-metric-name-${metric.id}`}
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
                    <label htmlFor={`edit-metric-code-${metric.id}`} className="text-sm font-medium">
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
                    id={`edit-metric-code-${metric.id}`}
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
                <label htmlFor={`edit-metric-description-${metric.id}`} className="text-sm font-medium">
                  Description (optional)
                </label>
                <textarea
                  id={`edit-metric-description-${metric.id}`}
                  name="description"
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={`edit-metric-data-type-${metric.id}`} className="text-sm font-medium">
                    Data type
                  </label>
                  <select
                    id={`edit-metric-data-type-${metric.id}`}
                    name="dataType"
                    value={dataType}
                    onChange={(event) => {
                      const newType = event.target.value
                      setDataType(newType)
                      if (newType !== metric.data_type) {
                        setSettings({})
                      } else {
                        setSettings(
                          (metric.settings && typeof metric.settings === 'object' && !Array.isArray(metric.settings))
                            ? metric.settings as Record<string, unknown>
                            : {}
                        )
                      }
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {METRIC_DATA_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DATA_TYPE_LABELS[type] ?? type}
                      </option>
                    ))}
                  </select>
                  {state.fieldErrors.dataType ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.dataType}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor={`edit-metric-is-required-${metric.id}`} className="text-sm font-medium">
                    Required?
                  </label>
                  <select
                    id={`edit-metric-is-required-${metric.id}`}
                    name="isRequired"
                    value={isRequired ? 'true' : 'false'}
                    onChange={(event) => setIsRequired(event.target.value === 'true')}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>

              <MetricSettingsFields
                dataType={dataType}
                settings={settings}
                onChange={setSettings}
                disabled={pending}
                idPrefix={`edit-metric-${metric.id}`}
              />

              {state.status !== 'idle' ? (
                <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                  {state.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
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
