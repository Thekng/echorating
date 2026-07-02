'use client'

import { useState, useEffect, useTransition } from 'react'
import { getAuditLogs, type AuditLogEntry } from '@/features/audit/queries'
import { Button } from '@/components/ui/button'

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'metric.created', label: 'Metric created' },
  { value: 'metric.updated', label: 'Metric updated' },
  { value: 'metric.deleted', label: 'Metric deleted' },
  { value: 'member.role_updated', label: 'Member role updated' },
  { value: 'member.deactivated', label: 'Member deactivated' },
  { value: 'member.reactivated', label: 'Member reactivated' },
  { value: 'member.created', label: 'Member created' },
  { value: 'member.invited', label: 'Member invited' },
  { value: 'daily_report.submitted', label: 'Log submitted' },
  { value: 'daily_report.saved', label: 'Log saved' },
  { value: 'daily_report.deleted', label: 'Log deleted' },
  { value: 'company.updated', label: 'Company updated' },
]

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'metric', label: 'Metric' },
  { value: 'member', label: 'Member' },
  { value: 'daily_report', label: 'Daily Report' },
  { value: 'company', label: 'Company' },
]

function formatDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAction(action: string) {
  return action.replace(/[_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined)
  if (entries.length === 0) return null
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ')
}

export function AuditLogTable() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const pageSize = 25
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function fetchLogs(currentPage: number) {
    startTransition(async () => {
      setError(null)
      const result = await getAuditLogs({
        page: currentPage,
        pageSize,
        action: action || undefined,
        entityType: entityType || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setEntries(result.entries)
      setTotalCount(result.totalCount)
    })
  }

  useEffect(() => {
    fetchLogs(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function handleApplyFilters() {
    setPage(1)
    fetchLogs(1)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label htmlFor="audit-action-filter" className="mb-1 block text-sm font-medium">
            Action
          </label>
          <select
            id="audit-action-filter"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-entity-filter" className="mb-1 block text-sm font-medium">
            Entity
          </label>
          <select
            id="audit-entity-filter"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-start-date" className="mb-1 block text-sm font-medium">
            From
          </label>
          <input
            id="audit-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="audit-end-date" className="mb-1 block text-sm font-medium">
              To
            </label>
            <input
              id="audit-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <Button type="button" onClick={handleApplyFilters} disabled={loading}>
            Filter
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  {loading ? 'Loading...' : 'No audit log entries found.'}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                  <td className="px-3 py-2">{entry.user_name ?? entry.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{formatAction(entry.action)}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">{entry.entity_type}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                    {formatMetadata(entry.metadata) ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
