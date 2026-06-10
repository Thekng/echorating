'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { createMetricAction, type MetricActionState } from '@/features/metrics/actions'
import { METRIC_DATA_TYPES } from '@/lib/metrics/data-types'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

type CreateMetricModalProps = {
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

export function CreateMetricModal({ departments, onSaved }: CreateMetricModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MetricActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeDirty, setCodeDirty] = useState(false)
  const [dataType, setDataType] = useState<string>('number')

  function resetFormState() {
    setDepartmentId(departments[0]?.id ?? '')
    setName('')
    setCode('')
    setCodeDirty(false)
    setDataType('number')
  }

  function handleOpenModal() {
    setState(INITIAL_STATE)
    resetFormState()
    setOpen(true)
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

  return (
    <>
      <Button
        type="button"
        onClick={handleOpenModal}
        title="Add metric"
        aria-label="Add metric"
        className="size-9 p-0"
        disabled={departments.length === 0}
      >
        <Plus className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Create Metric</h2>
              <p className="text-sm text-muted-foreground">
                Define a new metric for a department.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="create-metric-department" className="text-sm font-medium">
                  Department
                </label>
                <select
                  id="create-metric-department"
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
                    onChange={(event) => setDataType(event.target.value)}
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
                  <label htmlFor="create-metric-is-required" className="text-sm font-medium">
                    Required?
                  </label>
                  <select
                    id="create-metric-is-required"
                    name="isRequired"
                    defaultValue="false"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>

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
