'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  variant?: 'default' | 'destructive'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title, description, confirmText = 'Confirm', variant = 'destructive',
  isLoading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
      if (e.key === 'Tab' && dialogRef.current) {
        const btns = dialogRef.current.querySelectorAll('button:not([disabled])')
        if (btns.length < 2) return
        const first = btns[0] as HTMLElement, last = btns[btns.length - 1] as HTMLElement
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault() }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); prevFocus.current?.focus() }
  }, [isLoading, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isLoading && onCancel()}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>
            {isLoading ? 'Loading...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
