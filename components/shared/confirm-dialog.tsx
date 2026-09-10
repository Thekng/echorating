'use client'

import { Dialog } from 'radix-ui'

export interface ConfirmDialogProps {
  title: string
  description?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  confirmText?: string
  cancelText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: 'destructive' | 'default'
  onConfirm: () => void
  onCancel?: () => void
}

export function ConfirmDialog({
  title,
  description,
  open = true,
  onOpenChange,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loadingText,
  isLoading = false,
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange?.(isOpen)
    if (!isOpen && onCancel) {
      onCancel()
    }
  }

  const confirmClasses =
    variant === 'destructive'
      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      : 'bg-primary text-primary-foreground hover:bg-primary/90'

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-hidden"
        >
          <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                onCancel?.()
                onOpenChange?.(false)
              }}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${confirmClasses}`}
            >
              {isLoading ? loadingText || 'Processing...' : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
