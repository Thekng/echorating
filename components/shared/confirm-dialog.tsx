"use client"

import * as React from 'react'
import { Dialog as D } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ConfirmDialog({
  open = true, onOpenChange, title, description,
  confirmText = 'Confirm', cancelText = 'Cancel',
  loadingText = 'Confirming...', isLoading = false,
  variant = 'default', onConfirm, onCancel,
}: {
  open?: boolean; onOpenChange?: (open: boolean) => void
  title: string; description?: string; confirmText?: string; cancelText?: string
  loadingText?: string; isLoading?: boolean; variant?: 'default' | 'destructive'
  onConfirm: () => void; onCancel?: () => void
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <D.Title className="text-lg font-semibold">{title}</D.Title>
          {description && <D.Description className="mt-2 text-sm text-muted-foreground">{description}</D.Description>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" disabled={isLoading} onClick={() => { onCancel?.(); onOpenChange?.(false) }}>
              {cancelText}
            </Button>
            <Button variant={variant === 'destructive' ? 'destructive' : 'default'} disabled={isLoading} onClick={onConfirm}>
              {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
