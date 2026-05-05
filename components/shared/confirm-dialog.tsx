'use client'

import { useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ConfirmDialog({ title, description, onConfirm, onCancel, isLoading }: ConfirmDialogProps) {
  const id = useId()
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => !isLoading && e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel, isLoading])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !isLoading && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={id} className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading} autoFocus>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>{isLoading ? 'Deleting...' : 'Confirm'}</Button>
        </div>
      </div>
    </div>
  )
}
