import type { DashboardSeries, DashboardSeriesPoint } from '@/features/dashboard/queries'

export type ChartRow = {
  date: string
  label: string
} & Record<string, number | null | string>

export type SeriesScale = {
  metric_id: string
  max: number
}

export function buildScales(series: DashboardSeries[]): Map<string, number> {
  const scales = new Map<string, number>()

  for (const item of series) {
    let max = 0
    for (const point of item.points) {
      if (point.value !== null && Math.abs(point.value) > max) {
        max = Math.abs(point.value)
      }
      if (point.previous_value !== null && Math.abs(point.previous_value) > max) {
        max = Math.abs(point.previous_value)
      }
    }
    scales.set(item.metric_id, max)
  }

  return scales
}

export function normalizePoint(value: number | null, max: number): number | null {
  if (value === null) {
    return null
  }
  if (max <= 0) {
    return 0
  }
  return Number(((value / max) * 100).toFixed(2))
}

export function buildChartRows(
  series: DashboardSeries[],
  visibleMetricIds: Set<string>,
  mode: 'overview' | 'focus',
): ChartRow[] {
  if (series.length === 0) {
    return []
  }

  const dateAxis = series[0].points.map((point) => ({ date: point.date, label: point.label }))
  const scales = buildScales(series)
  const rows: ChartRow[] = dateAxis.map((tick) => ({ date: tick.date, label: tick.label }))

  for (const item of series) {
    if (!visibleMetricIds.has(item.metric_id)) {
      continue
    }

    const max = scales.get(item.metric_id) ?? 0
    item.points.forEach((point, index) => {
      const row = rows[index]
      if (!row) {
        return
      }
      row[item.metric_id] = mode === 'overview' ? normalizePoint(point.value, max) : point.value
    })
  }

  return rows
}

export function pickPointForDate(series: DashboardSeries, date: string): DashboardSeriesPoint | undefined {
  return series.points.find((point) => point.date === date)
}
