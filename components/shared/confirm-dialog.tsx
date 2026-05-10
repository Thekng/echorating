'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  title, description, onConfirm, onCancel, isLoading, confirmText = 'Confirm', cancelText = 'Cancel',
}: ConfirmDialogProps) {
  const titleId = useId(), descriptionId = useId(), confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmButtonRef.current?.focus()
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && !isLoading && onCancel()
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onCancel, isLoading])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && !isLoading && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        {description && <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button ref={confirmButtonRef} variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
