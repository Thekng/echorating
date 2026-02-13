import type { ReactNode } from 'react'

type SettingsRowProps = {
  title: string
  subtitle?: string
  meta?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

export function SettingsRow({ title, subtitle, meta, actions, children }: SettingsRowProps) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
