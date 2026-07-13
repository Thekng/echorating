'use client'
import * as React from 'react'
import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  onConfirm: () => void
  onCancel?: () => void
  isLoading?: boolean
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmText = 'Confirm', cancelText = 'Cancel', loadingText = 'Saving...',
  onConfirm, onCancel, isLoading = false, variant = 'default',
}: ConfirmDialogProps) {
  const isManaged = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState(true)
  const isOpen = isManaged ? open : internalOpen
  const handleOpenChange = (val: boolean) => {
    if (!val) onCancel?.()
    if (isManaged) {
      onOpenChange?.(val)
    } else {
      setInternalOpen(val)
    }
  }
  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95">
          <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
          {description && <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>{cancelText}</Button>
            <Button variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm} disabled={isLoading} className="min-w-[100px]">
              {isLoading ? <><RefreshCw className="mr-2 size-4 animate-spin" />{loadingText}</> : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
