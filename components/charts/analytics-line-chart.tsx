'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type TooltipRenderProps = {
  active?: boolean
  payload?: ReadonlyArray<unknown>
  label?: string | number
}
import type { DashboardSeries } from '@/features/dashboard/queries'
import { formatMetricNumber } from '@/lib/metrics/format'
import { buildChartRows, buildScales, pickPointForDate } from '@/lib/charts/normalize'
import { buildMetricColorMap } from '@/lib/charts/colors'

type AnalyticsLineChartProps = {
  series: DashboardSeries[]
  startDate: string
  endDate: string
  title?: string
  subtitle?: string
}

function formatAxisDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatTooltipDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatValueForMetric(metric: DashboardSeries, value: number) {
  return formatMetricNumber(value, { dataType: metric.data_type, unit: metric.unit })
}

function formatDelta(metric: DashboardSeries, current: number, previous: number) {
  const delta = current - previous
  if (delta === 0) return null
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${formatMetricNumber(Math.abs(delta), { dataType: metric.data_type, unit: metric.unit })}`
}

function emptyState(message: string) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed bg-card/40 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function AnalyticsLineChart({
  series,
  startDate,
  endDate,
  title = 'Trend',
  subtitle,
}: AnalyticsLineChartProps) {
  const [hiddenMetricIds, setHiddenMetricIds] = useState<Set<string>>(() => {
    const hidden = new Set<string>()
    for (const item of series) {
      if (!item.default_visible) hidden.add(item.metric_id)
    }
    return hidden
  })

  const colorMap = useMemo(
    () => buildMetricColorMap(series.map((item) => item.metric_id)),
    [series],
  )

  const visibleSeries = useMemo(
    () => series.filter((item) => !hiddenMetricIds.has(item.metric_id)),
    [series, hiddenMetricIds],
  )

  const visibleIds = useMemo(
    () => new Set(visibleSeries.map((item) => item.metric_id)),
    [visibleSeries],
  )

  const mode: 'overview' | 'focus' = visibleSeries.length === 1 ? 'focus' : 'overview'
  const rows = useMemo(
    () => buildChartRows(series, visibleIds, mode),
    [series, visibleIds, mode],
  )

  const scales = useMemo(() => buildScales(series), [series])

  function toggleMetric(metricId: string) {
    setHiddenMetricIds((prev) => {
      const next = new Set(prev)
      if (next.has(metricId)) {
        next.delete(metricId)
      } else {
        next.add(metricId)
      }
      return next
    })
  }

  if (series.length === 0) {
    return emptyState('No metrics configured for this team yet.')
  }

  const hasAnyData = series.some((item) =>
    item.points.some((point) => point.value !== null && point.value !== 0),
  )

  if (!hasAnyData) {
    return emptyState('No metric activity in this period.')
  }

  const focusMetric = mode === 'focus' ? visibleSeries[0] : null

  function renderTooltip(props: TooltipRenderProps) {
    const { active, payload, label } = props
    if (!active || !payload || payload.length === 0 || typeof label !== 'string') {
      return null
    }

    const dateKey = label
    const rows = visibleSeries.map((metric) => {
      const point = pickPointForDate(metric, dateKey)
      const current = point?.value ?? null
      const previous = point?.previous_value ?? null
      const color = colorMap.get(metric.metric_id) ?? '#888'
      return { metric, current, previous, color }
    })

    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">{formatTooltipDate(dateKey)}</div>
        <div className="space-y-1">
          {rows.map(({ metric, current, previous, color }) => {
            const valueLabel = current === null ? '—' : formatValueForMetric(metric, current)
            const deltaLabel = current !== null && previous !== null
              ? formatDelta(metric, current, previous)
              : null
            return (
              <div key={metric.metric_id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <svg width="8" height="8" aria-hidden="true">
                    <circle cx="4" cy="4" r="4" fill={color} />
                  </svg>
                  <span className="text-foreground">{metric.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="font-medium text-foreground">{valueLabel}</span>
                  {deltaLabel ? (
                    <span className="text-[10px] text-muted-foreground">{deltaLabel}</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5" aria-label={title}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold leading-none">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {subtitle ?? `${formatAxisDate(startDate)} – ${formatAxisDate(endDate)}`}
            {mode === 'overview' ? ' · normalized 0–100 (raw values in tooltip)' : null}
          </p>
        </div>
      </header>

      <div className="h-[260px] w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tickLine={false}
              axisLine={{ stroke: 'currentColor', strokeOpacity: 0.15 }}
              tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.65 }}
              minTickGap={24}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.65 }}
              tickFormatter={(value) => {
                if (mode === 'focus' && focusMetric) {
                  return formatValueForMetric(focusMetric, Number(value))
                }
                return `${value}`
              }}
              domain={mode === 'overview' ? [0, 100] : ['auto', 'auto']}
              allowDecimals={false}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }} />
            {visibleSeries.map((metric) => {
              const color = colorMap.get(metric.metric_id) ?? '#666'
              const max = scales.get(metric.metric_id) ?? 0
              const isInactive = max <= 0
              return (
                <Line
                  key={metric.metric_id}
                  type="monotone"
                  dataKey={metric.metric_id}
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={isInactive ? 0.3 : 1}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                  name={metric.name}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {series.map((metric) => {
          const color = colorMap.get(metric.metric_id) ?? '#888'
          const hidden = hiddenMetricIds.has(metric.metric_id)
          return (
            <li key={metric.metric_id}>
              <button
                type="button"
                onClick={() => toggleMetric(metric.metric_id)}
                aria-pressed={hidden ? 'false' : 'true'}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  hidden
                    ? 'border-transparent text-muted-foreground/70 hover:text-foreground'
                    : 'border-border bg-muted/30 text-foreground hover:bg-muted/50'
                }`}
              >
                <svg width="8" height="8" aria-hidden="true">
                  <circle cx="4" cy="4" r="4" fill={color} fillOpacity={hidden ? 0.35 : 1} />
                </svg>
                {metric.name}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
