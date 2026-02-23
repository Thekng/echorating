'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SettingsTabItem = {
  href: string
  label: string
  icon?: ReactNode
}

type SettingsSegmentedTabsProps = {
  items: SettingsTabItem[]
}

function isActive(pathname: string, href: string) {
  // Exact match for the route
  if (pathname === href) return true
  // Check if pathname starts with the href followed by a slash to avoid partial matches
  if (pathname.startsWith(`${href}/`)) return true
  return false
}

export function SettingsSegmentedTabs({ items }: SettingsSegmentedTabsProps) {
  const pathname = usePathname()

  return (
    <nav
      className="overflow-x-auto rounded-lg border bg-card p-2"
      role="tablist"
      aria-label="Settings navigation"
    >
      <div className="flex min-w-max gap-1" role="presentation">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              title={item.label}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
              <span className="sr-only md:hidden">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
