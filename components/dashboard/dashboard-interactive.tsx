'use client'

import { type DashboardKpi } from '@/features/dashboard/queries'
import { formatDecimal, formatMetricNumber, formatPercent } from '@/lib/metrics/format'
import { getMetricIcon } from '@/lib/utils/metric-helpers'

type DashboardInteractiveProps = {
  kpis: DashboardKpi[]
  submittedLogs: number
  paceTotalUnits: number
  paceElapsedUnits: number
  paceUnitLabel: 'workday'
}

function formatKpiValue(kpi: DashboardKpi, value: number) {
  return formatMetricNumber(value, {
    dataType: kpi.data_type,
    unit: kpi.unit,
    booleanMode: 'count',
  })
}

function changeChipTone(value: number | null) {
  if (value === null) return 'border-slate-200 bg-slate-50 text-slate-600'
  if (value > 0) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value < 0) return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function projectedTone(value: number | null) {
  if (value === null) {
    return 'border-slate-200 bg-slate-50 text-slate-500'
  }
  if (value < 0) {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function compactCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value)
}

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value)
}

function formatCompactKpiValue(kpi: DashboardKpi, value: number) {
  if (kpi.data_type === 'currency') {
    const currencyCode = (kpi.unit || 'USD').toUpperCase()
    return compactCurrency(value, currencyCode)
  }

  if (kpi.data_type === 'percent') {
    return formatPercent(value, 1)
  }

  if (kpi.data_type === 'duration') {
    return formatMetricNumber(value, {
      dataType: kpi.data_type,
      unit: kpi.unit,
      booleanMode: 'count',
    })
  }

  return Math.abs(value) >= 1000 ? compactNumber(value) : formatDecimal(value, 1)
}

function calculateProjectedValue(currentValue: number, totalUnits: number, elapsedUnits: number) {
  if (totalUnits <= 0 || elapsedUnits <= 0) {
    return null
  }
  return currentValue * (totalUnits / elapsedUnits)
}

function calculateAverageValue(currentValue: number, submittedLogs: number) {
  if (submittedLogs <= 0) {
    return null
  }
  return currentValue / submittedLogs
}

export function DashboardInteractive({
  kpis,
  submittedLogs,
  paceTotalUnits,
  paceElapsedUnits,
  paceUnitLabel,
}: DashboardInteractiveProps) {
  return (
    <section className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {kpis.map((kpi) => {
          const projectedValue =
            kpi.data_type === 'percent'
              ? null
              : calculateProjectedValue(kpi.current_value, paceTotalUnits, paceElapsedUnits)
          const averageValue =
            kpi.data_type === 'percent'
              ? null
              : calculateAverageValue(kpi.current_value, submittedLogs)
          const projectedLabel =
            projectedValue === null
              ? '—'
              : `${projectedValue < 0 ? '↘' : '↗'} ${formatCompactKpiValue(kpi, projectedValue)}`
          const averageLabel = averageValue === null ? '—' : formatCompactKpiValue(kpi, averageValue)
          const percentPointDelta = kpi.current_value - kpi.previous_value
          const changeLabel =
            kpi.data_type === 'percent'
              ? (
                kpi.previous_value === 0 && kpi.current_value === 0
                  ? '0pp'
                  : kpi.previous_value === 0
                    ? 'new'
                    : `${percentPointDelta > 0 ? '+' : ''}${formatDecimal(percentPointDelta, 1)}pp`
              )
              : (
                kpi.change_pct === null
                  ? 'new'
                  : `${kpi.change_pct > 0 ? '+' : ''}${formatPercent(kpi.change_pct, 1)}`
              )
          const changeToneValue =
            kpi.data_type === 'percent'
              ? (kpi.previous_value === 0 && kpi.current_value !== 0 ? null : percentPointDelta)
              : kpi.change_pct

          return (
            <div
              key={kpi.metric_id}
              className="min-w-[210px] shrink-0 rounded-lg border bg-card p-3 text-left transition-colors"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-lg" aria-hidden="true">
                  {getMetricIcon(kpi.code)}
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${projectedTone(projectedValue)}`}
                  title={`Projected total at current pace. Projection = Actual × (${paceTotalUnits} ${paceUnitLabel}${paceTotalUnits === 1 ? '' : 's'} total / ${paceElapsedUnits} elapsed).`}
                >
                  {projectedLabel}
                </span>
              </div>

              <p className="text-xl font-bold tracking-tight">{formatKpiValue(kpi, kpi.current_value)}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{kpi.name}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
