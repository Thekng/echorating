import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { AgentsFilters } from '@/components/agents/agents-filters'
import { getAgentProfile } from '@/features/agents/queries'
import { booleanLabels, normalizeMetricSettings } from '@/lib/metrics/data-types'
import { formatMetricNumber, formatPercent } from '@/lib/metrics/format'

type MetricDataTypeInput = Parameters<typeof normalizeMetricSettings>[0]

type Agent1To1PageProps = {
  params: Promise<{ departmentId: string; userId: string }>
  searchParams: Promise<{
    period?: 'today' | 'current_week' | 'this_week' | 'this_month' | 'custom'
    startDate?: string
    endDate?: string
  }>
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

function formatMetricValue(
  metric: {
    data_type: string
    unit: string
    settings: unknown
  },
  value: number,
) {
  return formatMetricNumber(value, {
    dataType: metric.data_type as MetricDataTypeInput,
    unit: metric.unit,
    settings: metric.settings,
    booleanMode: 'count',
  })
}

function formatLogMetricValue(
  log: {
    metric_values: Array<{
      metric_id: string
      value_numeric: number | null
      value_text: string | null
      value_bool: boolean | null
    }>
  },
  metric: {
    metric_id: string
    data_type: string
    unit: string
    settings: unknown
  },
) {
  const raw = log.metric_values.find((item) => item.metric_id === metric.metric_id)
  if (!raw) {
    return '-'
  }

  const settings = normalizeMetricSettings(metric.data_type as MetricDataTypeInput, metric.settings)
  if (metric.data_type === 'boolean') {
    if (raw.value_bool === null) {
      return '-'
    }
    const labels = booleanLabels(settings)
    return raw.value_bool ? labels.trueLabel : labels.falseLabel
  }

  if (metric.data_type === 'duration') {
    if (raw.value_numeric === null || raw.value_numeric === undefined) {
      return '-'
    }
    return formatMetricNumber(Number(raw.value_numeric), {
      dataType: metric.data_type as MetricDataTypeInput,
      unit: metric.unit,
      settings: metric.settings,
    })
  }

  if (metric.data_type === 'text' || metric.data_type === 'datetime' || metric.data_type === 'file') {
    return raw.value_text || '-'
  }

  if (metric.data_type === 'selection') {
    if (!raw.value_text) {
      return '-'
    }
    if (settings.selectionMode === 'multi') {
      try {
        const parsed = JSON.parse(raw.value_text) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.join(', ')
        }
      } catch {
        return raw.value_text
      }
    }
    return raw.value_text
  }

  if (raw.value_numeric === null || raw.value_numeric === undefined) {
    return '-'
  }

  return formatMetricValue(metric, Number(raw.value_numeric))
}

function kpiRingTone(index: number) {
  const tones = [
    'border-slate-300 text-slate-900',
    'border-emerald-400 text-emerald-700',
    'border-amber-400 text-amber-700',
    'border-rose-400 text-rose-700',
    'border-violet-400 text-violet-700',
    'border-cyan-400 text-cyan-700',
  ]

  return tones[index % tones.length]
}

export default async function Agent1To1Page({ params, searchParams }: Agent1To1PageProps) {
  const { departmentId, userId } = await params
  const query = await searchParams

  const result = await getAgentProfile(userId, {
    departmentId,
    period: query.period,
    startDate: query.startDate,
    endDate: query.endDate,
  })

  if (!result.success || !result.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{result.error}</div>
    )
  }

  const {
    profile,
    departments,
    selectedDepartmentId,
    period,
    startDate,
    endDate,
    stats,
    metric_kpis,
    department_metrics,
    calendar,
    recent_logs,
  } = result.data

  const firstWeekday = new Date(`${calendar.month_start}T00:00:00`).getDay()
  const leadingEmpty = Array.from({ length: firstWeekday }, (_, index) => `empty-${index}`)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={ROUTES.ACCOUNTABILITY} className="hover:underline">
              Performance
            </Link>{' '}
            / Profile
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{profile.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {profile.role} · {profile.is_active ? 'Active' : 'Inactive'}
          </p>
        </div>
      </div>

      <AgentsFilters
        basePath={`${ROUTES.ACCOUNTABILITY}/${departmentId}/agent/${profile.user_id}`}
        departments={departments}
        selectedDepartmentId={selectedDepartmentId}
        period={period}
        startDate={startDate}
        endDate={endDate}
        allowAllDepartment={false}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Team Rank</p>
          <p className="mt-2 text-2xl font-semibold">{stats.department_rank ? `#${stats.department_rank}` : '-'}</p>
          <p className="text-xs text-muted-foreground">Based on team score.</p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Team Score</p>
          <p className="mt-2 text-2xl font-semibold">{stats.department_score === null ? '-' : formatPercent(stats.department_score, 1)}</p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Submitted Logs</p>
          <p className="mt-2 text-2xl font-semibold">{stats.submitted_count}</p>
        </article>

        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Completion</p>
          <p className="mt-2 text-2xl font-semibold">{formatPercent(stats.completion_rate, 1)}</p>
        </article>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Key Stats</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {metric_kpis.map((metric, idx) => (
            <div key={metric.metric_id} className="rounded-md border p-3">
              <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${kpiRingTone(idx)} border-2`} />
              <p className="mt-2 text-sm font-medium">{metric.name}</p>
              <p className="text-2xl font-semibold">{formatMetricValue(metric, metric.current_value)}</p>
              <p className="text-xs text-muted-foreground">
                Target: {metric.target_value === null ? '-' : formatMetricValue(metric, metric.target_value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Daily Performance Calendar</p>
          <p className="text-xs text-muted-foreground">{calendar.month_label}</p>
        </header>
        <div className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="text-xs text-muted-foreground text-center">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</div>
            ))}
            {leadingEmpty.map((k) => (
              <div key={k} className="h-12 rounded-md bg-muted/10" />
            ))}
            {calendar.days.map((day) => (
              <div key={day.date} className={`h-12 rounded-md p-2 text-center ${day.status === 'on_track' ? 'bg-emerald-50' : day.status === 'off_track' ? 'bg-rose-50' : 'bg-muted/10'}`}>
                <div className="text-sm font-medium">{day.day}</div>
                <div className="text-xs text-muted-foreground">{day.met_targets_count}/{day.total_targets_count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Recent Logs</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Notes</th>
                {department_metrics.map((m) => (
                  <th key={m.metric_id} className="px-4 py-2 text-left font-medium">{m.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent_logs.length === 0 ? (
                <tr><td colSpan={3 + department_metrics.length} className="px-4 py-8 text-center text-muted-foreground">No logs found.</td></tr>
              ) : null}
              {recent_logs.map((log) => (
                <tr key={log.entry_id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{formatDate(log.entry_date)}</td>
                  <td className="px-4 py-3">{log.status}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{log.notes || '-'}</td>
                  {department_metrics.map((metric) => (
                    <td key={metric.metric_id} className="px-4 py-3">{formatLogMetricValue(log, metric)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
