import { AlertCircle } from 'lucide-react'

type SettingsEmptyStateProps = {
  message: string
  icon?: React.ReactNode
}

export function SettingsEmptyState({ message, icon }: SettingsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12">
      {icon || <AlertCircle className="mb-3 size-8 text-muted-foreground" />}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
