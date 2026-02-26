import type { ReactNode } from 'react'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { SettingsLayout } from '@/components/settings/settings-layout'

type SettingsRootLayoutProps = {
  children: ReactNode
}

export default function SettingsRootLayout({ children }: SettingsRootLayoutProps) {
  return (
    <div className="space-y-6">
      <SettingsTabs />
      <SettingsLayout>{children}</SettingsLayout>
    </div>
  )
}
