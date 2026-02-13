'use client'

import Link from 'next/link'
import { Trash2, Pencil } from 'lucide-react'
import { deleteDailyLogAction } from '@/features/daily-log/actions'
import type {
  DailyLogKeyMetric,
  DailyLogRecentEntry,
  DailyLogRecentMetricValue,
} from '@/features/daily-log/types'
import { formatSecondsToDuration } from '@/lib/daily-log/value-parser'

type RecentLogsTableProps = {
  departmentId: string
  logs: DailyLogRecentEntry[]
  keyMetrics: DailyLogKeyMetric[]
  canDelete: boolean
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function metricValue(values: DailyLogRecentMetricValue[], metric: DailyLogKeyMetric) {
  const value = values.find((item) => item.metric_id === metric.metric_id)
  if (!value) {
    return '-'
  }

  if (metric.data_type === 'boolean') {
    if (value.value_bool === null) {
      return '-'
    }

    return value.value_bool ? 'Yes' : 'No'
  }

  if (metric.data_type === 'duration') {
    return formatSecondsToDuration(value.value_numeric) || '-'
  }

  if (value.value_numeric === null || value.value_numeric === undefined) {
    return '-'
  }

  if (metric.data_type === 'currency') {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value.value_numeric)
  }

  if (metric.data_type === 'percent') {
    return `${value.value_numeric}%`
  }

  return String(value.value_numeric)
}

export function RecentLogsTable({ departmentId, logs, keyMetrics, canDelete }: RecentLogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No recent logs for this filter.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-[940px] w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">Agent</th>
            {keyMetrics.map((metric) => (
              <th key={metric.metric_id} className="px-3 py-2 text-left font-medium">
                {metric.name}
              </th>
            ))}
            <th className="px-3 py-2 text-left font-medium">Notes</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.entry_id} className="border-b last:border-b-0">
              <td className="px-3 py-2">{formatDate(log.entry_date)}</td>
              <td className="px-3 py-2">{log.user_name}</td>
              {keyMetrics.map((metric) => (
                <td key={metric.metric_id} className="px-3 py-2">
                  {metricValue(log.key_metric_values, metric)}
                </td>
              ))}
              <td className="px-3 py-2 text-muted-foreground">
                <span className="block max-w-[280px] truncate">{log.notes?.trim() || '-'}</span>
              </td>
              <td className="px-3 py-2">
                <span
                  className={
                    log.status === 'submitted'
                      ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                      : 'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700'
                  }
                >
                  {log.status}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/daily-log?departmentId=${departmentId}&userId=${log.user_id}&date=${log.entry_date}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                    title="Edit"
                    aria-label="Edit"
                  >
                    <Pencil className="size-3.5" />
                  </Link>

                  {canDelete ? (
                    <form
                      action={deleteDailyLogAction}
                      onSubmit={(event) => {
                        if (!window.confirm('Delete this log permanently?')) {
                          event.preventDefault()
                        }
                      }}
                    >
                      <input type="hidden" name="entryId" value={log.entry_id} />
                      <button
                        type="submit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
