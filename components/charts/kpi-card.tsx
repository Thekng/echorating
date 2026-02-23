import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  change?: number | null
  icon?: React.ReactNode
  unit?: string
}

export function KPICard({ title, value, change, icon, unit }: KPICardProps) {
  const isPositive = change !== null && change !== undefined && change > 0
  const isNegative = change !== null && change !== undefined && change < 0

  return (
    <div className="rounded-xl border bg-card p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
          {change !== null && change !== undefined && (
            <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-600'}`}>
              {isPositive && <TrendingUp className="h-3 w-3" />}
              {isNegative && <TrendingDown className="h-3 w-3" />}
              <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
            </div>
          )}
        </div>
        {icon && <div className="ml-3 text-2xl opacity-60">{icon}</div>}
      </div>
    </div>
  )
}
