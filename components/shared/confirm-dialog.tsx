'use client'

import * as React from 'react'
import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  confirmText?: string
  cancelText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: 'destructive' | 'default'
}

export function ConfirmDialog({
  title, description, onConfirm, onCancel, open, onOpenChange,
  confirmText = 'Confirm', cancelText = 'Cancel', loadingText = 'Loading...',
  isLoading = false, variant = 'destructive',
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open ?? true} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200">
          <Dialog.Title className="text-lg font-semibold mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden">
              {cancelText}
            </button>
            <button onClick={onConfirm} disabled={isLoading} autoFocus className={cn(
              "px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
              variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}>
              {isLoading && <RefreshCw className="size-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
