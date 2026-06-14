'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { APP_NAV_ITEMS, isActivePath } from './nav-items'
import { cn } from '@/lib/utils'

const MOBILE_ITEMS = APP_NAV_ITEMS.filter((item) => item.showOnMobile)

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="grid h-16 grid-cols-5 bg-background px-1 pb-[env(safe-area-inset-bottom)] pt-1">
      {MOBILE_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href)
        const Icon = item.icon

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
            <Icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-[10px] font-medium">{item.shortLabel}</span>
          </Link>
        )
      })}
    </div>
  )
}
