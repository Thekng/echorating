'use client'

import { useEffect, useMemo, useState } from 'react'
import { MinimalistTrendChart } from '@/components/charts/minimalist-trend-chart'
import { type DashboardKpi, type DashboardMetricTrend } from '@/features/dashboard/queries'
import { formatSecondsToDuration } from '@/lib/daily-log/value-parser'
import { getMetricIcon } from '@/lib/utils/metric-helpers'
import { cn } from '@/lib/utils'

type DashboardInteractiveProps = {
  kpis: DashboardKpi[]
  metricTrends: DashboardMetricTrend[]
  primaryMetricId?: string | null
  period: 'today' | 'current_week' | 'this_month' | 'custom'
  windowDays: number
}

function formatKpiValue(kpi: DashboardKpi, value: number) {
  if (kpi.data_type === 'duration') {
    return formatSecondsToDuration(value) || '00:00:00'
  }

  if (kpi.data_type === 'currency') {
    const currencyCode = (kpi.unit || 'USD').toUpperCase()
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (kpi.data_type === 'percent') {
    return `${Number(value.toFixed(2))}%`
  }

  if (kpi.data_type === 'boolean') {
    return String(Math.round(value))
  }

  // For regular numbers, check if it's a count metric by analyzing the code and name
  // Count metrics are those that represent quantities (households, conversations, calls, etc.)
  const codeAndNameLower = `${kpi.code} ${kpi.name}`.toLowerCase()
  const countPatterns = /household|conversation|call|item|policy|follow.?up|lead|deal|visit|task|activity|contact/i
  
  if (countPatterns.test(codeAndNameLower)) {
    return String(Math.round(value))
  }

  return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString()
}

function changeTone(value: number | null) {
  if (value === null) return 'text-muted-foreground'
  if (value > 0) return 'text-emerald-700'
  if (value < 0) return 'text-rose-700'
  return 'text-slate-700'
}

function changeChipTone(value: number | null) {
  if (value === null) return 'border-slate-200 bg-slate-50 text-slate-600'
  if (value > 0) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value < 0) return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function DashboardInteractive({
  kpis,
  metricTrends,
  primaryMetricId,
  period,
  windowDays,
}: DashboardInteractiveProps) {
  const defaultMetricId = useMemo(() => {
    if (primaryMetricId && kpis.some((kpi) => kpi.metric_id === primaryMetricId)) {
      return primaryMetricId
    }
    return kpis[0]?.metric_id ?? ''
  }, [kpis, primaryMetricId])

  const [selectedMetricId, setSelectedMetricId] = useState(defaultMetricId)

  useEffect(() => {
    setSelectedMetricId(defaultMetricId)
  }, [defaultMetricId])

  const selectedKpi = kpis.find((kpi) => kpi.metric_id === selectedMetricId) ?? kpis[0] ?? null
  const selectedTrend = metricTrends.find((series) => series.metric_id === selectedMetricId)?.points ?? []
  /* Time estimates removed: no projection label */
  const periodTitle =
    period === 'today'
      ? 'Today'
      : period === 'current_week'
        ? 'Current week'
        : period === 'this_month'
          ? 'This month'
          : `Custom (${windowDays} days)`

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Click a KPI to change the graph</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {kpis.map((kpi) => (
            <button
              key={kpi.metric_id}
              type="button"
              onClick={() => setSelectedMetricId(kpi.metric_id)}
              className={cn(
                'min-w-[180px] shrink-0 rounded-lg border bg-card p-3 text-left transition-colors',
                selectedMetricId === kpi.metric_id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'hover:bg-muted/40',
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-lg" aria-hidden="true">
                  {getMetricIcon(kpi.code)}
                </span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${changeChipTone(kpi.change_pct)}`}>
                  {kpi.change_pct === null
                    ? 'new'
                    : `${kpi.change_pct > 0 ? '+' : ''}${kpi.change_pct.toFixed(1)}%`}
                </span>
              </div>

              <p className="text-xl font-bold tracking-tight">{formatKpiValue(kpi, kpi.current_value)}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{kpi.name}</p>
              {/* projection removed */}
            </button>
          ))}
        </div>
      </section>

      {selectedKpi ? (
        <section>
          <MinimalistTrendChart
            data={selectedTrend.map((point) => ({
              date: point.date,
              value: point.value,
            }))}
            title={selectedKpi.name}
            periodLabel={periodTitle}
            valueFormatter={(value) => formatKpiValue(selectedKpi, value)}
            height={210}
          />
        </section>
      ) : null}
    </>
  )
}
