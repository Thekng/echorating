import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SettingsSurfaceProps = {
  children: ReactNode
  className?: string
}

export function SettingsSurface({ children, className }: SettingsSurfaceProps) {
  return <section className={cn('rounded-lg border bg-card p-4 md:p-5', className)}>{children}</section>
}
