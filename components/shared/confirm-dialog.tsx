'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ConfirmDialog({ title, description, onConfirm, onCancel, isLoading = false }: ConfirmDialogProps) {
  const id = React.useId()
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const onCancelRef = React.useRef(onCancel)
  onCancelRef.current = onCancel

  React.useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement
    const dialog = dialogRef.current
    if (!dialog) return

    const getFocusable = () => dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )

    // Focus first element on mount
    getFocusable()[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current()
      if (e.key === 'Tab') {
        const elements = getFocusable()
        if (elements.length === 0) return
        const first = elements[0], last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, []) // Run only once on mount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined}
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg animate-in fade-in zoom-in duration-200">
        <h2 id={`${id}-t`} className="text-lg font-semibold">{title}</h2>
        {description && <p id={`${id}-d`} className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>{isLoading ? 'Deleting...' : 'Confirm'}</Button>
        </div>
      </div>
    </div>
  )
}
