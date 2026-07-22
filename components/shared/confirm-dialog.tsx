'use client'
import * as React from 'react'
import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
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
  open = true, onOpenChange, title, description,
  confirmText = 'Confirm', cancelText = 'Cancel',
  isLoading, variant = 'destructive', onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95">
          <Dialog.Title className="text-lg font-semibold mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent disabled:opacity-50">{cancelText}</button>
            <button onClick={onConfirm} disabled={isLoading} className={cn("inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md text-white disabled:opacity-50", variant === 'destructive' ? 'bg-destructive' : 'bg-primary')}>
              {isLoading && <RefreshCw className="size-3.5 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
