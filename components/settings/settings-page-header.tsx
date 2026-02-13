import type { ReactNode } from 'react'

type SettingsPageHeaderProps = {
  title: string
  description: string
  actions?: ReactNode
}

export function SettingsPageHeader({ title, description, actions }: SettingsPageHeaderProps) {
  return (
    <div className="sticky top-16 z-10 rounded-lg border bg-background/95 p-4 backdrop-blur md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
