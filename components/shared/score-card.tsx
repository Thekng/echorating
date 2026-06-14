import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ScoreStatus = 'healthy' | 'watch' | 'at_risk' | 'no_data'

interface ScoreCardProps {
  title: string
  score: number | null
  maxScore?: number
  trend?: number | null
  trendLabel?: string
  subtitle?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

function getScoreStatus(score: number | null): ScoreStatus {
  if (score === null) return 'no_data'
  if (score >= 80) return 'healthy'
  if (score >= 60) return 'watch'
  return 'at_risk'
}

const STATUS_CONFIG: Record<ScoreStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  healthy: {
    label: 'Healthy',
    variant: 'default',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  watch: {
    label: 'Watch',
    variant: 'secondary',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  at_risk: {
    label: 'At Risk',
    variant: 'destructive',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  },
  no_data: {
    label: 'No Data',
    variant: 'outline',
    className: '',
  },
}

export function ScoreCard({
  title,
  score,
  maxScore = 100,
  trend,
  trendLabel,
  subtitle,
  className,
  size = 'md',
}: ScoreCardProps) {
  const status = getScoreStatus(score)
  const config = STATUS_CONFIG[status]

  const scoreText = score !== null ? Math.round(score) : '--'
  const trendText =
    trend !== null && trend !== undefined
      ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}`
      : null

  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardContent className={cn('flex flex-col', size === 'lg' ? 'p-6' : size === 'sm' ? 'p-3' : 'p-5')}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <Badge variant="outline" className={cn('text-[10px] font-medium border', config.className)}>
            {config.label}
          </Badge>
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span
            className={cn(
              'font-bold tracking-tight',
              size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-3xl',
            )}
          >
            {scoreText}
          </span>
          <span className="text-sm text-muted-foreground">/ {maxScore}</span>
        </div>
        {trendText && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trendText} {trendLabel ?? 'vs previous'}
          </p>
        )}
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

export { getScoreStatus, STATUS_CONFIG }
export type { ScoreStatus }
