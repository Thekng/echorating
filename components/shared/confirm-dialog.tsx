'use client'
import { Dialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmProps {
  open?: boolean; onOpenChange?: (o: boolean) => void; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string; isLoading?: boolean
  variant?: 'default' | 'destructive'; onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({
  open = true, onOpenChange, title, description, confirmText = 'Confirm', cancelText = 'Cancel',
  loadingText = 'Confirming...', isLoading = false, variant = 'default', onConfirm, onCancel,
}: ConfirmProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-lg">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mt-2">{description}</Dialog.Description>}
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 text-sm rounded border hover:bg-accent disabled:opacity-50">
              {cancelText}
            </button>
            <button onClick={onConfirm} disabled={isLoading} className={cn("inline-flex items-center gap-2 px-4 py-2 text-sm rounded text-white disabled:opacity-50", variant === 'destructive' ? 'bg-destructive' : 'bg-primary')}>
              {isLoading && <RefreshCw className="size-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
