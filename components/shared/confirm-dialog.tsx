import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg border"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold mb-2">
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-description" className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}
