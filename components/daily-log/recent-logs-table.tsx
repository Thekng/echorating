'use client'
import Link from 'next/link'; import { useRouter, useSearchParams } from 'next/navigation'; import { useState, useTransition } from 'react'; import { Trash2, Pencil } from 'lucide-react'; import { Badge } from '@/components/ui/badge'; import { ConfirmDialog } from '@/components/shared/confirm-dialog'; import { deleteDailyLogAction } from '@/features/daily-log/actions'
import type { DailyLogKeyMetric, DailyLogRecentEntry, DailyLogRecentMetricValue } from '@/features/daily-log/types'; import { formatSecondsToDuration } from '@/lib/daily-log/value-parser'; import { formatDateShort } from '@/lib/utils'; import { booleanLabels, normalizeMetricSettings } from '@/lib/metrics/data-types'
function formatAverageValue(m: DailyLogKeyMetric, v: number | null) {
  if (v === null || v === undefined) return '-'; const s = normalizeMetricSettings(m.data_type, m.settings)
  if (m.data_type === 'duration') { if (s.durationFormat === 'minutes') return `${Number((v / 60).toFixed(2))}`; if (s.durationFormat === 'hours') return `${Number((v / 3600).toFixed(2))}`; if (s.durationFormat === 'days') return `${Number((v / 86400).toFixed(2))}`; return formatSecondsToDuration(v) || '-' }
  if (m.data_type === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: s.currencyCode || 'USD', maximumFractionDigits: 2 }).format(v)
  if (m.data_type === 'percent') return `${Number(v.toFixed(2))}%`; return String(Number(v.toFixed(2)))
}
function getMetricAverage(logs: DailyLogRecentEntry[], m: DailyLogKeyMetric) {
  const values = logs.map((l) => l.key_metric_values.find((i) => i.metric_id === m.id)?.value_number ?? null).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length
}
function metricValue(values: DailyLogRecentMetricValue[], m: DailyLogKeyMetric) {
  const v = values.find((i) => i.metric_id === m.id); if (!v) return '-'; const s = normalizeMetricSettings(m.data_type, m.settings)
  if (m.data_type === 'boolean') { if (v.value_boolean === null) return '-'; const l = booleanLabels(s); return v.value_boolean ? l.trueLabel : l.falseLabel }
  if (m.data_type === 'duration') { if (v.value_number === null || v.value_number === undefined) return '-'; if (s.durationFormat === 'minutes') return `${Number((v.value_number / 60).toFixed(2))}`; if (s.durationFormat === 'hours') return `${Number((v.value_number / 3600).toFixed(2))}`; if (s.durationFormat === 'days') return `${Number((v.value_number / 86400).toFixed(2))}`; return formatSecondsToDuration(v.value_number) || '-' }
  if (m.data_type === 'text' || m.data_type === 'datetime' || m.data_type === 'file') return v.value_text || '-'
  if (m.data_type === 'selection') { if (!v.value_text) return '-'; if (s.selectionMode === 'multi') { try { const p = JSON.parse(v.value_text); if (Array.isArray(p) && p.length > 0) return p.join(', ') } catch { } } return v.value_text }
  if (v.value_number === null || v.value_number === undefined) return '-'
  if (m.data_type === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: s.currencyCode || 'USD', maximumFractionDigits: 2 }).format(v.value_number)
  if (m.data_type === 'percent') return `${v.value_number}%`; return String(v.value_number)
}
export function RecentLogsTable({ departmentId, logs, keyMetrics, canDelete, currentPage, pageSize, totalCount }: { departmentId: string, logs: DailyLogRecentEntry[], keyMetrics: DailyLogKeyMetric[], canDelete: boolean, currentPage: number, pageSize: number, totalCount: number }) {
  const router = useRouter(); const searchParams = useSearchParams(); const [isDeleting, startDeleteTransition] = useTransition(); const [logToDelete, setLogToDelete] = useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize)); const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1; const endItem = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount)
  function updateTableParams(u: Record<string, string | null>) {
    const p = new URLSearchParams((searchParams as any)?.toString() ?? ""); for (const [k, v] of Object.entries(u)) { if (!v) p.delete(k); else p.set(k, v) }
    router.push(`/daily-log?${p.toString()}`)
  }
  if (logs.length === 0) return (<div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{totalCount > 0 ? 'No logs found for this page.' : 'No recent logs for this filter.'}</p>
    <div className="flex items-center gap-2"><label htmlFor="rps" className="text-sm text-muted-foreground">Logs</label><select id="rps" value={String(pageSize)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" onChange={(e) => updateTableParams({ logsPerPage: e.currentTarget.value, logsPage: '1' })}>{[10, 30, 50].map((o) => (<option key={o} value={o}>{o}</option>))}</select></div></div>
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{totalCount > 0 ? 'Try going back.' : 'No recent logs.'}</div></div>)
  return (
    <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Showing {startItem}-{endItem} of {totalCount} logs</p></div>
      <div className="overflow-x-auto rounded-lg border bg-card"><table className="min-w-[940px] w-full text-sm"><thead className="border-b bg-muted/30"><tr><th className="px-3 py-2 text-left font-medium">Date</th><th className="px-3 py-2 text-left font-medium">Agent</th>{keyMetrics.map((m) => (<th key={m.id} className="px-3 py-2 text-left font-medium">{m.name}</th>))}<th className="px-3 py-2 text-left font-medium">Notes</th><th className="px-3 py-2 text-left font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Actions</th></tr></thead>
        <tbody>{logs.map((log) => (<tr key={log.id} className="border-b last:border-b-0"><td className="px-3 py-2">{formatDateShort(log.report_date)}</td><td className="px-3 py-2">{log.user_name}</td>{keyMetrics.map((m) => (<td key={m.id} className="px-3 py-2">{metricValue(log.key_metric_values, m)}</td>))}<td className="px-3 py-2 text-muted-foreground"><span className="block max-w-[280px] truncate">{log.notes?.trim() || '-'}</span></td><td className="px-3 py-2"><Badge variant="outline">{log.status}</Badge></td><td className="px-3 py-2"><div className="flex items-center justify-end gap-2"><Link href={`/daily-log?departmentId=${departmentId}&userId=${log.user_id}&date=${log.report_date}`} className="h-8 w-8 inline-flex items-center justify-center border rounded-md"><Pencil className="size-3.5" /></Link>{canDelete ? (<button type="button" onClick={() => setLogToDelete(log.id)} className="h-8 w-8 inline-flex items-center justify-center border rounded-md text-destructive"><Trash2 className="size-3.5" /></button>) : null}</div></td></tr>))}</tbody>
        <tfoot className="border-t bg-muted/20"><tr><td className="px-3 py-2 font-semibold">Avg</td><td className="px-3 py-2 text-muted-foreground">Visible logs</td>{keyMetrics.map((m) => (<td key={m.id} className="px-3 py-2 font-medium">{formatAverageValue(m, getMetricAverage(logs, m))}</td>))}<td colSpan={3}></td></tr></tfoot></table></div>
      {logToDelete && (<ConfirmDialog title="Delete Log Entry" description="Are you sure you want to delete this log entry? This action cannot be undone." confirmText="Delete" isLoading={isDeleting} onConfirm={() => { startDeleteTransition(async () => { const f = new FormData(); f.append('entryId', logToDelete); await deleteDailyLogAction(f); setLogToDelete(null) }) }} onCancel={() => setLogToDelete(null)} />)}
    </div>
  )
}
