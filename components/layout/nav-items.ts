import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ListChecks, Users, Trophy, BarChart3, Settings } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'

export type AppNavItem = {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
  tourId: string
  showOnMobile: boolean
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    href: ROUTES.DASHBOARD,
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: LayoutDashboard,
    tourId: 'tour-nav-dashboard',
    showOnMobile: true,
  },
  {
    href: ROUTES.DAILY_LOG,
    label: 'Daily Log',
    shortLabel: 'Log',
    icon: ListChecks,
    tourId: 'tour-nav-daily-log',
    showOnMobile: true,
  },
  {
    href: ROUTES.ACCOUNTABILITY,
    label: 'Team',
    shortLabel: 'Team',
    icon: Users,
    tourId: 'tour-nav-team',
    showOnMobile: true,
  },
  {
    href: ROUTES.LEADERBOARD,
    label: 'Leaderboard',
    shortLabel: 'Rank',
    icon: Trophy,
    tourId: 'tour-nav-leaderboard',
    showOnMobile: true,
  },
  {
    href: ROUTES.REPORTS,
    label: 'Reports',
    shortLabel: 'Reports',
    icon: BarChart3,
    tourId: 'tour-nav-reports',
    showOnMobile: false,
  },
  {
    href: ROUTES.SETTINGS,
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings,
    tourId: 'tour-nav-settings',
    showOnMobile: true,
  },
]

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
