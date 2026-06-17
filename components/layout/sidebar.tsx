'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, Moon, Play, Sun } from 'lucide-react'
import { APP_NAV_ITEMS, filterNavItems, isActivePath } from './nav-items'
import { cn } from '@/lib/utils'
import { useTour } from '@/components/tour/tour-provider'
import { isRole } from '@/lib/rbac/roles'
import { ROUTES } from '@/lib/constants/routes'

type SidebarProps = {
  collapsed: boolean
  onToggleCollapse: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  companyName?: string | null
  userRole?: string
  hasSubmittedToday?: boolean
}

export function Sidebar({ collapsed, onToggleCollapse, theme, onToggleTheme, companyName, userRole, hasSubmittedToday }: SidebarProps) {
  const pathname = usePathname()
  const { startTour } = useTour()

  const role = isRole(userRole) ? userRole : 'member'
  const visibleItems = filterNavItems(APP_NAV_ITEMS, role)

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('border-b border-sidebar-border tour-nav-user-menu', collapsed ? 'px-3 py-6 text-center' : 'px-6 py-7')}>
        <h2 className="text-2xl font-semibold tracking-tight">{collapsed ? 'ER' : 'EchoRating'}</h2>
        {!collapsed ? <p className="mt-1.5 text-xs text-sidebar-foreground/60">Agency performance workspace</p> : null}
      </div>

      <nav className={cn('flex-1 space-y-1', collapsed ? 'p-3' : 'p-3')}>
        {visibleItems.map((item) => {
          const active = isActivePath(pathname, item.href)
          const Icon = item.icon
          const showReminderDot = item.href === ROUTES.DAILY_LOG && hasSubmittedToday === false

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                item.tourId,
                collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
              title={item.label}
            >
              <span className="relative">
                <Icon className="size-5" />
                {showReminderDot && (
                  <span className="absolute -right-1 -top-1 size-2 rounded-full bg-destructive" />
                )}
              </span>
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className={cn('mt-auto border-t border-sidebar-border', collapsed ? 'p-3' : 'p-4')}>
        <div className={cn('mb-2 text-xs text-sidebar-foreground/60', collapsed ? 'text-center' : 'px-1')}>
          {companyName || 'No company'}
        </div>

        <div className={cn('grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
            aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {!collapsed ? <span>{theme === 'dark' ? 'Light' : 'Dark'}</span> : null}
          </button>
        </div>

        <button
          type="button"
          onClick={startTour}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title="Restart App Tour"
          aria-label="Restart App Tour"
        >
          <Play className="size-4" />
          {!collapsed ? <span>App Tour</span> : null}
        </button>
      </div>
    </div>
  )
}
