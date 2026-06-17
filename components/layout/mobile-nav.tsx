'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { APP_NAV_ITEMS, filterNavItems, isActivePath } from './nav-items'
import { cn } from '@/lib/utils'
import { isRole } from '@/lib/rbac/roles'
import { ROUTES } from '@/lib/constants/routes'

type MobileNavProps = {
  userRole?: string
  hasSubmittedToday?: boolean
}

export function MobileNav({ userRole, hasSubmittedToday }: MobileNavProps) {
  const pathname = usePathname()

  const role = isRole(userRole) ? userRole : 'member'
  const visibleItems = filterNavItems(APP_NAV_ITEMS, role).filter((item) => item.showOnMobile)
  const colsClass = visibleItems.length <= 3 ? 'grid-cols-3' : visibleItems.length === 4 ? 'grid-cols-4' : 'grid-cols-5'

  return (
    <div className={cn('grid h-16 bg-background px-1 pb-[env(safe-area-inset-bottom)] pt-1', colsClass)}>
      {visibleItems.map((item) => {
        const active = isActivePath(pathname, item.href)
        const Icon = item.icon
        const showReminderDot = item.href === ROUTES.DAILY_LOG && hasSubmittedToday === false

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            aria-label={item.label}
            title={item.label}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-md transition-colors',
              item.tourId,
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span className="relative">
              <Icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} />
              {showReminderDot && (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-destructive" />
              )}
            </span>
            <span className="text-[10px] font-medium">{item.shortLabel}</span>
          </Link>
        )
      })}
    </div>
  )
}
