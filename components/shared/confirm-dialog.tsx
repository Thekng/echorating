import * as React from "react"
import { Dialog } from "radix-ui"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: "default" | "destructive"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open = true,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loadingText = "Confirming...",
  isLoading = false,
  variant = "destructive",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange ?? onCancel}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background p-6 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              {cancelText}
            </Button>
            <Button
              variant={variant}
              onClick={onConfirm}
              disabled={isLoading}
              autoFocus
            >
              {isLoading && <RefreshCw className="size-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
