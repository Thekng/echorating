'use client'
import * as React from 'react'
import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open?: boolean; onOpenChange?: (open: boolean) => void; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string; isLoading?: boolean
  variant?: 'destructive' | 'default'; onConfirm: () => void; onCancel?: () => void
}

export function ConfirmDialog({
  open = true, onOpenChange, title, description, confirmText = 'Confirm', cancelText = 'Cancel',
  loadingText = 'Loading...', isLoading = false, variant = 'destructive', onConfirm, onCancel,
}: ConfirmDialogProps) {
  const handleCancel = () => { onCancel?.(); onOpenChange?.(false) }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange ?? ((o) => { if (!o) handleCancel() })}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Title className="text-lg font-semibold text-foreground mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleCancel} disabled={isLoading} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50">{cancelText}</button>
            <button type="button" onClick={onConfirm} disabled={isLoading} className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50", variant === 'destructive' ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary")}>
              {isLoading && <RefreshCw className="size-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
