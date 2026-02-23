'use client'

import { useActionState, useState } from 'react'
import { Eraser, Save } from 'lucide-react'
import { upsertDailyDepartmentTargetAction } from '@/features/targets/actions'
import { INITIAL_UPSERT_DAILY_TARGET_STATE } from '@/features/targets/action-state'
import { SettingsFeedback } from '@/components/settings/settings-feedback'
import { DurationSelector } from '@/components/daily-log/duration-selector'
import {
  normalizeMetricSettings,
  type MetricDataType,
  type MetricSettings,
} from '@/lib/metrics/data-types'
import { formatSecondsToDuration, parseDurationToSeconds } from '@/lib/daily-log/value-parser'

type MetricTargetControlProps = {
  metricId: string
  departmentId: string
  metricName: string
  metricDataType: MetricDataType
  metricSettings: MetricSettings | null
  initialValue: number | null
}

export function MetricTargetControl({
  metricId,
  departmentId,
  metricName,
  metricDataType,
  metricSettings,
  initialValue,
}: MetricTargetControlProps) {
  const settings = normalizeMetricSettings(metricDataType, metricSettings)
  const isDurationHhMmSs = metricDataType === 'duration' && settings.durationFormat === 'hh_mm_ss'

  const [value, setValue] = useState(initialValue === null ? '' : String(initialValue))
  const [durationValue, setDurationValue] = useState(
    initialValue === null ? '' : formatSecondsToDuration(initialValue),
  )
  const [state, formAction, pending] = useActionState(upsertDailyDepartmentTargetAction, {
    ...INITIAL_UPSERT_DAILY_TARGET_STATE,
    value: initialValue,
  })

  const parsedDuration = isDurationHhMmSs ? parseDurationToSeconds(durationValue) : null
  const hasDurationError =
    isDurationHhMmSs && durationValue.trim() !== '' && parsedDuration !== null && !parsedDuration.ok
  const serializedDurationValue =
    isDurationHhMmSs && parsedDuration !== null && parsedDuration.ok && parsedDuration.value !== null
      ? String(parsedDuration.value)
      : ''

  const numberStep =
    metricDataType === 'number' && settings.numberKind === 'integer'
      ? '1'
      : metricDataType === 'duration' && settings.durationFormat === 'days'
        ? '0.01'
        : '0.01'

  const numberPlaceholder =
    metricDataType === 'duration'
      ? settings.durationFormat === 'minutes'
        ? 'minutes'
        : settings.durationFormat === 'hours'
          ? 'hours'
          : settings.durationFormat === 'days'
            ? 'days'
            : 'target'
      : 'target'

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <input type="hidden" name="metricId" value={metricId} />
        <input type="hidden" name="departmentId" value={departmentId} />
        {isDurationHhMmSs ? (
          <>
            <input name="value" type="hidden" value={serializedDurationValue} />
            <DurationSelector
              name={`${metricId}_duration_target`}
              value={durationValue}
              onChange={setDurationValue}
              disabled={pending}
              ariaLabel={`Daily target for ${metricName}`}
            />
          </>
        ) : (
          <input
            name="value"
            type="number"
            step={numberStep}
            min="0"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={numberPlaceholder}
            className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
            aria-label={`Daily target for ${metricName}`}
            disabled={pending}
          />
        )}

        <button
          type="submit"
          name="intent"
          value="save"
          title={`Save target for ${metricName}`}
          aria-label={`Save target for ${metricName}`}
          className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted/40 disabled:opacity-60"
          disabled={pending || hasDurationError}
        >
          <Save className="size-3.5" />
        </button>

        <button
          type="submit"
          name="intent"
          value="clear"
          onClick={() => {
            setValue('')
            setDurationValue('')
          }}
          title={`Clear target for ${metricName}`}
          aria-label={`Clear target for ${metricName}`}
          className="inline-flex size-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted/40 disabled:opacity-60"
          disabled={pending}
        >
          <Eraser className="size-3.5" />
        </button>
      </div>

      <div className="min-h-4">
        <SettingsFeedback status={state.status} message={state.message} className="text-xs" />
      </div>

      {hasDurationError && parsedDuration && !parsedDuration.ok ? (
        <p className="text-xs text-destructive">{parsedDuration.message}</p>
      ) : null}
    </form>
  )
}
