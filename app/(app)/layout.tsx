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
    <div className="flex h-screen bg-background">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-64 border-r border-border">
        <Sidebar />
      </aside>

      <div className="flex flex-col flex-1">
        {/* Topbar */}
        <header className="h-16 border-b border-border">
          <Topbar />
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>

        {/* Mobile Nav - Mobile Only */}
        <nav className="md:hidden border-t border-border">
          <MobileNav />
        </nav>
      </div>
    </div>
  )
}
