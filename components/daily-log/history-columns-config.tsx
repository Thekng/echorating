'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { updateDepartmentLogKeyMetricsAction } from '@/features/daily-log/actions'
import {
  INITIAL_DAILY_LOG_KEY_METRICS_STATE,
  type DailyLogKeyMetricSlot,
  type DailyLogMetric,
} from '@/features/daily-log/types'

type HistoryColumnsConfigProps = {
  departmentId: string
  candidates: DailyLogMetric[]
  config: DailyLogKeyMetricSlot[]
}

function slotValue(config: DailyLogKeyMetricSlot[], slot: 1 | 2 | 3) {
  return config.find((item) => item.slot === slot)?.metric_id ?? ''
}

export function HistoryColumnsConfig({ departmentId, candidates, config }: HistoryColumnsConfigProps) {
  const [state, formAction, pending] = useActionState(
    updateDepartmentLogKeyMetricsAction,
    INITIAL_DAILY_LOG_KEY_METRICS_STATE,
  )

  return (
    <form action={formAction} className="rounded-lg border bg-card p-4">
      <input type="hidden" name="departmentId" value={departmentId} />

      <div className="mb-3">
        <h3 className="text-sm font-semibold">History Columns</h3>
        <p className="text-xs text-muted-foreground">Pick 3 KPI columns to show in Recent Logs.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {[1, 2, 3].map((slot) => (
          <div key={slot} className="space-y-1">
            <label htmlFor={`daily-log-slot-${slot}`} className="text-xs font-medium text-muted-foreground">
              Slot {slot}
            </label>
            <select
              id={`daily-log-slot-${slot}`}
              name={`slot${slot}`}
              defaultValue={slotValue(config, slot as 1 | 2 | 3)}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">None</option>
              {candidates.map((metric) => (
                <option key={metric.metric_id} value={metric.metric_id}>
                  {metric.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className={state.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {state.status === 'idle' ? 'Manager/owner can customize these columns.' : state.message}
        </p>

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
