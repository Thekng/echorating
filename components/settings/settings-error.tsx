import { AlertCircle } from 'lucide-react'

type SettingsErrorProps = {
  error: string
}

export function SettingsError({ error }: SettingsErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
      <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-semibold text-sm text-destructive mb-1">Error</h3>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    </div>
  )
}
