'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type SettingsTabItem = {
  href: string
  label: string
}

type SettingsSegmentedTabsProps = {
  items: SettingsTabItem[]
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SettingsSegmentedTabs({ items }: SettingsSegmentedTabsProps) {
  const pathname = usePathname()

  return (
    <nav className="overflow-x-auto rounded-lg border bg-card p-2">
      <div className="flex min-w-max gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition-colors',
              isActive(pathname, item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
