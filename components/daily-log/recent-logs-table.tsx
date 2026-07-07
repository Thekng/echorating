'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2, Pencil, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { deleteDailyLogAction } from '@/features/daily-log/actions'
import type {
  DailyLogMetric,
  DailyLogRecentEntry,
  DailyLogRecentMetricValue,
} from '@/features/daily-log/types'
import { formatDateShort } from '@/lib/utils'
import { booleanLabels, normalizeMetricSettings } from '@/lib/metrics/data-types'
import { formatMetricNumber } from '@/lib/metrics/format'

type RecentLogsTableProps = {
  departmentId: string
  logs: DailyLogRecentEntry[]
  metrics: DailyLogMetric[]
  canDelete: boolean
  canExport?: boolean
  currentPage: number
  pageSize: number
  totalCount: number
}

const PAGE_SIZE_OPTIONS = [10, 30, 50] as const

function isAverageMetric(metric: DailyLogMetric) {
  return (
    metric.data_type === 'number' ||
    metric.data_type === 'currency' ||
    metric.data_type === 'percent' ||
    metric.data_type === 'duration'
  )
}

function formatAverageValue(metric: DailyLogMetric, value: number | null) {
  if (value === null || value === undefined) {
    return '-'
  }

  return formatMetricNumber(value, {
    dataType: metric.data_type,
    unit: metric.unit,
    settings: metric.settings,
  })
}

function getMetricAverage(logs: DailyLogRecentEntry[], metric: DailyLogMetric) {
  if (!isAverageMetric(metric)) {
    return null
  }

  const values = logs
    .map((log) => log.key_metric_values.find((item) => item.metric_id === metric.id)?.value_number ?? null)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value))

  if (values.length === 0) {
    return null
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

function metricValue(values: DailyLogRecentMetricValue[], metric: DailyLogMetric) {
  const value = values.find((item) => item.metric_id === metric.id)
  if (!value) {
    return '-'
  }
  const settings = normalizeMetricSettings(metric.data_type, metric.settings)

  // Non-numeric types: handle directly
  if (metric.data_type === 'boolean') {
    if (value.value_boolean === null) {
      return '-'
    }
    const labels = booleanLabels(settings)
    return value.value_boolean ? labels.trueLabel : labels.falseLabel
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

  // Numeric types (number, currency, percent, duration): delegate to formatMetricNumber
  if (value.value_number === null || value.value_number === undefined) {
    return '-'
  }

  return formatMetricNumber(value.value_number, {
    dataType: metric.data_type,
    unit: metric.unit,
    settings: metric.settings,
  })
}

export function RecentLogsTable({
  departmentId,
  logs,
  metrics,
  canDelete,
  canExport,
  currentPage,
  pageSize,
  totalCount,
}: RecentLogsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [logToDelete, setLogToDelete] = useState<string | null>(null)

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
          {canExport && (
            <a
              href={`/api/export/daily-logs?departmentId=${departmentId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm hover:bg-muted/40"
              title="Export CSV"
            >
              <Download className="size-3.5" />
              Export CSV
            </a>
          )}
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
            {metrics.map((metric) => (
              <th key={metric.id} className="px-3 py-2 text-left font-medium">
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
            <tr key={log.id} className="border-b last:border-b-0">
              <td className="px-3 py-2">{formatDateShort(log.report_date)}</td>
              <td className="px-3 py-2">{log.user_name}</td>
              {metrics.map((metric) => (
                <td key={metric.id} className="px-3 py-2">
                  {metricValue(log.key_metric_values, metric)}
                </td>
              ))}
              <td className="px-3 py-2 text-muted-foreground">
                <span className="block max-w-[280px] truncate">{log.notes?.trim() || '-'}</span>
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={
                    log.status === 'submitted'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  }
                >
                  {log.status}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/daily-log?departmentId=${departmentId}&userId=${log.user_id}&date=${log.report_date}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                    title="Edit"
                    aria-label="Edit"
                  >
                    <Pencil className="size-3.5" />
                  </Link>

                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => setLogToDelete(log.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
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
            {metrics.map((metric) => (
              <td key={metric.id} className="px-3 py-2 font-medium">
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

      <ConfirmDialog
        open={!!logToDelete}
        title="Delete log"
        description="Are you sure you want to delete this log permanently? This action cannot be undone."
        isLoading={isPending}
        loadingText="Deleting..."
        onConfirm={() => {
          if (!logToDelete) return
          startTransition(async () => {
            const formData = new FormData()
            formData.set('entryId', logToDelete)
            await deleteDailyLogAction(formData)
            setLogToDelete(null)
          })
        }}
        onCancel={() => setLogToDelete(null)}
      />
    </div>
  )
}
