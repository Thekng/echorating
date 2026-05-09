'use client'

import * as React from 'react'
import { useId, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="presentation"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="mb-2 text-lg font-semibold leading-none">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mb-6 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
