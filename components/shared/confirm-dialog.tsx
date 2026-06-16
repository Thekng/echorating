'use client'
import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
export function ConfirmDialog({ title, description, confirmText = 'Confirm', cancelText = 'Cancel', isLoading = false, onConfirm, onCancel }: { title: string, description?: string, confirmText?: string, cancelText?: string, isLoading?: boolean, onConfirm: () => void, onCancel: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) onCancel() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onCancel, isLoading])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0 duration-200" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm animate-in zoom-in-95 duration-200 rounded-lg bg-background p-6 shadow-lg border border-border">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading} autoFocus className="flex-1 sm:flex-none">{cancelText}</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} className="flex-1 sm:flex-none gap-2">
            {isLoading && <RefreshCw className="size-4 animate-spin" />}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
