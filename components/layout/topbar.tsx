'use client'

import { usePathname } from 'next/navigation'
import { APP_NAV_ITEMS, isActivePath } from './nav-items'

export function Topbar() {
  const pathname = usePathname()
  const current = APP_NAV_ITEMS.find((item) => isActivePath(pathname, item.href))
  const title = current?.label ?? 'Workspace'

  return (
    <div className="flex h-16 items-center justify-between px-4 md:px-8">
      <div>
        <p className="text-lg font-semibold tracking-tight">{title}</p>
        <p className="hidden text-xs text-muted-foreground md:block">Manage performance with consistent daily inputs.</p>
      </div>

      <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
        Logged in
      </div>
    </div>
  )
}
