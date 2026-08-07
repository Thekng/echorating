'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Handle Escape key
  React.useEffect(() => {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-all animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-sm scale-100 rounded-xl border bg-background p-6 shadow-lg transition-all animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p id="confirm-description" className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
            autoFocus
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                {confirmText}
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
