'use client'
import { Dialog } from 'radix-ui'
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
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open = true, onOpenChange, title, description,
  confirmText = 'Confirm', cancelText = 'Cancel',
  loadingText = 'Confirming...', isLoading = false,
  variant = 'destructive', onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 rounded-lg">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>}
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 rounded border text-sm hover:bg-muted/40 disabled:opacity-50">{cancelText}</button>
            <button onClick={onConfirm} disabled={isLoading} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm text-white font-medium disabled:opacity-50 ${variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'}`}>
              {isLoading && <RefreshCw className="size-3.5 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
