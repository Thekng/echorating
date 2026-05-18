'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  confirmText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  isLoading,
  confirmText = 'Confirm',
  variant = 'destructive',
}: ConfirmDialogProps) {
  const id = React.useId()
  const confirmRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel, isLoading])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-t`}
      aria-describedby={description ? `${id}-d` : undefined}
    >
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h2 id={`${id}-t`} className="text-lg font-semibold">{title}</h2>
        {description && (
          <p id={`${id}-d`} className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={variant}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="animate-spin" />}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
