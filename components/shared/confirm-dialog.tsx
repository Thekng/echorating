import { Dialog } from "radix-ui"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmText = "Confirm", cancelText = "Cancel", loadingText = "Confirming...",
  isLoading = false, variant = "destructive", onConfirm, onCancel,
}: {
  open?: boolean; onOpenChange?: (open: boolean) => void; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string; isLoading?: boolean
  variant?: 'default' | 'destructive'; onConfirm: () => void; onCancel?: () => void
}) {
  const isControlled = open !== undefined
  return (
    <Dialog.Root open={isControlled ? open : true} onOpenChange={(v) => { if (!v) onCancel?.(); onOpenChange?.(v) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content role="alertdialog" className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:rounded-lg">
          <div className="flex flex-col gap-2 mb-4">
            <Dialog.Title className="text-lg font-semibold leading-none">{title}</Dialog.Title>
            {description && <Dialog.Description className="text-sm text-muted-foreground mt-2">{description}</Dialog.Description>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
            <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>
              {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
