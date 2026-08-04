'use client'

import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open?: boolean; onOpenChange?: (open: boolean) => void; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string; isLoading?: boolean
  variant?: 'destructive' | 'default'; onConfirm: () => void; onCancel: () => void
}

export function ConfirmDialog({
  open = true, onOpenChange, title, description, confirmText = 'Confirm', cancelText = 'Cancel',
  loadingText = 'Loading...', isLoading = false, variant = 'destructive', onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg border border-border data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
            <Button variant={variant} onClick={onConfirm} disabled={isLoading} className="gap-2">
              {isLoading && <RefreshCw className="size-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
