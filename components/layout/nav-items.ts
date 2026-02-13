import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ListChecks, Medal, Users, Settings } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'

export type AppNavItem = {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    href: ROUTES.DASHBOARD,
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: LayoutDashboard,
  },
  {
    href: ROUTES.DAILY_LOG,
    label: 'Daily Log',
    shortLabel: 'Log',
    icon: ListChecks,
  },
  {
    href: ROUTES.LEADERBOARD,
    label: 'Leaderboard',
    shortLabel: 'Top',
    icon: Medal,
  },
  {
    href: ROUTES.AGENTS,
    label: 'Agents',
    shortLabel: 'Agents',
    icon: Users,
  },
  {
    href: ROUTES.SETTINGS,
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings,
  },
]

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
