import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ListChecks, Users, Settings } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'

export type AppNavItem = {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
  tourId: string
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    href: ROUTES.DASHBOARD,
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: LayoutDashboard,
    tourId: 'tour-nav-dashboard',
  },
  {
    href: ROUTES.DAILY_LOG,
    label: 'Daily Log',
    shortLabel: 'Log',
    icon: ListChecks,
    tourId: 'tour-nav-daily-log',
  },
  {
    href: ROUTES.ACCOUNTABILITY,
    label: 'Team',
    shortLabel: 'Team',
    icon: Users,
    tourId: 'tour-nav-team',
  },
  {
    href: ROUTES.SETTINGS,
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings,
    tourId: 'tour-nav-settings',
  },
]

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
