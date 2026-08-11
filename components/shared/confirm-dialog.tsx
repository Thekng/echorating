import { RefreshCw } from 'lucide-react'
interface ConfirmDialogProps {
  title: string; description?: string; confirmText?: string; cancelText?: string; isLoading?: boolean
  onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({
  title, description, confirmText = 'Confirm', cancelText = 'Cancel', isLoading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-in fade-in duration-200"
      role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
    >
      <div className="bg-background border border-border rounded-lg p-6 max-w-sm w-full shadow-lg animate-in zoom-in-95 duration-200">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold mb-2">{title}</h2>
        {description && <p id="confirm-dialog-description" className="text-sm text-muted-foreground mb-4">{description}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button" onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 rounded border border-input hover:bg-accent hover:text-accent-foreground disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button" onClick={onConfirm} disabled={isLoading}
            className="px-4 py-2 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 text-sm font-medium flex items-center gap-1.5 transition-colors"
          >
            {isLoading && <RefreshCw className="size-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
