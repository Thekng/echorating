import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel, isLoading]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const elements = Array.from(dialog.querySelectorAll<HTMLElement>(focusable))
      .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true');

    elements[0]?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const currentElements = Array.from(dialog.querySelectorAll<HTMLElement>(focusable))
        .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true');
      const first = currentElements[0];
      const last = currentElements[currentElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        last?.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first?.focus();
        e.preventDefault();
      }
    };

    dialog.addEventListener("keydown", handleTab);
    return () => dialog.removeEventListener("keydown", handleTab);
  }, [isLoading]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        ref={dialogRef}
        className="bg-background w-full max-w-sm rounded-lg p-6 shadow-lg animate-in fade-in zoom-in duration-200"
      >
        <h2 id={titleId} className="mb-2 text-lg font-semibold">{title}</h2>
        {description && <p id={descriptionId} className="text-muted-foreground mb-6 text-sm">{description}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Confirming..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
