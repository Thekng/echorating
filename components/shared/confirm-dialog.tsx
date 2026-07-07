"use client"

import * as React from "react"
import { Dialog } from "radix-ui"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  isLoading?: boolean
  variant?: "default" | "destructive"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loadingText = "Confirming...",
  isLoading = false,
  variant = "destructive",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(val) => !val && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              {cancelText}
            </Button>
            <Button variant={variant} onClick={onConfirm} disabled={isLoading} autoFocus>
              {isLoading ? loadingText : confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
