'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel, isLoading])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel()
      }}
    >
      <div
        className="bg-background rounded-lg p-6 max-w-sm w-full shadow-lg animate-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-description' : undefined}
      >
        <h2 id="confirm-title" className="text-lg font-semibold mb-2">
          {title}
        </h2>
        {description && (
          <p id="confirm-description" className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
