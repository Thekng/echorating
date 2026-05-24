'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'

export function ConfirmDialog({
  title, description, confirmText = 'Confirm', onConfirm, onCancel, isLoading = false
}: {
  title: string; description?: string; confirmText?: string;
  onConfirm: () => void; onCancel: () => void; isLoading?: boolean
}) {
  React.useEffect(() => {
    const prev = document.activeElement as HTMLElement
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !isLoading && onCancel()
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('keydown', esc); prev?.focus() }
  }, [onCancel, isLoading])

  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} autoFocus>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
