'use client'
import * as React from 'react'
import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmProps {
  open?: boolean; onOpenChange?: (open: boolean) => void
  title: string; description?: string
  confirmText?: string; cancelText?: string
  isLoading?: boolean; variant?: 'destructive' | 'default'
  onConfirm: () => void; onCancel: () => void
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmText = 'Confirm', cancelText = 'Cancel',
  isLoading = false, variant = 'destructive', onConfirm, onCancel,
}: ConfirmProps) {
  const content = (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
      <Dialog.Content
        role="alertdialog"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95 focus:outline-none"
      >
        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
        {description && <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant={variant} size="sm" onClick={onConfirm} disabled={isLoading} autoFocus>
            {isLoading ? <RefreshCw className="size-4 animate-spin" /> : confirmText}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  )
  return open !== undefined ? (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>{content}</Dialog.Root>
  ) : (
    <Dialog.Root defaultOpen onOpenChange={(o) => !o && onCancel()}>{content}</Dialog.Root>
  )
}
