'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import { deleteDailyLogAction } from '@/features/daily-log/actions'
import type {
  DailyLogKeyMetric,
  DailyLogRecentEntry,
  DailyLogRecentMetricValue,
} from '@/features/daily-log/types'
import { formatSecondsToDuration } from '@/lib/daily-log/value-parser'
import { formatDateShort } from '@/lib/utils'
import { booleanLabels, normalizeMetricSettings } from '@/lib/metrics/data-types'

type RecentLogsTableProps = {
  departmentId: string
  logs: DailyLogRecentEntry[]
  keyMetrics: DailyLogKeyMetric[]
  canDelete: boolean
  currentPage: number
  pageSize: number
  totalCount: number
}

const PAGE_SIZE_OPTIONS = [10, 30, 50] as const

function isAverageMetric(metric: DailyLogKeyMetric) {
  return (
    metric.data_type === 'number' ||
    metric.data_type === 'currency' ||
    metric.data_type === 'percent' ||
    metric.data_type === 'duration'
  )
}

function formatAverageValue(metric: DailyLogKeyMetric, value: number | null) {
  if (value === null || value === undefined) {
    return '-'
  }

  const settings = normalizeMetricSettings(metric.data_type, metric.settings)

  if (metric.data_type === 'duration') {
    if (settings.durationFormat === 'minutes') {
      return `${Number((value / 60).toFixed(2))}`
    }
    if (settings.durationFormat === 'hours') {
      return `${Number((value / 3600).toFixed(2))}`
    }
    if (settings.durationFormat === 'days') {
      return `${Number((value / 86400).toFixed(2))}`
    }
    return formatSecondsToDuration(value) || '-'
  }

  if (metric.data_type === 'currency') {
    const currencyCode = settings.currencyCode || 'USD'
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (metric.data_type === 'percent') {
    return `${Number(value.toFixed(2))}%`
  }

  return String(Number(value.toFixed(2)))
}

function getMetricAverage(logs: DailyLogRecentEntry[], metric: DailyLogKeyMetric) {
  if (!isAverageMetric(metric)) {
    return null
  }

  const values = logs
    .map((log) => log.key_metric_values.find((item) => item.metric_id === metric.metric_id)?.value_numeric ?? null)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value))

  if (values.length === 0) {
    return null
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

function metricValue(values: DailyLogRecentMetricValue[], metric: DailyLogKeyMetric) {
  const value = values.find((item) => item.metric_id === metric.metric_id)
  if (!value) {
    return '-'
  }
  const settings = normalizeMetricSettings(metric.data_type, metric.settings)

  if (metric.data_type === 'boolean') {
    if (value.value_bool === null) {
      return '-'
    }

    const labels = booleanLabels(settings)
    return value.value_bool ? labels.trueLabel : labels.falseLabel
  }

  if (metric.data_type === 'duration') {
    if (value.value_numeric === null || value.value_numeric === undefined) {
      return '-'
    }

    if (settings.durationFormat === 'minutes') {
      return `${Number((value.value_numeric / 60).toFixed(2))}`
    }
    if (settings.durationFormat === 'hours') {
      return `${Number((value.value_numeric / 3600).toFixed(2))}`
    }
    if (settings.durationFormat === 'days') {
      return `${Number((value.value_numeric / 86400).toFixed(2))}`
    }
    return formatSecondsToDuration(value.value_numeric) || '-'
  }

  if (metric.data_type === 'text' || metric.data_type === 'datetime' || metric.data_type === 'file') {
    return value.value_text || '-'
  }

  if (metric.data_type === 'selection') {
    if (!value.value_text) {
      return '-'
    }

    if (settings.selectionMode === 'multi') {
      try {
        const parsed = JSON.parse(value.value_text) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.join(', ')
        }
      } catch {
        // ignore
      }
    }
    return value.value_text
  }

  if (value.value_numeric === null || value.value_numeric === undefined) {
    return '-'
  }

  if (metric.data_type === 'currency') {
    const currencyCode = settings.currencyCode || 'USD'
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value.value_numeric)
  }

  if (metric.data_type === 'percent') {
    return `${value.value_numeric}%`
  }

  return String(value.value_numeric)
}

export function RecentLogsTable({
  departmentId,
  logs,
  keyMetrics,
  canDelete,
  currentPage,
  pageSize,
  totalCount,
}: RecentLogsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount)

  function updateTableParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    router.push(`/daily-log?${params.toString()}`)
  }

  if (logs.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {totalCount > 0 ? 'No logs found for this page.' : 'No recent logs for this filter.'}
          </p>

          <div className="flex items-center gap-2">
            <label htmlFor="recent-logs-page-size" className="text-sm text-muted-foreground">
              Logs
            </label>
            <select
              id="recent-logs-page-size"
              value={String(pageSize)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) =>
                updateTableParams({
                  logsPerPage: event.currentTarget.value,
                  logsPage: '1',
                })
              }
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {totalCount > 0 ? 'Try going back to the previous page.' : 'No recent logs for this filter.'}
        </div>

        {totalCount > 0 ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
              onClick={() =>
                updateTableParams({
                  logsPage: String(currentPage - 1),
                })
              }
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
              onClick={() =>
                updateTableParams({
                  logsPage: String(currentPage + 1),
                })
              }
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {startItem}-{endItem} of {totalCount} logs
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="recent-logs-page-size" className="text-sm text-muted-foreground">
            Logs
          </label>
          <select
            id="recent-logs-page-size"
            value={String(pageSize)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) =>
              updateTableParams({
                logsPerPage: event.currentTarget.value,
                logsPage: '1',
              })
            }
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

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
              <td className="px-3 py-2">{formatDateShort(log.entry_date)}</td>
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
        <tfoot className="border-t bg-muted/20">
          <tr>
            <td className="px-3 py-2 font-semibold">Avg</td>
            <td className="px-3 py-2 text-muted-foreground">Visible logs</td>
            {keyMetrics.map((metric) => (
              <td key={metric.metric_id} className="px-3 py-2 font-medium">
                {formatAverageValue(metric, getMetricAverage(logs, metric))}
              </td>
            ))}
            <td className="px-3 py-2">-</td>
            <td className="px-3 py-2">-</td>
            <td className="px-3 py-2 text-right">-</td>
          </tr>
        </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
          onClick={() =>
            updateTableParams({
              logsPage: String(currentPage - 1),
            })
          }
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
          onClick={() =>
            updateTableParams({
              logsPage: String(currentPage + 1),
            })
          }
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  )
}
