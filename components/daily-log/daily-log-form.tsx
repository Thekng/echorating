'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, FileEdit, Circle } from 'lucide-react'
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
  date: string,
) {
  const metricsPart = metrics
    .map((metric) => `${metric.id}:${values[metric.id] ?? ''}`)
    .join('|')

  return `${userId}::${date}::${notes}::${metricsPart}`
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
        name={`metric_${metric.id}`}
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
      const unitLabel =
        settings.durationFormat === 'minutes' ? 'min' :
        settings.durationFormat === 'hours' ? 'hrs' :
        settings.durationFormat === 'days' ? 'days' : ''

      return (
        <div className="flex items-center gap-1.5">
          <input
            name={`metric_${metric.id}`}
            type="number"
            step={settings.durationFormat === 'days' ? '0.01' : '1'}
            min="0"
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder="0"
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {unitLabel && <span className="shrink-0 text-sm text-muted-foreground">{unitLabel}</span>}
        </div>
      )
    }

    return (
      <DurationSelector
        name={`metric_${metric.id}`}
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
          name={`metric_${metric.id}`}
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
        name={`metric_${metric.id}`}
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
        name={`metric_${metric.id}`}
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
          <input type="hidden" name={`metric_${metric.id}`} value={value} />
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
          <input type="hidden" name={`metric_${metric.id}`} value={value} />
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`metric_${metric.id}_radio`}
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
        name={`metric_${metric.id}`}
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
        name={`metric_${metric.id}`}
        type="url"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={settings.fileKind === 'image' ? 'https://.../image.png' : 'https://.../document.pdf'}
        disabled={pending}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
    )
  }

  const currencySymbol: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', BRL: 'R$',
  }

  if (metric.data_type === 'currency') {
    const symbol = currencySymbol[settings.currencyCode ?? 'USD'] ?? settings.currencyCode ?? '$'
    return (
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-sm text-muted-foreground">{symbol}</span>
        <input
          name={`metric_${metric.id}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="0.00"
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
    )
  }

  if (metric.data_type === 'percentage' || metric.data_type === 'percent') {
    return (
      <div className="flex items-center gap-1.5">
        <input
          name={`metric_${metric.id}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="0"
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
        <span className="shrink-0 text-sm text-muted-foreground">%</span>
      </div>
    )
  }

  return (
    <input
      name={`metric_${metric.id}`}
      type="number"
      inputMode="decimal"
      step={settings.numberKind === 'integer' ? '1' : '0.01'}
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, formAction, pending] = useActionState(saveDailyLogAction, INITIAL_DAILY_LOG_ACTION_STATE)
  const [values, setValues] = useState<Record<string, string>>(initialValues)

  const [notes, setNotes] = useState(initialNotes)
  const [logDate, setLogDate] = useState(date)
  const [entryStatus, setEntryStatus] = useState<'draft' | 'submitted' | null>(existingEntry?.status ?? null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(existingEntry?.updated_at ?? null)
  const [lastSubmitKind, setLastSubmitKind] = useState<'manual-draft' | 'submit' | null>(null)
  const [pendingIntent, setPendingIntent] = useState<'draft' | 'submit' | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const formRef = useRef<HTMLFormElement | null>(null)
  const draftSubmitterRef = useRef<HTMLButtonElement | null>(null)
  const lastHandledStateRef = useRef('')

  const savedSnapshot = useMemo(
    () => serializeState(metrics, initialValues, initialNotes, userId, date),
    [date, metrics, initialNotes, initialValues, userId],
  )
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(savedSnapshot)

  useEffect(() => {
    setValues(initialValues)
    setNotes(initialNotes)
    setLogDate(date)
    setEntryStatus(existingEntry?.status ?? null)
    setLastSavedAt(existingEntry?.updated_at ?? null)
    setLastSavedSnapshot(savedSnapshot)
    setPendingIntent(null)
    setLastSubmitKind(null)
  }, [date, existingEntry?.id, existingEntry?.status, existingEntry?.updated_at, initialValues, initialNotes, savedSnapshot])

  const currentSnapshot = useMemo(
    () => serializeState(metrics, values, notes, userId, logDate),
    [logDate, metrics, notes, userId, values],
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
      pushToast('success', state.message)

      if (logDate !== date) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('date', logDate)
        params.set('departmentId', departmentId)
        params.set('userId', userId)
        router.push(`/daily-log?${params.toString()}`)
      }

      return
    }

    setPendingIntent(null)
    pushToast('error', state.message)
  }, [
    currentSnapshot,
    date,
    departmentId,
    logDate,
    lastSubmitKind,
    pushToast,
    router,
    searchParams,
    state.entryId,
    state.entryStatus,
    state.message,
    state.savedAt,
    state.status,
    userId,
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

  const filledCount = metrics.filter((m) => {
    const v = values[m.id]
    return v !== undefined && v !== ''
  }).length
  const totalCount = metrics.length
  const progressPct = totalCount > 0 ? (filledCount / totalCount) * 100 : 0

  const statusBadge = (() => {
    if (entryStatus === 'submitted') {
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Submitted
        </Badge>
      )
    }
    if (entryStatus === 'draft') {
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <FileEdit className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      )
    }
    return (
      <Badge variant="outline">
        <Circle className="mr-1 h-3 w-3" />
        New Entry
      </Badge>
    )
  })()

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="space-y-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
          const submitKind = submitter?.dataset.submitKind as 'manual-draft' | 'submit' | undefined
          const intent = submitter?.value === 'submit' ? 'submit' : 'draft'
          setLastSubmitKind(submitKind ?? null)
          setPendingIntent(intent)
        }}
      >
        <input type="hidden" name="date" value={logDate} />
        <input type="hidden" name="entryId" value={existingEntry?.id ?? ''} />
        <input type="hidden" name="departmentId" value={departmentId} />
        <input type="hidden" name="userId" value={userId} />

        {metrics.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No active manual metrics found for this department.
          </p>
        ) : (
          <>
            {/* Form header: status + progress */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {statusBadge}
                {dirty && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filledCount} / {totalCount} metrics
                </span>
                <div className="w-24">
                  <Progress value={progressPct} className="h-1.5" />
                </div>
              </div>
            </div>

            {/* Metric inputs */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => {
                const isFilled = values[metric.id] !== undefined && values[metric.id] !== ''
                return (
                  <div
                    key={metric.id}
                    className={`space-y-1.5 rounded-lg border p-3 transition-colors ${
                      isFilled
                        ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                        : 'border-border bg-background'
                    }`}
                  >
                    <label className="block text-xs font-medium text-muted-foreground">{metric.name}</label>
                    {renderMetricInput(metric, values[metric.id] ?? '', disabledForm, (nextValue) => {
                      setValues((current) => ({
                        ...current,
                        [metric.id]: nextValue,
                      }))
                    })}
                  </div>
                )
              })}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="daily-log-notes" className="text-xs font-medium text-muted-foreground">
                Notes (optional)
              </label>
              <textarea
                id="daily-log-notes"
                name="notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.currentTarget.value)}
                onFocus={(event) => {
                  if (event.currentTarget.rows < 4) event.currentTarget.rows = 4
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.value.trim()) event.currentTarget.rows = 2
                }}
                disabled={disabledForm}
                placeholder="Add any notes about today's performance..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 gap-3">
                <Button
                  ref={draftSubmitterRef}
                  type="submit"
                  name="intent"
                  value="draft"
                  disabled={disabledForm || !dirty}
                  data-submit-kind="manual-draft"
                  variant="outline"
                  className="h-11 flex-1 text-sm font-semibold"
                >
                  Save Draft
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="submit"
                  disabled={disabledForm}
                  data-submit-kind="submit"
                  className="h-11 flex-1 gap-2 text-sm font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Daily Log
                </Button>
              </div>
              <p
                className={`shrink-0 text-xs ${
                  state.status === 'error'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {statusText}
              </p>
            </div>
          </>
        )}
      </form>

      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[320px] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              toast.tone === 'error'
                ? 'pointer-events-auto rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-sm'
                : 'pointer-events-auto rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
            }
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  )
}
