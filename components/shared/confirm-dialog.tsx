"use client"
import { Dialog } from "radix-ui"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

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
}: {
  open?: boolean; onOpenChange?: (o: boolean) => void; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string; isLoading?: boolean
  variant?: "destructive" | "default" | "secondary"; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95">
          <Dialog.Title className="text-lg font-semibold mb-2">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground mb-4">{description}</Dialog.Description>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
            <Button variant={variant} size="sm" onClick={onConfirm} disabled={isLoading}>
              {isLoading && <RefreshCw className="mr-1.5 size-3.5 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
