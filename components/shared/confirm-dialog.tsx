'use client'

import { useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  isPending = false,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
}: ConfirmDialogProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel, isPending])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold mb-2">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            autoFocus
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
