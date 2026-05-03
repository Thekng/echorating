'use client'

import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div role="alertdialog" aria-modal="true" className="bg-background rounded-lg p-6 max-w-sm w-full shadow-lg border">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
