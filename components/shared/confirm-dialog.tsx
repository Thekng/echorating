import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  variant?: "default" | "destructive"
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  variant = "destructive",
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0"
      onClick={(e) => !isLoading && e.target === e.currentTarget && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-description" : undefined}
        className="bg-background w-full max-w-sm overflow-hidden rounded-lg border shadow-lg animate-in zoom-in-95"
      >
        <div className="p-6">
          <h2 id="confirm-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p id="confirm-description" className="text-muted-foreground mt-2 text-sm">
              {description}
            </p>
          )}
        </div>
        <div className="bg-muted/30 flex justify-end gap-3 px-6 py-4">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            className="text-sm font-medium"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus
            className="text-sm font-medium min-w-[80px]"
          >
            {isLoading ? "Wait..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
