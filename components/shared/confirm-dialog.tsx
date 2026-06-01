'use client'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string; description?: string; confirmText?: string; cancelText?: string
  variant?: 'default' | 'destructive'; isLoading?: boolean
  onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({
  title, description, confirmText = 'Confirm', cancelText = 'Cancel',
  variant = 'destructive', isLoading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null), cancelRef = useRef(onCancel), loadingRef = useRef(isLoading)
  useEffect(() => { cancelRef.current = onCancel; loadingRef.current = isLoading })
  useEffect(() => {
    const originalFocus = document.activeElement as HTMLElement
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loadingRef.current) cancelRef.current()
      if (e.key === 'Tab' && dialogRef.current) {
        const f = Array.from(dialogRef.current.querySelectorAll('button:not([disabled])')) as HTMLElement[]
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); originalFocus?.focus() }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true">
      <div ref={dialogRef} className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>{cancelText}</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>{isLoading ? 'Processing...' : confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
