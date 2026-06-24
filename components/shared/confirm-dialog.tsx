'use client'
import * as React from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  loadingText?: string
}

export function ConfirmDialog({
  title, description, onConfirm, onCancel,
  confirmText = 'Confirm', cancelText = 'Cancel',
  isLoading = false, loadingText,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, isLoading])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
      aria-modal="true" role="alertdialog"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} autoFocus>
            {isLoading ? loadingText || confirmText : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
