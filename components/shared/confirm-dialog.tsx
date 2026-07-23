import * as React from 'react'
import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'

export interface ConfirmDialogProps {
  open?: boolean; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string
  isLoading?: boolean; variant?: 'destructive' | 'default'
  onConfirm: () => void; onCancel: () => void
}

export function ConfirmDialog({
  open = true, title, description, confirmText = 'Confirm', cancelText = 'Cancel',
  loadingText = 'Loading...', isLoading = false, variant = 'destructive', onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(val) => !val && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95" role="alertdialog">
          <Dialog.Title className="text-lg font-semibold mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} disabled={isLoading} className="px-4 py-2 rounded border hover:bg-muted/40 text-sm font-medium transition-colors">{cancelText}</button>
            <button type="button" onClick={onConfirm} disabled={isLoading} autoFocus className={`px-4 py-2 rounded text-sm font-medium transition-colors inline-flex items-center gap-2 ${variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
              {isLoading && <RefreshCw className="size-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
