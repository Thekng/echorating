'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, Moon, Sun } from 'lucide-react'
import { APP_NAV_ITEMS, isActivePath } from './nav-items'
import { cn } from '@/lib/utils'

type SidebarProps = {
  collapsed: boolean
  onToggleCollapse: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  companyName?: string | null
}

export function Sidebar({ collapsed, onToggleCollapse, theme, onToggleTheme, companyName }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className={cn('border-b border-border', collapsed ? 'px-3 py-5 text-center' : 'p-6')}>
        <h2 className="text-xl font-semibold tracking-tight">{collapsed ? 'ER' : 'EchoRating'}</h2>
        {!collapsed ? <p className="mt-1 text-xs text-muted-foreground">Agency performance workspace</p> : null}
      </div>

      <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-3')}>
        {APP_NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-md py-2 text-sm transition-colors',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/90 hover:bg-muted hover:text-foreground',
              )}
              title={item.label}
            >
              <Icon className="size-4" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className={cn('mt-auto border-t border-border', collapsed ? 'p-2' : 'p-3')}>
        <div className={cn('mb-2 text-xs text-muted-foreground', collapsed ? 'text-center' : 'px-1')}>
          {companyName || 'No company'}
        </div>

        <div className={cn('grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
            title={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
            aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {!collapsed ? <span>{theme === 'dark' ? 'Light' : 'Dark'}</span> : null}
          </button>
        </div>
      </div>
    </div>
  )
}
