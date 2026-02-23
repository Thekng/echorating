'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center animate-in fade-in duration-500">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
                <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Failed to load dashboard data</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-[400px]">
                We encountered an unexpected issue while fetching the metrics. This might be a temporary connection problem.
            </p>
            <Button onClick={() => reset()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry Loading
            </Button>
        </div>
    )
}
