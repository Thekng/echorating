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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-description' : undefined}
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200"
      >
        <h2 id="confirm-title" className="text-lg font-semibold leading-none tracking-tight">
          {title}
        </h2>
        {description && (
          <p id="confirm-description" className="mt-3 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} autoFocus>
            {isLoading ? (loadingText || confirmText) : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
