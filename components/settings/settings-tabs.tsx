import { ROUTES } from '@/lib/constants/routes'
import { SettingsSegmentedTabs } from '@/components/settings/settings-segmented-tabs'

const SETTINGS_TABS = [
  { href: ROUTES.SETTINGS_COMPANY, label: 'Company' },
  { href: ROUTES.SETTINGS_DEPARTMENTS, label: 'Departments' },
  { href: ROUTES.SETTINGS_MEMBERS, label: 'Members' },
  { href: ROUTES.SETTINGS_METRICS, label: 'Metrics' },
]

export function SettingsTabs() {
  return <SettingsSegmentedTabs items={SETTINGS_TABS} />
}
