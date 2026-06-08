'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'destructive'
  isLoading?: boolean
}

export function ConfirmDialog({
  title, description, confirmText = 'Confirm', onConfirm, onCancel, variant = 'destructive', isLoading = false,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => !isLoading && e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onCancel, isLoading])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby={description ? 'cd-desc' : undefined}
        className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cd-title" className="text-lg font-semibold">{title}</h2>
        {description && <p id="cd-desc" className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
