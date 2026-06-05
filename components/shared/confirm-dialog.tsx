'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement
    dialogRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
      if (e.key === 'Tab') {
        const btns = dialogRef.current?.querySelectorAll('button:not([disabled])')
        if (!btns?.length) return
        const first = btns[0] as HTMLElement, last = btns[btns.length - 1] as HTMLElement
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('keydown', handleKey); previousFocus?.focus() }
  }, [isLoading, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !isLoading && onCancel()}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" tabIndex={-1} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg outline-none border">
        <h2 className="mb-2 text-lg font-semibold">{title}</h2>
        {description && <p className="mb-6 text-sm text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>{isLoading ? 'Processing...' : confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
