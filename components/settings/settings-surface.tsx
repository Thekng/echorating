import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SettingsSurfaceProps = {
  children: ReactNode
  className?: string
}

export function SettingsSurface({ children, className }: SettingsSurfaceProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      {children}
    </div>
  )
}
