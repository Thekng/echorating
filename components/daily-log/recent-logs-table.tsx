'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import { deleteDailyLogAction } from '@/features/daily-log/actions'
import type { DailyLogKeyMetric, DailyLogRecentEntry, DailyLogRecentMetricValue } from '@/features/daily-log/types'
import { formatSecondsToDuration } from '@/lib/daily-log/value-parser'
import { formatDateShort } from '@/lib/utils'
import { booleanLabels, normalizeMetricSettings } from '@/lib/metrics/data-types'
import { useState, useTransition, useCallback } from 'react'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

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
  if (value === null || value === undefined) return '-'
  const settings = normalizeMetricSettings(metric.data_type, metric.settings)
  if (metric.data_type === 'duration') {
    const factor = settings.durationFormat === 'minutes' ? 60 : settings.durationFormat === 'hours' ? 3600 : 86400
    return settings.durationFormat === 'hh_mm_ss' ? formatSecondsToDuration(value) || '-' : `${Number((value / factor).toFixed(2))}`
  }
  if (metric.data_type === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: settings.currencyCode || 'USD', maximumFractionDigits: 2 }).format(value)
  return metric.data_type === 'percent' ? `${Number(value.toFixed(2))}%` : String(Number(value.toFixed(2)))
}

function getMetricAverage(logs: DailyLogRecentEntry[], metric: DailyLogKeyMetric) {
  if (!isAverageMetric(metric)) return null
  const values = logs.map(log => log.key_metric_values.find(item => item.metric_id === metric.metric_id)?.value_numeric ?? null).filter((v): v is number => v !== null && Number.isFinite(v))
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length
}

function metricValue(values: DailyLogRecentMetricValue[], metric: DailyLogKeyMetric) {
  const value = values.find(item => item.metric_id === metric.metric_id)
  if (!value) return '-'
  const settings = normalizeMetricSettings(metric.data_type, metric.settings)
  if (metric.data_type === 'boolean') return value.value_bool === null ? '-' : value.value_bool ? booleanLabels(settings).trueLabel : booleanLabels(settings).falseLabel
  if (metric.data_type === 'duration') {
    if (value.value_numeric === null || value.value_numeric === undefined) return '-'
    const factor = settings.durationFormat === 'minutes' ? 60 : settings.durationFormat === 'hours' ? 3600 : 86400
    return settings.durationFormat === 'hh_mm_ss' ? formatSecondsToDuration(value.value_numeric) || '-' : `${Number((value.value_numeric / factor).toFixed(2))}`
  }
  if (['text', 'datetime', 'file'].includes(metric.data_type)) return value.value_text || '-'
  if (metric.data_type === 'selection') {
    if (!value.value_text) return '-'
    if (settings.selectionMode === 'multi') {
      try {
        const parsed = JSON.parse(value.value_text)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.join(', ')
      } catch { /* ignore */ }
    }
    return value.value_text
  }
  if (value.value_numeric === null || value.value_numeric === undefined) return '-'
  if (metric.data_type === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: settings.currencyCode || 'USD', maximumFractionDigits: 2 }).format(value.value_numeric)
  return metric.data_type === 'percent' ? `${value.value_numeric}%` : String(value.value_numeric)
}

