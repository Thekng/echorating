import { AlertTriangle } from 'lucide-react'

type SettingsErrorProps = {
  error: string
}

export function SettingsError({ error }: SettingsErrorProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <AlertTriangle className="size-5 flex-shrink-0 text-destructive" />
      <p className="text-sm text-destructive">{error}</p>
    </div>
  )
}
