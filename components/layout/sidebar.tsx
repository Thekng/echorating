'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { APP_NAV_ITEMS, isActivePath } from './nav-items'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-6">
        <h2 className="text-xl font-semibold tracking-tight">EchoRating</h2>
        <p className="mt-1 text-xs text-muted-foreground">Agency performance workspace</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {APP_NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
