'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  isLoading = false,
}: {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  isLoading?: boolean
}) {
  const titleId = useId()
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    btnRef.current?.focus()
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && !isLoading && onCancel()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onCancel, isLoading])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !isLoading && onCancel()}
    >
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <h2 id={titleId} className="mb-2 text-lg font-semibold">{title}</h2>
        {description && <p className="mb-6 text-sm text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button ref={btnRef} variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
