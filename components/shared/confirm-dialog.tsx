'use client'

import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmText?: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, description, confirmText = 'Confirm', isLoading, onConfirm, onCancel }: ConfirmDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement
    containerRef.current?.querySelector<HTMLButtonElement>('button:last-child')?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
      if (e.key === 'Tab') {
        const focusable = containerRef.current?.querySelectorAll('button:not([disabled])')
        if (!focusable || focusable.length < 2) return
        if (e.shiftKey && document.activeElement === focusable[0]) {
          (focusable[focusable.length - 1] as HTMLElement).focus(); e.preventDefault()
        } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          (focusable[0] as HTMLElement).focus(); e.preventDefault()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); previousFocus?.focus() }
  }, [onCancel, isLoading])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && !isLoading && onCancel()}>
      <div ref={containerRef} className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in fade-in zoom-in duration-200">
        <h2 className="mb-2 text-lg font-semibold">{title}</h2>
        {description && <p className="mb-6 text-sm text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isLoading} className="h-10 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isLoading} className="h-10 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 focus-visible:ring-2 ring-destructive ring-offset-2 outline-none">{isLoading ? 'Loading...' : confirmText}</button>
        </div>
      </div>
    </div>
  )
}
