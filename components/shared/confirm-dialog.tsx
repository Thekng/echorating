'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancelRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    // Basic focus trap
    const dialog = dialogRef.current
    if (!dialog) return

    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    dialog.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => dialog.removeEventListener('keydown', handleTab)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
