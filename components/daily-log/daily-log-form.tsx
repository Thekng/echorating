'use client'

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { saveDailyLogAction } from '@/features/daily-log/actions'
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

function formatMetricSubLabel(metric: DailyLogMetric) {
  if (metric.data_type === 'duration') {
    return 'HH:MM:SS'
  }

  if (metric.data_type === 'boolean') {
    return 'yes / no'
  }

  if (metric.data_type === 'currency') {
    return metric.unit || 'currency'
  }

  if (metric.data_type === 'percent') {
    return '%'
  }

  return metric.unit || 'number'
}

function renderMetricInput(
  metric: DailyLogMetric,
  value: string,
  pending: boolean,
  onChange: (nextValue: string) => void,
) {
  if (metric.data_type === 'boolean') {
    const enabled = value === 'true'

    return (
      <>
        <input name={`metric_${metric.metric_id}`} type="hidden" value={enabled ? 'true' : 'false'} />
        <button
          type="button"
          onClick={() => onChange(enabled ? 'false' : 'true')}
          disabled={pending}
          className={
            enabled
              ? 'h-9 w-full rounded-md border border-emerald-500 bg-emerald-50 text-sm font-medium text-emerald-700'
              : 'h-9 w-full rounded-md border border-input bg-background text-sm text-muted-foreground'
          }
        >
          {enabled ? 'Yes' : 'No'}
        </button>
      </>
    )
  }

  return (
    <input
      name={`metric_${metric.metric_id}`}
      type="text"
      inputMode={metric.data_type === 'duration' ? 'text' : 'decimal'}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={metric.data_type === 'duration' ? '00:00:00' : '0'}
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
        className="space-y-4"
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

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Entry status</p>
              <span
                className={
                  entryStatus === 'submitted'
                    ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                    : 'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700'
                }
              >
                {entryStatus === 'submitted' ? 'Submitted' : 'Draft'}
              </span>
            </div>
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
          </div>

          {metrics.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No active manual metrics found for this department.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.metric_id} className="space-y-1 rounded-md border border-border/80 p-3">
                  <p className="truncate text-sm font-medium">{metric.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {metric.code} · {formatMetricSubLabel(metric)}
                  </p>
                  {renderMetricInput(metric, values[metric.metric_id] ?? '', disabledForm, (nextValue) => {
                    setValues((current) => ({
                      ...current,
                      [metric.metric_id]: nextValue,
                    }))
                  })}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-2">
            <label htmlFor="daily-log-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="daily-log-notes"
              name="notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              disabled={disabledForm}
              placeholder="Add notes about today's performance"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
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

          <Button
            type="submit"
            name="intent"
            value="draft"
            variant="outline"
            disabled={disabledForm}
            data-submit-kind="manual-draft"
          >
            Save draft
          </Button>

          <Button
            type="submit"
            name="intent"
            value="submit"
            disabled={disabledForm}
            data-submit-kind="submit"
          >
            Submit log
          </Button>
        </div>
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
