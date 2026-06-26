'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  variant = 'destructive',
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
      onClick={onCancel}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-dialog-title" className="text-lg font-semibold mb-2 text-foreground">{title}</h2>
        {description && <p id="confirm-dialog-description" className="mb-6 text-sm text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} className="min-w-24" autoFocus>
            {isLoading ? <><RefreshCw className="size-4 animate-spin" />{confirmText}</> : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
