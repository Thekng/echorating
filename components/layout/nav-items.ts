import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ListChecks, Users, Trophy, BarChart3, Settings, UserCircle } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'
import { type Role, hasPermission } from '@/lib/rbac/roles'

export type AppNavItem = {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
  tourId: string
  showOnMobile: boolean
  minRole?: Role
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
    href: ROUTES.ACCOUNT,
    label: 'My Account',
    shortLabel: 'Account',
    icon: UserCircle,
    tourId: 'tour-nav-account',
    showOnMobile: false,
  },
  {
    href: ROUTES.REPORTS,
    label: 'Reports',
    shortLabel: 'Reports',
    icon: BarChart3,
    tourId: 'tour-nav-reports',
    showOnMobile: false,
    minRole: 'manager',
  },
  {
    href: ROUTES.SETTINGS,
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings,
    tourId: 'tour-nav-settings',
    showOnMobile: true,
    minRole: 'manager',
  },
]

export function filterNavItems(items: AppNavItem[], userRole: Role): AppNavItem[] {
  return items.filter((item) => !item.minRole || hasPermission(userRole, item.minRole))
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
