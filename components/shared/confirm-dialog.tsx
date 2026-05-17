'use client'

import { useId, useEffect, useRef } from 'react'
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
      if (e.key === 'Tab') {
        const el = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
        if (!el || el.length < 2) return
        if (e.shiftKey && document.activeElement === el[0]) { e.preventDefault(); el[el.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === el[el.length - 1]) { e.preventDefault(); el[0].focus() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (document.body.contains(previousFocus.current)) previousFocus.current?.focus()
    }
  }, [onCancel, isLoading])

  return (
    <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && !isLoading && onCancel()}>
      <div className="bg-background rounded-lg p-6 max-w-sm w-full shadow-lg border">
        <h2 id={`${id}-t`} className="text-lg font-semibold mb-2">{title}</h2>
        {description && <p id={`${id}-d`} className="text-sm text-muted-foreground mb-4">{description}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>{isLoading ? 'Processing...' : 'Confirm'}</Button>
        </div>
      </div>
    </div>
  )
}
