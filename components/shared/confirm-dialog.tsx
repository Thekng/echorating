import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  /** @deprecated use open and onOpenChange instead */
  onConfirm?: () => void
  /** @deprecated use open and onOpenChange instead */
  onCancel?: () => void

  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: 'default' | 'destructive'
  onConfirmAction?: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loadingText = 'Deleting...',
  isLoading = false,
  variant = 'destructive',
  onConfirmAction,
  // Legacy props
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Support legacy mode where it's always "open" if rendered
  const isLegacy = open === undefined && onOpenChange === undefined
  const isOpen = isLegacy ? true : !!open

  if (!isOpen) return null

  const handleConfirm = onConfirmAction || onConfirm
  const handleCancel = () => {
    if (onOpenChange) {
      onOpenChange(false)
    } else if (onCancel) {
      onCancel()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 animate-in fade-in-0"
        onClick={() => !isLoading && handleCancel()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-description" className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={isLoading}
            autoFocus
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                {loadingText}
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
