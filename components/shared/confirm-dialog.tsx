import * as React from 'react'
import { useId, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  pending?: boolean
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  pending = false,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel, pending])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200">
        <h2 id={titleId} className="mb-2 text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mb-4 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            autoFocus
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
