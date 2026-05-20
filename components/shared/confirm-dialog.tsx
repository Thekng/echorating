'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'

export function ConfirmDialog({
  title, description, confirmText = 'Confirm', cancelText = 'Cancel',
  isLoading = false, onConfirm, onCancel,
}: {
  title: string; description?: string; confirmText?: string; cancelText?: string;
  isLoading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const id = React.useId(), ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const focusable = ref.current?.querySelectorAll('button:not([disabled])')
    if (focusable?.[0]) (focusable[0] as HTMLElement).focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Tab' && focusable) {
        const last = focusable[focusable.length - 1] as HTMLElement, first = focusable[0] as HTMLElement
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isLoading && onCancel()} role="presentation">
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined} className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <h2 id={`${id}-t`} className="text-lg font-semibold">{title}</h2>
        {description && <p id={`${id}-d`} className="mt-1 text-sm text-muted-foreground mb-5">{description}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>{isLoading ? '...' : confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
