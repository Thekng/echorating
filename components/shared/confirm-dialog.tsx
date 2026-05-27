import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={() => !isLoading && onCancel()}
    >
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={description ? "confirm-description" : undefined} onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="mb-2 text-lg font-semibold leading-none tracking-tight">{title}</h2>
        {description && <p id="confirm-description" className="mb-6 text-sm text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>{isLoading ? "Processing..." : confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
