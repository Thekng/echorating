'use client'

import { CalendarDays } from 'lucide-react'
import { useId, useState, type MouseEvent } from 'react'

type DataPoint = {
  date: string
  value: number
}

type MinimalistTrendChartProps = {
  data: DataPoint[]
  title: string
  periodLabel?: string
  height?: number
  valueFormatter?: (value: number) => string
}

const CHART_WIDTH = 1000

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return ''
  }
  if (points.length === 1) {
    return `M ${points[0]!.x} ${points[0]!.y}`
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }

  return path
}

function formatDateLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return dateStr
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function MinimalistTrendChart({
  data,
  title,
  periodLabel,
  height = 240,
  valueFormatter,
}: MinimalistTrendChartProps) {
  const gradientId = useId()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No data available
      </div>
    )
  }

  const formatValue = valueFormatter ?? ((value: number) => Number(value.toFixed(2)).toString())
  const values = data.map((point) => Number(point.value) || 0)
  const maxRaw = Math.max(...values, 0)
  const maxAxis = Math.max(4, Math.ceil(maxRaw / 4) * 4)
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)

  const padding = {
    top: 18,
    right: 34,
    bottom: 44,
    left: 46,
  }

  const chartHeight = Math.max(220, height)
  const plotWidth = CHART_WIDTH - padding.left - padding.right
  const plotHeight = chartHeight - padding.top - padding.bottom
  const baselineY = padding.top + plotHeight
  const stepX = values.length > 1 ? plotWidth / (values.length - 1) : 0

  const points = values.map((value, index) => {
    const x = values.length > 1 ? padding.left + index * stepX : padding.left + plotWidth / 2
    const y = padding.top + (1 - value / maxAxis) * plotHeight
    return { x, y, value, date: data[index]!.date }
  })

  const linePath = buildSmoothPath(points.map((point) => ({ x: point.x, y: point.y })))
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1]!.x} ${baselineY} L ${points[0]!.x} ${baselineY} Z`
      : ''

  const activeIndex = hoveredIndex ?? points.length - 1
  const activePoint = points[activeIndex] ?? points[points.length - 1]!
  const avgY = padding.top + (1 - average / maxAxis) * plotHeight

  const tickValues = [0, 1, 2, 3, 4].map((slot) => Number(((maxAxis / 4) * slot).toFixed(2)))
  const tickY = (value: number) => padding.top + (1 - value / maxAxis) * plotHeight

  const xLabelIndexes = (() => {
    if (points.length <= 8) {
      return points.map((_, index) => index)
    }

    const step = Math.ceil(points.length / 7)
    const indexes = new Set<number>([0, points.length - 1])
    for (let i = step; i < points.length - 1; i += step) {
      indexes.add(i)
    }
    return Array.from(indexes).sort((a, b) => a - b)
  })()

  const handlePointerMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
    const ratio = relativeX / Math.max(1, rect.width)
    const index = Math.round(ratio * (points.length - 1))
    setHoveredIndex(Math.min(Math.max(index, 0), points.length - 1))
  }

  const colorPrimary = 'hsl(var(--primary))'
  const colorPrimarySoft = 'hsl(var(--primary) / 0.2)'
  const colorBorder = 'hsl(var(--border))'
  const colorMuted = 'hsl(var(--muted-foreground))'
  const colorCard = 'hsl(var(--card))'
  const colorCardForeground = 'hsl(var(--card-foreground))'
  const colorAvg = 'hsl(142 71% 45%)'

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-4 text-card-foreground md:p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{periodLabel || `Last ${data.length} days`}</p>
      </header>

      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          className="w-full cursor-crosshair"
          style={{ height: `${chartHeight}px` }}
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colorPrimarySoft} stopOpacity="1" />
              <stop offset="100%" stopColor={colorPrimarySoft} stopOpacity="0" />
            </linearGradient>
          </defs>

          {tickValues.map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={CHART_WIDTH - padding.right}
                y1={tickY(tick)}
                y2={tickY(tick)}
                stroke={colorBorder}
                strokeOpacity="0.8"
                strokeDasharray="10 10"
              />
              <text x={padding.left - 10} y={tickY(tick) + 4} fill={colorMuted} textAnchor="end" fontSize="12">
                {tick % 1 === 0 ? String(tick) : tick.toFixed(1)}
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            x2={CHART_WIDTH - padding.right}
            y1={avgY}
            y2={avgY}
            stroke={colorAvg}
            strokeDasharray="8 8"
            strokeOpacity="0.7"
          />
          <text x={CHART_WIDTH - padding.right + 8} y={avgY + 4} fill={colorAvg} fontSize="12" fontWeight="600">
            Avg
          </text>

          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={colorPrimary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={baselineY}
            stroke={colorMuted}
            strokeOpacity="0.45"
          />
          <circle cx={activePoint.x} cy={activePoint.y} r="7.5" fill={colorPrimary} fillOpacity="0.2" />
          <circle cx={activePoint.x} cy={activePoint.y} r="5.5" fill={colorCard} stroke={colorPrimary} strokeWidth="2" />
        </svg>

        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
          style={{
            left: `${(activePoint.x / CHART_WIDTH) * 100}%`,
            top: `${((activePoint.y + 20) / chartHeight) * 100}%`,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: colorCardForeground }}>
            {formatDateLabel(activePoint.date)}
          </p>
          <p className="text-sm text-muted-foreground">{formatValue(activePoint.value)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
        {xLabelIndexes.map((index) => (
          <span key={data[index]!.date}>{formatDateLabel(data[index]!.date)}</span>
        ))}
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground/80">Click the line to filter by date</p>
    </section>
  )
}
