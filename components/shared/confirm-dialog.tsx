"use client";

import { Dialog } from "radix-ui";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  isLoading?: boolean;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmDialog({
  open = true,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loadingText = "Deleting...",
  isLoading = false,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <Dialog.Title className="text-lg font-semibold mb-2 text-foreground">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="text-sm text-muted-foreground mb-4">
              {description}
            </Dialog.Description>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 rounded border text-sm font-medium hover:bg-muted/40 disabled:opacity-50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "px-4 py-2 rounded text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors",
                variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {isLoading && <RefreshCw className="size-3.5 animate-spin" />}
              {isLoading ? loadingText : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
