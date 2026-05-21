'use client'

import * as React from 'react'
import { useId, useEffect, useRef } from 'react'
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
  title,
  description,
  confirmText = 'Confirm',
  variant = 'destructive',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const id = useId()
  const returnFocus = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  const isLoadingRef = useRef(isLoading)

  useEffect(() => {
    onCancelRef.current = onCancel
    isLoadingRef.current = isLoading
  })

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoadingRef.current) onCancelRef.current()
      if (e.key !== 'Tab' || !contentRef.current) return
      const f = contentRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
      const [first, last] = [f[0], f[f.length - 1]]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      returnFocus.current?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isLoading && onCancel()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-t`}
      aria-describedby={description ? `${id}-d` : undefined}
    >
      <div
        ref={contentRef}
        className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`} className="mb-2 text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id={`${id}-d`} className="mb-4 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
