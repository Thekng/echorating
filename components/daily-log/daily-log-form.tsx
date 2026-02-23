'use client'

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useOptimistic } from 'react'
import { Button } from '@/components/ui/button'
import { saveDailyLogAction } from '@/features/daily-log/actions'
import { DurationSelector } from '@/components/daily-log/duration-selector'
import { booleanLabels, normalizeMetricSettings } from '@/lib/metrics/data-types'
import {
  INITIAL_DAILY_LOG_ACTION_STATE,
  type DailyLogMetric,
  type DailyLogExistingEntry,
} from '@/features/daily-log/types'

type Toast = {
  id: number
  tone: 'success' | 'error'
  message: string
}

type DailyLogFormProps = {
  date: string
  departmentId: string
  userId: string
  metrics: DailyLogMetric[]
  initialValues: Record<string, string>
  initialNotes: string
  existingEntry: DailyLogExistingEntry
}

function serializeState(
  metrics: DailyLogMetric[],
  values: Record<string, string>,
  notes: string,
  userId: string,
) {
  const metricsPart = metrics
    .map((metric) => `${metric.metric_id}:${values[metric.metric_id] ?? ''}`)
    .join('|')

  return `${userId}::${notes}::${metricsPart}`
}

function formatTime(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function decodeMultiSelection(value: string) {
  if (!value.trim()) {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(value) as string[]
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // ignore and fallback
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function renderMetricInput(
  metric: DailyLogMetric,
  value: string,
  pending: boolean,
  onChange: (nextValue: string) => void,
) {
  const settings = normalizeMetricSettings(metric.data_type, metric.settings)

  if (metric.data_type === 'boolean') {
    const labels = booleanLabels(settings)

    return (
      <select
        name={`metric_${metric.metric_id}`}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={pending}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select</option>
        <option value="true">{labels.trueLabel}</option>
        <option value="false">{labels.falseLabel}</option>
      </select>
    )
  }

  if (metric.data_type === 'duration') {
    if (settings.durationFormat && settings.durationFormat !== 'hh_mm_ss') {
      return (
        <input
          name={`metric_${metric.metric_id}`}
          type="number"
          step={settings.durationFormat === 'days' ? '0.01' : '1'}
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={settings.durationFormat}
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      )
    }

    return (
      <DurationSelector
        name={`metric_${metric.metric_id}`}
        value={value}
        onChange={onChange}
        disabled={pending}
        ariaLabel={metric.name}
      />
    )
  }

  if (metric.data_type === 'text') {
    if (settings.textFormat === 'long_text') {
      return (
        <textarea
          name={`metric_${metric.metric_id}`}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="Write details"
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      )
    }

    const inputType =
      settings.textFormat === 'email'
        ? 'email'
        : settings.textFormat === 'url'
          ? 'url'
          : settings.textFormat === 'phone'
            ? 'tel'
            : 'text'

    return (
      <input
        name={`metric_${metric.metric_id}`}
        type={inputType}
        inputMode={settings.textFormat === 'phone' ? 'tel' : 'text'}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={settings.textFormat?.replace('_', ' ') ?? 'text'}
        disabled={pending}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
    )
  }

  if (metric.data_type === 'datetime') {
    const inputType =
      settings.datetimeFormat === 'datetime'
        ? 'datetime-local'
        : settings.datetimeFormat === 'time'
          ? 'time'
          : 'date'

    return (
      <input
        name={`metric_${metric.metric_id}`}
        type={inputType}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={pending}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
    )
  }

  if (metric.data_type === 'selection') {
    const options = settings.selectionOptions ?? []
    if (options.length === 0) {
      return (
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          No options configured.
        </p>
      )
    }

    if (settings.selectionMode === 'multi') {
      const selectedValues = decodeMultiSelection(value)
      return (
        <>
          <input type="hidden" name={`metric_${metric.metric_id}`} value={value} />
          <select
            multiple
            value={selectedValues}
            onChange={(event) => {
              const next = Array.from(event.currentTarget.selectedOptions).map((option) => option.value)
              onChange(JSON.stringify(next))
            }}
            disabled={pending}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </>
      )
    }

    if (settings.selectionMode === 'radio') {
      return (
        <div className="space-y-1">
          <input type="hidden" name={`metric_${metric.metric_id}`} value={value} />
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`metric_${metric.metric_id}_radio`}
                value={option}
                checked={value === option}
                onChange={(event) => onChange(event.currentTarget.value)}
                disabled={pending}
              />
              {option}
            </label>
          ))}
        </div>
      )
    }

    return (
      <select
        name={`metric_${metric.metric_id}`}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={pending}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select one</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (metric.data_type === 'file') {
    return (
      <input
        name={`metric_${metric.metric_id}`}
        type="url"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={settings.fileKind === 'image' ? 'https://.../image.png' : 'https://.../document.pdf'}
        disabled={pending}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
    )
  }

  return (
    <input
      name={`metric_${metric.metric_id}`}
      type="number"
      inputMode="decimal"
      step={metric.data_type === 'number' && settings.numberKind === 'integer' ? '1' : '0.01'}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder="0"
      disabled={pending}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
    />
  )
}

export function DailyLogForm({
  date,
  departmentId,
  userId,
  metrics,
  initialValues,
  initialNotes,
  existingEntry,
}: DailyLogFormProps) {
  const [state, formAction, pending] = useActionState(saveDailyLogAction, INITIAL_DAILY_LOG_ACTION_STATE)
  const [values, setValues] = useState<Record<string, string>>(initialValues)

  const [optimisticValues, addOptimisticValue] = useOptimistic(
    values,
    (state, newAction: { metricId: string; value: string }) => ({
      ...state,
      [newAction.metricId]: newAction.value,
    })
  )

  const [notes, setNotes] = useState(initialNotes)
  const [entryStatus, setEntryStatus] = useState<'draft' | 'submitted' | null>(existingEntry?.status ?? null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(existingEntry?.updated_at ?? null)
  const [lastSubmitKind, setLastSubmitKind] = useState<'autosave' | 'manual-draft' | 'submit' | null>(null)
  const [pendingIntent, setPendingIntent] = useState<'draft' | 'submit' | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const formRef = useRef<HTMLFormElement | null>(null)
  const autosaveSubmitterRef = useRef<HTMLButtonElement | null>(null)
  const lastHandledStateRef = useRef('')

  const savedSnapshot = useMemo(
    () => serializeState(metrics, initialValues, initialNotes, userId),
    [metrics, initialNotes, initialValues, userId],
  )
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(savedSnapshot)

  useEffect(() => {
    setValues(initialValues)
    setNotes(initialNotes)
    setEntryStatus(existingEntry?.status ?? null)
    setLastSavedAt(existingEntry?.updated_at ?? null)
    setLastSavedSnapshot(savedSnapshot)
    setPendingIntent(null)
    setLastSubmitKind(null)
  }, [existingEntry?.entry_id, existingEntry?.status, existingEntry?.updated_at, initialValues, initialNotes, savedSnapshot])

  const currentSnapshot = useMemo(
    () => serializeState(metrics, values, notes, userId),
    [metrics, notes, userId, values],
  )
  const dirty = currentSnapshot !== lastSavedSnapshot

  const pushToast = useCallback((tone: Toast['tone'], message: string) => {
    const toastId = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id: toastId, tone, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toastId))
    }, 3200)
  }, [])

  useEffect(() => {
    if (!dirty || pending || !autosaveSubmitterRef.current || !formRef.current || !userId) {
      return
    }

    const timer = window.setTimeout(() => {
      setLastSubmitKind('autosave')
      setPendingIntent('draft')
      formRef.current?.requestSubmit(autosaveSubmitterRef.current ?? undefined)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [dirty, pending, currentSnapshot, userId])

  useEffect(() => {
    if (state.status === 'idle') {
      return
    }

    const key = `${state.status}|${state.message}|${state.savedAt}|${state.entryId}|${state.entryStatus}`
    if (key === lastHandledStateRef.current) {
      return
    }
    lastHandledStateRef.current = key

    if (state.status === 'success') {
      setLastSavedSnapshot(currentSnapshot)
      setLastSavedAt(state.savedAt)
      setEntryStatus(state.entryStatus)
      setPendingIntent(null)

      if (lastSubmitKind !== 'autosave') {
        pushToast('success', state.message)
      }
      return
    }

    setPendingIntent(null)
    pushToast('error', state.message)
  }, [
    currentSnapshot,
    lastSubmitKind,
    pushToast,
    state.entryId,
    state.entryStatus,
    state.message,
    state.savedAt,
    state.status,
  ])

  const statusText = (() => {
    const savedTime = formatTime(lastSavedAt)

    if (pending) {
      if (pendingIntent === 'submit') {
        return 'Submitting log...'
      }
      return 'Saving draft...'
    }

    if (dirty) {
      return 'Unsaved changes'
    }

    if (state.status === 'error') {
      return state.message
    }

    if (entryStatus === 'submitted') {
      return `Submitted${savedTime ? ` at ${savedTime}` : ''}`
    }

    if (lastSavedAt) {
      return `Draft saved at ${savedTime ?? '-'}`
    }

    return 'No saved draft yet'
  })()

  const disabledForm = pending || !departmentId || !userId
  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="space-y-6"
        onSubmit={(event) => {
          const submitter = event.nativeEvent.submitter as HTMLButtonElement | null
          const submitKind = submitter?.dataset.submitKind as 'autosave' | 'manual-draft' | 'submit' | undefined
          const intent = submitter?.value === 'submit' ? 'submit' : 'draft'
          setLastSubmitKind(submitKind ?? null)
          setPendingIntent(intent)
        }}
      >
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="departmentId" value={departmentId} />
        <input type="hidden" name="userId" value={userId} />

        {metrics.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No active manual metrics found for this department.
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.metric_id} className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">{metric.name}</label>
                  {renderMetricInput(metric, optimisticValues[metric.metric_id] ?? '', disabledForm, (nextValue) => {
                    addOptimisticValue({ metricId: metric.metric_id, value: nextValue })
                    setValues((current) => ({
                      ...current,
                      [metric.metric_id]: nextValue,
                    }))
                  })}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label htmlFor="daily-log-notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="daily-log-notes"
                name="notes"
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.currentTarget.value)}
                disabled={disabledForm}
                placeholder="Add any notes about today's performance..."
                className="w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
              />
            </div>

            <button
              ref={autosaveSubmitterRef}
              type="submit"
              name="intent"
              value="draft"
              data-submit-kind="autosave"
              className="hidden"
              tabIndex={-1}
              aria-hidden={true}
            >
              autosave
            </button>

            <div className="space-y-2">
              <p
                className={
                  state.status === 'error'
                    ? 'text-xs text-destructive'
                    : dirty
                      ? 'text-xs text-amber-600'
                      : 'text-xs text-muted-foreground'
                }
              >
                {statusText}
              </p>
              <Button
                type="submit"
                name="intent"
                value="submit"
                disabled={disabledForm}
                data-submit-kind="submit"
                className="h-12 w-full text-base font-semibold"
              >
                Submit Daily Log
              </Button>
            </div>
          </>
        )}
      </form>

      <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[320px] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              toast.tone === 'error'
                ? 'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-sm'
                : 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm'
            }
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  )
}
