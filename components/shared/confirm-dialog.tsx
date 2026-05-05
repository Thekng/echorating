import { useId, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel, isLoading]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="bg-background w-full max-w-sm rounded-lg p-6 shadow-lg">
        <h2 id={titleId} className="mb-2 text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-muted-foreground mb-4 text-sm">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Confirming..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
