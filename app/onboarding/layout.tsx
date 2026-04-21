import React from 'react'
import { LogOut } from 'lucide-react'
import { signOutAction } from '@/features/auth/actions'

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-end border-b px-6 py-3">
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs hover:bg-muted"
            aria-label="Log out"
          >
            <LogOut className="size-4" />
            <span>Log out</span>
          </button>
        </form>
      </header>
      {children}
    </div>
  )
}
