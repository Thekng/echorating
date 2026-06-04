import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  isLoading?: boolean
}

export function ConfirmDialog({ title, description, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'destructive', isLoading = false }: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement
    const handleKD = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
      if (e.key === 'Tab') {
        const els = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [])
        if (els.length < 2) return
        if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1]?.focus() }
        else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0]?.focus() }
      }
    }
    window.addEventListener('keydown', handleKD)
    return () => { window.removeEventListener('keydown', handleKD); prevFocus?.focus() }
  }, [isLoading, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="cd-t" onClick={() => !isLoading && onCancel()}>
      <div ref={ref} className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg border" onClick={e => e.stopPropagation()}>
        <h2 id="cd-t" className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>{isLoading ? '...' : confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
