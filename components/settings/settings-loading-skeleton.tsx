import { Skeleton } from '@/components/ui/skeleton'
import { SettingsSurface } from './settings-surface'

type SettingsLoadingSkeletonProps = {
  itemCount?: number
}

export function SettingsLoadingSkeleton({ itemCount = 5 }: SettingsLoadingSkeletonProps) {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header skeleton */}
      <div className="sticky top-16 z-10 rounded-lg border bg-background/95 p-4 md:p-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      {/* Filter skeleton */}
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Skeleton className="h-10 w-full md:col-span-3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-10 md:col-span-4 justify-self-end" />
      </div>

      {/* Content skeleton */}
      <SettingsSurface className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: itemCount }).map((_, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </SettingsSurface>
    </div>
  )
}
