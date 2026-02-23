'use client'

import { usePathname } from 'next/navigation'
import { UserCircle, Play } from 'lucide-react'
import { useTour } from '@/components/tour/tour-provider'

export function Topbar() {
  const { startTour } = useTour()

  return (
    <div className="flex h-16 items-center justify-between px-4 md:px-8">
      <div />
      <div className="flex items-center gap-4">
        <button
          onClick={startTour}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
          title="Restart App Tour"
        >
          <Play className="size-3.5" />
          <span className="hidden sm:inline">App Tour</span>
        </button>
      </div>
    </div>
  )
}
