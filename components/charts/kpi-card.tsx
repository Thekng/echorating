import React from 'react'
import { TrendBadge } from '@/components/shared/trend-badge'

interface KPICardProps {
  title: string
  value: string | number
  change?: number | null
  icon?: React.ReactNode
  unit?: string
}

export function KPICard({ title, value, change, icon, unit }: KPICardProps) {
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
            <div className="mt-2">
              <TrendBadge changePct={change} />
            </div>
          )}
        </div>
        {icon && <div className="ml-3 text-2xl opacity-60">{icon}</div>}
      </div>
    </div>
  )
}