export function RecentLogsTable({ departmentId, logs, keyMetrics, canDelete, currentPage, pageSize, totalCount }: RecentLogsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [logToDelete, setLogToDelete] = useState<DailyLogRecentEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount)

  const updateTableParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => v ? params.set(k, v) : params.delete(k))
    router.push(`/daily-log?${params.toString()}`)
  }

  const handleDelete = useCallback(() => {
    if (!logToDelete) return
    setError(null)
    startDeleteTransition(async () => {
      try {
        const fd = new FormData(); fd.set('entryId', logToDelete.entry_id)
        await deleteDailyLogAction(fd)
        setLogToDelete(null)
      } catch { setError('Failed to delete log entry.') }
    })
  }, [logToDelete])

  if (logs.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{totalCount > 0 ? 'No logs found.' : 'No recent logs.'}</p>
          <div className="flex items-center gap-2"><label htmlFor="ps" className="text-sm text-muted-foreground">Logs</label>
            <select id="ps" value={pageSize} className="h-9 rounded-md border border-input bg-background px-3 text-sm" onChange={e => updateTableParams({ logsPerPage: e.target.value, logsPage: '1' })}>
              {PAGE_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select></div></div>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{totalCount > 0 ? 'Try previous page.' : 'No logs for this filter.'}</div>
        {totalCount > 0 && <div className="flex items-center justify-end gap-2">
          <button type="button" className="h-9 px-3 text-sm border rounded-md disabled:opacity-50" onClick={() => updateTableParams({ logsPage: String(currentPage - 1) })} disabled={currentPage <= 1}>Previous</button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <button type="button" className="h-9 px-3 text-sm border rounded-md disabled:opacity-50" onClick={() => updateTableParams({ logsPage: String(currentPage + 1) })} disabled={currentPage >= totalPages}>Next</button>
        </div>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">{error}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Showing {startItem}-{endItem} of {totalCount} logs</p>
        <div className="flex items-center gap-2"><label htmlFor="ps-main" className="text-sm text-muted-foreground">Logs</label>
          <select id="ps-main" value={pageSize} className="h-9 rounded-md border border-input bg-background px-3 text-sm" onChange={e => updateTableParams({ logsPerPage: e.target.value, logsPage: '1' })}>
            {PAGE_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select></div></div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[940px] w-full text-sm">
          <thead className="border-b bg-muted/30"><tr><th className="px-3 py-2 text-left font-medium">Date</th><th className="px-3 py-2 text-left font-medium">Agent</th>{keyMetrics.map(m => <th key={m.metric_id} className="px-3 py-2 text-left font-medium">{m.name}</th>)}<th className="px-3 py-2 text-left font-medium">Notes</th><th className="px-3 py-2 text-left font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Actions</th></tr></thead>
          <tbody>{logs.map(log => (
            <tr key={log.entry_id} className="border-b last:border-b-0"><td className="px-3 py-2">{formatDateShort(log.entry_date)}</td><td className="px-3 py-2">{log.user_name}</td>{keyMetrics.map(m => <td key={m.metric_id} className="px-3 py-2">{metricValue(log.key_metric_values, m)}</td>)}
              <td className="px-3 py-2 text-muted-foreground"><span className="block max-w-[280px] truncate">{log.notes?.trim() || '-'}</span></td>
              <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-xs ${log.status === 'submitted' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{log.status}</span></td>
              <td className="px-3 py-2"><div className="flex items-center justify-end gap-2"><Link href={`/daily-log?departmentId=${departmentId}&userId=${log.user_id}&date=${log.entry_date}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted/40" aria-label="Edit"><Pencil className="size-3.5" /></Link>
                {canDelete && <button type="button" onClick={() => setLogToDelete(log)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="size-3.5" /></button>}</div></td></tr>))}</tbody>
          <tfoot className="border-t bg-muted/20"><tr><td className="px-3 py-2 font-semibold">Avg</td><td className="px-3 py-2 text-muted-foreground">Visible logs</td>{keyMetrics.map(m => <td key={m.metric_id} className="px-3 py-2 font-medium">{formatAverageValue(m, getMetricAverage(logs, m))}</td>)}<td className="px-3 py-2">-</td><td className="px-3 py-2">-</td><td className="px-3 py-2 text-right">-</td></tr></tfoot>
        </table></div>
      <div className="flex items-center justify-end gap-2">
        <button type="button" className="h-9 px-3 text-sm border rounded-md disabled:opacity-50" onClick={() => updateTableParams({ logsPage: String(currentPage - 1) })} disabled={currentPage <= 1}>Previous</button>
        <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
        <button type="button" className="h-9 px-3 text-sm border rounded-md disabled:opacity-50" onClick={() => updateTableParams({ logsPage: String(currentPage + 1) })} disabled={currentPage >= totalPages}>Next</button>
      </div>
      {logToDelete && <ConfirmDialog title="Delete log entry?" description={`Permanently delete the log for ${logToDelete.user_name} on ${formatDateShort(logToDelete.entry_date)}?`} confirmText="Delete" onConfirm={handleDelete} onCancel={() => setLogToDelete(null)} isLoading={isDeleting} />}
    </div>
  )
}
