'use client'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string; description?: string; confirmText?: string; isLoading?: boolean
  confirmVariant?: 'default' | 'destructive'; onConfirm: () => void; onCancel: () => void
}

export function ConfirmDialog({
  title, description, confirmText = 'Confirm', confirmVariant = 'destructive',
  isLoading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const previousFocus = useRef<HTMLElement | null>(null), dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && !isLoading && onCancel()
    window.addEventListener('keydown', handleEsc)
    return () => { window.removeEventListener('keydown', handleEsc); previousFocus.current?.focus() }
  }, [onCancel, isLoading])

  const handleTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const btns = dialogRef.current?.querySelectorAll('button:not([disabled])')
    if (!btns || btns.length < 2) return
    const first = btns[0] as HTMLElement, last = btns[btns.length - 1] as HTMLElement
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !isLoading && onCancel()}>
      <div
        ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()} onKeyDown={handleTab}
      >
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={isLoading} autoFocus>{isLoading ? 'Processing...' : confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
