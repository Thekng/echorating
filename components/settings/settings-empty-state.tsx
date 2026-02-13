type SettingsEmptyStateProps = {
  message: string
}

export function SettingsEmptyState({ message }: SettingsEmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
