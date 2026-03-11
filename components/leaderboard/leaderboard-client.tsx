'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Trophy, CalendarDays } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'
import { formatMetricNumber } from '@/lib/metrics/format'
import { formatDateShort } from '@/lib/utils/date-formatter'

type Department = {
  department_id: string
  name: string
}

type Metric = {
  metric_id: string
  name: string
  code: string
  data_type: string
  unit: string
}

type RankingRow = {
  user_id: string
  name: string
  values: Record<string, number>
  filled_count: number
  total_count: number
}

type LeaderboardApiPayload = {
  departments: Department[]
  departmentId: string
  period: 'today' | 'current_week' | 'this_month' | 'last_week' | 'last_month' | 'custom'
  startDate: string
  endDate: string
  metrics: Metric[]
  sortOptions: Metric[]
  selectedMetricId: string
  leaderboard: RankingRow[]
  message?: string
}

type Period = 'today' | 'current_week' | 'this_month' | 'last_week' | 'last_month' | 'custom'
const EMPTY_DEPARTMENTS: Department[] = []
const EMPTY_METRICS: Metric[] = []
const EMPTY_ROWS: RankingRow[] = []

function getPeriodLabel(period: Period, start?: string, end?: string): string {
  if (period === 'today') return 'Today'
  if (period === 'current_week') return 'This week'
  if (period === 'this_month') return 'This month'
  if (period === 'last_week') return 'Last week'
  if (period === 'last_month') return 'Last month'
  if (period === 'custom' && start && end) {
    return formatDateShort(start) === formatDateShort(end)
      ? formatDateShort(start)
      : `${formatDateShort(start)} - ${formatDateShort(end)}`
  }
  return period
}

export default function LeaderboardClient() {
  const router = useRouter()

  const [departmentId, setDepartmentId] = useState('')
  const [metricId, setMetricId] = useState('')
  const [period, setPeriod] = useState<Period>('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const canFetchCustom = period !== 'custom' || (customStart && customEnd)

  const fetcher = async (url: string) => {
    const res = await fetch(url)
    const body = await res.json()
    if (!body.success) {
      throw new Error(body.error || 'Failed to load leaderboard.')
    }
    return body.data as LeaderboardApiPayload
  }

  const urlKey = useMemo(() => {
    if (!canFetchCustom) return null
    if (typeof window === 'undefined') return null

    const url = new URL('/api/leaderboard', window.location.origin)
    if (departmentId) url.searchParams.set('departmentId', departmentId)
    if (metricId) url.searchParams.set('metricId', metricId)
    url.searchParams.set('period', period)
    if (period === 'custom') {
      url.searchParams.set('startDate', customStart)
      url.searchParams.set('endDate', customEnd)
    }
    return url.toString()
  }, [canFetchCustom, customEnd, customStart, departmentId, metricId, period])

  const { data, error: swrError, isValidating } = useSWR<LeaderboardApiPayload>(urlKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: true,
  })

  const loading = !data && isValidating
  const error = swrError?.message || data?.message || null
  const departments = data?.departments ?? EMPTY_DEPARTMENTS
  const metrics = data?.metrics ?? EMPTY_METRICS
  const sortOptions = data?.sortOptions ?? EMPTY_METRICS
  const leaderboard = data?.leaderboard ?? EMPTY_ROWS
  const rangeStart = data?.startDate ?? ''
  const rangeEnd = data?.endDate ?? ''

  const activePeriodLabel = getPeriodLabel(period, rangeStart, rangeEnd)
  const selectedDepartmentId =
    (departmentId && departments.some((department) => department.department_id === departmentId)
      ? departmentId
      : null) ??
    (data?.departmentId && departments.some((department) => department.department_id === data.departmentId)
      ? data.departmentId
      : null) ??
    departments[0]?.department_id ??
    ''

  const selectedMetricId =
    (metricId && sortOptions.some((metric) => metric.metric_id === metricId)
      ? metricId
      : null) ??
    (data?.selectedMetricId && sortOptions.some((metric) => metric.metric_id === data.selectedMetricId)
      ? data.selectedMetricId
      : null) ??
    sortOptions[0]?.metric_id ??
    ''

  const formatValue = (metric: Metric, value: number) => {
    return formatMetricNumber(value, {
      dataType: metric.data_type,
      unit: metric.unit,
      booleanMode: 'count',
    })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label htmlFor="leaderboard-department" className="mb-1 block text-sm font-medium">
              Team
            </label>
            <select
              id="leaderboard-department"
              value={selectedDepartmentId}
              onChange={(event) => {
                setDepartmentId(event.currentTarget.value)
                setMetricId('')
              }}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {departments.length === 0 ? <option value="">No active teams found</option> : null}
              {departments.map((department) => (
                <option key={department.department_id} value={department.department_id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="leaderboard-period" className="mb-1 block text-sm font-medium">
              Time
            </label>
            <select
              id="leaderboard-period"
              value={period}
              onChange={(event) => setPeriod(event.currentTarget.value as Period)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="today">Today</option>
              <option value="current_week">Current week</option>
              <option value="this_month">This month</option>
              <option value="last_week">Last week</option>
              <option value="last_month">Last month</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label htmlFor="leaderboard-sort" className="mb-1 block text-sm font-medium">
              Sort by
            </label>
            <select
              id="leaderboard-sort"
              value={selectedMetricId}
              onChange={(event) => setMetricId(event.currentTarget.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {sortOptions.length === 0 ? <option value="">No metrics</option> : null}
              {sortOptions.map((option) => (
                <option key={option.metric_id} value={option.metric_id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          {period === 'custom' ? (
            <>
              <div>
                <label htmlFor="leaderboard-start" className="mb-1 block text-sm font-medium">
                  Start date
                </label>
                <input
                  id="leaderboard-start"
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.currentTarget.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="leaderboard-end" className="mb-1 block text-sm font-medium">
                  End date
                </label>
                <input
                  id="leaderboard-end"
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.currentTarget.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Team Metrics Table</p>
            <p className="text-xs text-muted-foreground">
              All active metrics for the selected team and period.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <span>{activePeriodLabel || 'Date range'}</span>
          </div>
        </header>

        {error ? (
          <div className="p-4 text-sm text-destructive">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2 text-left font-medium">Rank</th>
                  <th className="px-4 py-2 text-left font-medium">Team Member</th>
                  {metrics.map((metric) => (
                    <th key={metric.metric_id} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                      {metric.name}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-medium">Profile</th>
                </tr>
              </thead>
              <tbody>
                {!loading && leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={metrics.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                      No data for this period.
                    </td>
                  </tr>
                ) : null}

                {leaderboard.map((row, index) => (
                  <tr key={row.user_id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium">
                        {index === 0 ? <Trophy className="size-4 text-amber-500" /> : null}
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.name}</td>
                    {metrics.map((metric) => (
                      <td key={`${row.user_id}:${metric.metric_id}`} className="px-4 py-3 whitespace-nowrap">
                        {formatValue(metric, row.values[metric.metric_id] ?? 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/40"
                        onClick={() => router.push(`${ROUTES.ACCOUNTABILITY}/${row.user_id}`)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
