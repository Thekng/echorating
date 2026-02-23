'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Trophy, CalendarDays, Search } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'
import { formatSecondsToDuration } from '@/lib/daily-log/value-parser'
import { formatDateShort } from '@/lib/utils/date-formatter'

type Department = {
  department_id: string
  name: string
}

type RankingRow = {
  user_id: string
  name: string
  value: number
  met_count: number
  total_count: number
}

type SelectedMetric = {
  metric_id: string
  name: string
  code: string
  data_type: string
  unit: string
}

type LeaderboardApiPayload = {
  leaderboard: RankingRow[]
  departments: Department[]
  departmentId: string
  metricId: string
  sortOptions: SelectedMetric[]
  selectedMetric: SelectedMetric
  period: 'today' | 'current_week' | 'this_month' | 'custom'
  startDate: string
  endDate: string
  scoringMetricsCount: number
  message?: string
}

type Period = 'today' | 'current_week' | 'this_month' | 'custom'

function getPeriodLabel(period: Period, start?: string, end?: string): string {
  if (period === 'today') return 'Today'
  if (period === 'current_week') return 'This week'
  if (period === 'this_month') return 'This month'
  if (period === 'custom' && start && end) {
    return formatDateShort(start) === formatDateShort(end)
      ? formatDateShort(start)
      : `${formatDateShort(start)} - ${formatDateShort(end)}`
  }
  return period
}

export default function LeaderboardClient() {
  const router = useRouter()

  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [metricId, setMetricId] = useState('department_score')
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

  const leaderboard = data?.leaderboard ?? []
  const sortOptions = data?.sortOptions ?? []
  const selectedMetric = data?.selectedMetric ?? null
  const rangeStart = data?.startDate ?? ''
  const rangeEnd = data?.endDate ?? ''
  const scoringMetricsCount = data?.scoringMetricsCount ?? 0

  const activePeriodLabel = useMemo(() => {
    return getPeriodLabel(period, rangeStart, rangeEnd)
  }, [period, rangeStart, rangeEnd])

  useEffect(() => {
    if (data?.departments && departments.length === 0) {
      setDepartments(data.departments)
    }
  }, [data?.departments, departments.length])

  useEffect(() => {
    if (!departmentId && data?.departmentId) {
      setDepartmentId(data.departmentId)
    }
    if (data?.metricId && data.metricId !== metricId) {
      setMetricId(data.metricId)
    }
  }, [data?.departmentId, data?.metricId, departmentId, metricId])

  useEffect(() => {
    if (departments.length === 0) {
      return
    }

    const hasCurrentSelection = departments.some((department) => department.department_id === departmentId)
    if (!hasCurrentSelection) {
      setDepartmentId(departments[0].department_id)
    }
  }, [departmentId, departments])

  const formatValue = (value: number) => {
    if (!selectedMetric) {
      return String(value)
    }

    if (selectedMetric.code === 'department_score') {
      return `${value.toFixed(1)}%`
    }

    if (selectedMetric.data_type === 'duration') {
      return formatSecondsToDuration(value)
    }

    if (selectedMetric.data_type === 'boolean') {
      return value >= 0.5 ? 'Yes' : 'No'
    }

    if (selectedMetric.data_type === 'currency') {
      const currencyCode = (selectedMetric.unit || 'usd').toUpperCase()
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(value)
    }

    if (selectedMetric.data_type === 'percent') {
      return `${value}%`
    }

    return Number.isInteger(value) ? String(value) : value.toFixed(2)
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
              value={departmentId}
              onChange={(event) => setDepartmentId(event.currentTarget.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {departments.length === 0 ? <option value="">No teams found</option> : null}
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
              <option value="custom">Customize</option>
            </select>
          </div>

          <div>
            <label htmlFor="leaderboard-sort" className="mb-1 block text-sm font-medium">
              Sort by
            </label>
            <select
              id="leaderboard-sort"
              value={metricId}
              onChange={(event) => setMetricId(event.currentTarget.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {sortOptions.length === 0 ? <option value="department_score">By Team Score</option> : null}
              {sortOptions.map((option) => (
                <option key={option.metric_id} value={option.metric_id}>
                  {option.code === 'department_score' ? 'By Team Score' : `By ${option.name}`}
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
            <p className="text-sm font-semibold">Team Member Ranking</p>
            <p className="text-xs text-muted-foreground">
              {selectedMetric
                ? selectedMetric.code === 'department_score'
                  ? `Score by ${scoringMetricsCount} team stats`
                  : `Sorted by ${selectedMetric.name}`
                : 'Stat unavailable'}
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
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2 text-left font-medium">Rank</th>
                  <th className="px-4 py-2 text-left font-medium">Team Member</th>
                  <th className="px-4 py-2 text-left font-medium">
                    {selectedMetric?.code === 'department_score' ? 'Team Score' : selectedMetric?.name || 'Stat'}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Stats Filled</th>
                  <th className="px-4 py-2 text-right font-medium">Profile</th>
                </tr>
              </thead>
              <tbody>
                {!loading && leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No ranking data for this period.
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
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3 font-medium">{formatValue(row.value)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.met_count}/{row.total_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/40"
                        onClick={() => router.push(`${ROUTES.AGENTS}/${row.user_id}`)}
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
