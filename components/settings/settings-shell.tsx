import type { ReactNode } from 'react'

type SettingsShellProps = {
  children: ReactNode
}

export function SettingsShell({ children }: SettingsShellProps) {
  return <div className="space-y-6">{children}</div>
}
