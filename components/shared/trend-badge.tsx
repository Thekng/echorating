import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTrendDirection } from '@/lib/metrics/trend'

type TrendBadgeProps = {
  changePct: number | null
  className?: string
}

export function TrendBadge({ changePct, className }: TrendBadgeProps) {
  const direction = getTrendDirection(changePct)

  if (direction === 'none') {
    return null
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
        direction === 'down' && 'text-rose-600 dark:text-rose-400',
        direction === 'flat' && 'text-muted-foreground',
        className,
      )}
    >
      {direction === 'up' && <TrendingUp className="h-3 w-3" />}
      {direction === 'down' && <TrendingDown className="h-3 w-3" />}
      {direction === 'flat' && <Minus className="h-3 w-3" />}
      <span>
        {changePct !== null && changePct > 0 ? '+' : ''}
        {changePct !== null ? `${changePct.toFixed(1)}%` : ''}
      </span>
    </span>
  )
}
