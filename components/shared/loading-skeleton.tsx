export function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 bg-muted rounded animate-pulse"></div>
      <div className="h-4 bg-muted rounded animate-pulse"></div>
      <div className="h-4 bg-muted rounded animate-pulse"></div>
    </div>
  )
}
