'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title, description, confirmText = 'Confirm', isLoading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement
    dialogRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll('button:not([disabled])')
        const first = focusables[0] as HTMLElement, last = focusables[focusables.length - 1] as HTMLElement
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('keydown', handleKey); prev?.focus() }
  }, [onCancel, isLoading])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
         role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-desc"
         onClick={() => !isLoading && onCancel()}>
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl outline-none"
           onClick={e => e.stopPropagation()}>
        <h2 id="cd-title" className="text-lg font-semibold">{title}</h2>
        {description && <p id="cd-desc" className="mt-3 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} autoFocus>{isLoading ? '...' : confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
