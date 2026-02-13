'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { APP_NAV_ITEMS, isActivePath } from './nav-items'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="grid h-16 grid-cols-5 bg-background px-1 pb-[env(safe-area-inset-bottom)] pt-1">
      {APP_NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center rounded-md text-[11px] leading-none transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('mb-1 size-4', active ? 'text-primary' : 'text-muted-foreground')} />
            {item.shortLabel}
          </Link>
        )
      })}
    </div>
  )
}
