'use client'

import { Dialog } from "radix-ui"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open?: boolean; onOpenChange?: (open: boolean) => void; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string; isLoading?: boolean
  variant?: 'destructive' | 'default'; onConfirm: () => void; onCancel: () => void
}

export function ConfirmDialog({
  open = true, onOpenChange, title, description, confirmText = "Confirm", cancelText = "Cancel",
  loadingText = "Confirming...", isLoading, variant = "destructive", onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange ?? ((o) => !o && onCancel())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <Dialog.Title className="text-lg font-semibold mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
            <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
              {isLoading && <RefreshCw className="size-3.5 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
