"use client"
import { AlertDialog as RadixAlert } from "radix-ui"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open?: boolean; onOpenChange?: (open: boolean) => void; title: string; description?: string
  confirmText?: string; cancelText?: string; loadingText?: string; isLoading?: boolean
  variant?: 'default' | 'destructive'; onConfirm: () => void; onCancel: () => void
}

export function ConfirmDialog({
  open = true, onOpenChange, title, description, confirmText = "Confirm", cancelText = "Cancel",
  loadingText = "Confirming...", isLoading = false, variant = "destructive", onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <RadixAlert.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlert.Portal>
        <RadixAlert.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <RadixAlert.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <RadixAlert.Title className="text-lg font-semibold mb-2">{title}</RadixAlert.Title>
          {description && <RadixAlert.Description className="text-sm text-muted-foreground mb-4">{description}</RadixAlert.Description>}
          <div className="flex justify-end gap-2">
            <RadixAlert.Cancel asChild>
              <button type="button" onClick={onCancel} disabled={isLoading} className="px-4 py-2 text-sm rounded border hover:bg-muted/40 disabled:opacity-50">{cancelText}</button>
            </RadixAlert.Cancel>
            <RadixAlert.Action asChild>
              <button type="button" onClick={(e) => { e.preventDefault(); onConfirm() }} disabled={isLoading} className={cn("inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded text-white disabled:opacity-50", variant === "destructive" ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90")}>
                {isLoading ? <><RefreshCw className="size-3.5 animate-spin" />{loadingText}</> : confirmText}
              </button>
            </RadixAlert.Action>
          </div>
        </RadixAlert.Content>
      </RadixAlert.Portal>
    </RadixAlert.Root>
  )
}
