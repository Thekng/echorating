import { cn } from '@/lib/utils'

type SettingsFeedbackProps = {
  status: 'idle' | 'success' | 'error'
  message: string
  className?: string
}

export function SettingsFeedback({ status, message, className }: SettingsFeedbackProps) {
  if (status === 'idle' || !message) {
    return null
  }

  return (
    <p
      className={cn(
        'text-sm',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  )
}
