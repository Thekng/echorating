'use client'

import * as React from 'react'
import { AlertDialog } from 'radix-ui'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: 'default' | 'destructive'
  onConfirmAction: () => void
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmText = 'Confirm', cancelText = 'Cancel', loadingText = 'Processing...',
  isLoading = false, variant = 'destructive', onConfirmAction,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <AlertDialog.Content className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-lg outline-hidden',
          'animate-in fade-in-0 zoom-in-95'
        )}>
          <AlertDialog.Title className="text-lg font-semibold tracking-tight">{title}</AlertDialog.Title>
          {description && <AlertDialog.Description className="mt-3 text-sm text-muted-foreground">{description}</AlertDialog.Description>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={isLoading}>{cancelText}</Button>
            </AlertDialog.Cancel>
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={onConfirmAction}
              disabled={isLoading}
              className="min-w-24"
              autoFocus
            >
              {isLoading ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />{loadingText}</> : confirmText}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
