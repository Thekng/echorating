'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  loadingText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  loadingText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel, isLoading])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
    >
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200">
        <h2 id="confirm-dialog-title" className="mb-2 text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-description" className="mb-4 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="h-9 px-4"
          >
            {cancelText}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus
            className="h-9 px-4"
          >
            {isLoading ? (loadingText || confirmText) : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
