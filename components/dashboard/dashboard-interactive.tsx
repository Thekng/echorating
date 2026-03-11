'use client'

import { type DashboardKpi } from '@/features/dashboard/queries'
import { formatMetricNumber } from '@/lib/metrics/format'
import { getMetricIcon } from '@/lib/utils/metric-helpers'
import { useRouter, useSearchParams } from 'next/navigation'

type DashboardInteractiveProps = {
  kpis: DashboardKpi[]
  submittedLogs: number
  paceTotalUnits: number
  paceElapsedUnits: number
  paceUnitLabel: 'workday'
  selectedMetricId?: string
}

function formatKpiValue(kpi: DashboardKpi, value: number) {
  return formatMetricNumber(value, {
    dataType: kpi.data_type,
    unit: kpi.unit,
    booleanMode: 'count',
  })
}

export function DashboardInteractive({
  kpis,
  selectedMetricId,
}: DashboardInteractiveProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleKpiClick = (metricId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('metricId', metricId)
    router.push(`/dashboard?${params.toString()}`)
  }

  const activeMetricId = selectedMetricId || kpis[0]?.metric_id

  return (
    <section className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {kpis.map((kpi) => (
          <button
            key={kpi.metric_id}
            type="button"
            onClick={() => handleKpiClick(kpi.metric_id)}
            className={`min-w-[180px] shrink-0 rounded-lg border p-3 text-left transition-all ${
              activeMetricId === kpi.metric_id
                ? 'border-primary ring-1 ring-primary bg-primary/5'
                : 'bg-card hover:bg-muted/50'
            }`}
          >
            <span className="mb-1 block text-lg" aria-hidden="true">
              {getMetricIcon(kpi.code)}
            </span>
            <p className="text-xl font-bold tracking-tight">{formatKpiValue(kpi, kpi.current_value)}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{kpi.name}</p>
          </button>
        ))}
      </div>
    </section>
  )
}

