import React from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:border-r md:border-border">
        <Sidebar />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <Topbar />
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
          <MobileNav />
        </nav>
      </div>
    </div>
  )
}
