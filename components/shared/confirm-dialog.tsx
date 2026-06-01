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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-background rounded-lg p-6 max-w-sm">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-destructive text-destructive-foreground"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
