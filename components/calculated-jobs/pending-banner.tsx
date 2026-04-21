import { Loader2 } from 'lucide-react'

type PendingCalculatedBannerProps = {
  pendingCount: number
}

export function PendingCalculatedBanner({ pendingCount }: PendingCalculatedBannerProps) {
  if (pendingCount <= 0) {
    return null
  }

  const label =
    pendingCount === 1
      ? '1 log is recalculating its derived metrics — values may briefly lag.'
      : `${pendingCount} logs are recalculating their derived metrics — values may briefly lag.`

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900"
    >
      <Loader2 aria-hidden className="size-3.5 animate-spin" />
      <span>{label}</span>
    </div>
  )
}
