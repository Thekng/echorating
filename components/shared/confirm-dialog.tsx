import * as React from 'react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

interface ConfirmDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: 'destructive' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open = true,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loadingText = 'Loading...',
  isLoading = false,
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
          {description && <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onCancel} disabled={isLoading} className="px-4 py-2 rounded border text-sm hover:bg-muted/40 disabled:opacity-50">{cancelText}</button>
            <button type="button" onClick={onConfirm} disabled={isLoading} className={cn("px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50", variant === 'destructive' ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90")}>
              {isLoading ? <span className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> {loadingText}</span> : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
