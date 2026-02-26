'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, FolderKanban, Gauge, Users } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'
import { cn } from '@/lib/utils'

const SETTINGS_TABS = [
  { href: ROUTES.SETTINGS_COMPANY, label: 'Company', icon: Building2 },
  { href: ROUTES.SETTINGS_DEPARTMENTS, label: 'Departments', icon: FolderKanban },
  { href: ROUTES.SETTINGS_METRICS, label: 'Metrics', icon: Gauge },
  { href: ROUTES.SETTINGS_MEMBERS, label: 'Members', icon: Users },
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
    <div className="border-b border-border">
      <div className="flex gap-8">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname.includes(tab.href.split('/').pop() || '')

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
