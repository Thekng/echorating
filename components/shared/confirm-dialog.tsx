'use client'

import * as React from 'react'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface ConfirmDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel?: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  loadingText = 'Confirming...',
  isLoading = false,
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open ?? true} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-lg animate-in fade-in-0 zoom-in-95 focus:outline-none"
        >
          <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                onCancel?.()
                onOpenChange?.(false)
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>
              {isLoading && <RefreshCw className="mr-2 size-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
