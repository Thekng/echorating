import type { ReactNode } from 'react'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { SettingsShell } from '@/components/settings/settings-shell'

export default function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SettingsShell>
      <SettingsTabs />
      {children}
    </SettingsShell>
  )
}
