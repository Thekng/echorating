'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface ConfirmDialogProps {
  title: string; description?: string; confirmText?: string; cancelText?: string;
  isLoading?: boolean; loadingText?: string; onConfirm: () => void; onCancel: () => void;
}

export function ConfirmDialog({
  title, description, confirmText = 'Confirm', cancelText = 'Cancel',
  isLoading, loadingText, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const previousFocus = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement
    const handleKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && !isLoading && onCancel()
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocus.current?.focus()
    }
  }, [onCancel, isLoading])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      role="alertdialog" aria-modal="true" onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} autoFocus className="gap-2">
            {isLoading && <RefreshCw className="size-4 animate-spin" />}
            {isLoading ? loadingText || confirmText : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
