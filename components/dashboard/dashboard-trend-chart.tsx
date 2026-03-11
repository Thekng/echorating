'use client'

import { useState, useMemo } from 'react'
import type { DashboardTrendPoint } from '@/features/dashboard/queries'

type DashboardTrendChartProps = {
  points: DashboardTrendPoint[]
  metricLabel: string
  onSelectDate?: (date: string) => void
}

function polylinePoints(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return ''
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

function dotPositions(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return []
  const maxValue = Math.max(...values, 1)
  const minValue = 0
  const span = maxValue - minValue || 1
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0

  return values.map((value, index) => ({
    x: padding + index * stepX,
    y: height - padding - ((value - minValue) / span) * (height - padding * 2),
    value,
  }))
}

const RANGE_OPTIONS = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 0, label: 'All' },
]

export function DashboardTrendChart({ points, metricLabel, onSelectDate }: DashboardTrendChartProps) {
  const [visibleDays, setVisibleDays] = useState(0) // 0 = show all
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const visiblePoints = useMemo(() => {
    if (visibleDays === 0 || points.length <= visibleDays) return points
    return points.slice(-visibleDays)
  }, [points, visibleDays])

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No data for this period.
      </div>
    )
  }

  const width = 960
  const height = 260
  const padding = 28

  const metricValues = visiblePoints.map((p) => p.primary_metric_value)
  const logValues = visiblePoints.map((p) => p.submitted_logs)
  const metricLine = polylinePoints(metricValues, width, height, padding)
  const logLine = polylinePoints(logValues, width, height, padding)
  const metricDots = dotPositions(metricValues, width, height, padding)
  const maxMetric = Math.max(...metricValues, 0)
  const maxLogs = Math.max(...logValues, 0)

  const stepX = visiblePoints.length > 1 ? (width - padding * 2) / (visiblePoints.length - 1) : 0

  function handleDotClick(index: number) {
    setSelectedIndex(index)
    const point = visiblePoints[index]
    if (point && onSelectDate) {
      onSelectDate(point.date)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Daily {metricLabel}</h3>
        </div>

        <div className="flex items-center gap-4">


          <div className="flex rounded-lg border bg-muted/30 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setVisibleDays(opt.value)
                  setSelectedIndex(null)
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  visibleDays === opt.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 min-w-[480px] w-full">
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
                strokeOpacity="0.08"
                strokeDasharray="4 4"
              />
            )
          })}

          <polyline
            fill="none"
            stroke="rgb(37 99 235)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={metricLine}
          />

          <polyline
            fill="none"
            stroke="rgb(5 150 105)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 4"
            points={logLine}
          />

          {/* Clickable hit areas and visible dots */}
          {metricDots.map((dot, index) => (
            <g key={index} onClick={() => handleDotClick(index)} className="cursor-pointer">
              {/* Invisible hit area */}
              <rect
                x={dot.x - stepX / 2}
                y={0}
                width={Math.max(stepX, 20)}
                height={height}
                fill="transparent"
              />
              {/* Selected day highlight */}
              {selectedIndex === index ? (
                <line
                  x1={dot.x}
                  x2={dot.x}
                  y1={padding}
                  y2={height - padding}
                  stroke="rgb(37 99 235)"
                  strokeOpacity="0.15"
                  strokeWidth="2"
                />
              ) : null}
              {/* Dot */}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={selectedIndex === index ? 5 : 3}
                fill={selectedIndex === index ? 'rgb(37 99 235)' : 'rgb(37 99 235)'}
                fillOpacity={selectedIndex === index ? 1 : 0.6}
                stroke="white"
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {visiblePoints.map((point, index) => {
          const showLabel =
            visiblePoints.length <= 14 ||
            index === 0 ||
            index === visiblePoints.length - 1 ||
            index % Math.ceil(visiblePoints.length / 10) === 0

          return (
            <button
              key={point.date}
              type="button"
              onClick={() => handleDotClick(index)}
              className={`min-w-0 truncate px-0.5 transition-colors hover:text-foreground ${
                selectedIndex === index ? 'font-semibold text-foreground' : ''
              }`}
            >
              {showLabel ? point.label : ''}
            </button>
          )
        })}
      </div>

      {selectedIndex !== null && visiblePoints[selectedIndex] ? (
        <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{visiblePoints[selectedIndex].label}</span>
          {' · '}
          {metricLabel}: <span className="font-semibold text-foreground">{Number(visiblePoints[selectedIndex].primary_metric_value.toFixed(2))}</span>
          {' · '}
          Logs: <span className="font-semibold text-foreground">{visiblePoints[selectedIndex].submitted_logs}</span>
        </div>
      ) : null}
    </section>
  )
}
