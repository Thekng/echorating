'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'echorating:sidebar:collapsed'
const THEME_KEY = 'echorating:theme'

type AppShellProps = {
  children: ReactNode
  companyName?: string | null
  userRole?: string
  userName?: string | null
  userEmail?: string | null
  hasSubmittedToday?: boolean
}

type ThemeMode = 'light' | 'dark'

export function AppShell({ children, companyName, userRole, userName, userEmail, hasSubmittedToday }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Load from localStorage after hydration
    const savedCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    const savedTheme = window.localStorage.getItem(THEME_KEY)
    const resolvedTheme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

    setCollapsed(savedCollapsed)
    setTheme(resolvedTheme)
    setMounted(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed, mounted])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme, mounted])

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside
        className={cn(
          'hidden md:fixed md:inset-y-0 md:flex md:border-r md:border-border md:bg-background md:transition-[width] md:duration-200',
          collapsed ? 'md:w-22' : 'md:w-72',
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((current) => !current)}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          companyName={companyName}
          userRole={userRole}
          hasSubmittedToday={hasSubmittedToday}
        />
      </aside>

      <div
        className={cn(
          'flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-200',
          collapsed ? 'md:ml-22' : 'md:ml-72',
        )}
      >
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur">
          <Topbar userName={userName} userEmail={userEmail} companyName={companyName} />
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-24 sm:p-4 md:p-6 md:pb-6 xl:p-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
          <MobileNav userRole={userRole} hasSubmittedToday={hasSubmittedToday} />
        </nav>
      </div>
    </div>
  )
}
