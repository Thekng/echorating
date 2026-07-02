import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TrendBadge } from '@/components/shared/trend-badge'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  change?: number | null
  icon?: React.ReactNode
  unit?: string
  target?: number | null
  progress?: number | null
  className?: string
}

export function StatCard({
  title,
  value,
  change,
  icon,
  unit,
  target,
  progress,
  className,
}: StatCardProps) {
  const showProgress = progress !== null && progress !== undefined

  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
              {title}
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {unit && (
                <span className="text-xs text-muted-foreground">{unit}</span>
              )}
            </div>
            {change !== null && change !== undefined && (
              <div className="mt-2">
                <TrendBadge changePct={change} />
              </div>
            )}
            {target !== null && target !== undefined && (
              <p className="mt-1 text-xs text-muted-foreground">
                Target: {target}
              </p>
            )}
          </div>
          {icon && (
            <div className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
        {showProgress && (
          <div className="mt-3">
            <Progress value={Math.min(100, Math.max(0, progress))} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
