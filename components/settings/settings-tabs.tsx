import { ROUTES } from '@/lib/constants/routes'
import { SettingsSegmentedTabs } from '@/components/settings/settings-segmented-tabs'
import { Building2, FolderKanban, Gauge, Users } from 'lucide-react'

const SETTINGS_TABS = [
  { href: ROUTES.SETTINGS_COMPANY, label: 'Company', icon: <Building2 className="size-4" aria-hidden /> },
  { href: ROUTES.SETTINGS_DEPARTMENTS, label: 'Departments', icon: <FolderKanban className="size-4" aria-hidden /> },
  { href: ROUTES.SETTINGS_METRICS, label: 'Metrics', icon: <Gauge className="size-4" aria-hidden /> },
  { href: ROUTES.SETTINGS_MEMBERS, label: 'Members', icon: <Users className="size-4" aria-hidden /> },
]

export function SettingsTabs() {
  return <SettingsSegmentedTabs items={SETTINGS_TABS} />
}
