import type { DashboardTrendPoint } from '@/features/dashboard/queries'

type DashboardTrendChartProps = {
  points: DashboardTrendPoint[]
  metricLabel: string
}

function polylinePoints(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) {
    return ''
  }

  const maxValue = Math.max(...values, 1)
  const minValue = 0
  const span = maxValue - minValue || 1
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0

  return values
    .map((value, index) => {
      const x = padding + index * stepX
      const y = height - padding - ((value - minValue) / span) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
}

export function DashboardTrendChart({ points, metricLabel }: DashboardTrendChartProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No trend data for this period.
      </div>
    )
  }

  const width = 960
  const height = 260
  const padding = 20

  const metricValues = points.map((point) => point.primary_metric_value)
  const logValues = points.map((point) => point.submitted_logs)
  const metricLine = polylinePoints(metricValues, width, height, padding)
  const logLine = polylinePoints(logValues, width, height, padding)
  const maxMetric = Math.max(...metricValues, 0)
  const maxLogs = Math.max(...logValues, 0)

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Trend</h3>
          <p className="text-xs text-muted-foreground">Daily {metricLabel} vs submitted logs</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
            {metricLabel} (max {Number(maxMetric.toFixed(2))})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
            Submitted logs (max {maxLogs})
          </span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 min-w-[760px] w-full">
          <rect x="0" y="0" width={width} height={height} fill="transparent" />

          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = height - padding - ratio * (height - padding * 2)
            return (
              <line
                key={ratio}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="4 4"
              />
            )
          })}

          <polyline
            fill="none"
            stroke="rgb(37 99 235)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={metricLine}
          />

          <polyline
            fill="none"
            stroke="rgb(5 150 105)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 4"
            points={logLine}
          />
        </svg>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground md:grid-cols-6 xl:grid-cols-10">
        {points.map((point) => (
          <div key={point.date} className="truncate">
            {point.label}
          </div>
        ))}
      </div>
    </section>
  )
}
