## 2026-08-13 - Replacing Destructive Blockers with Accessible Dialogs
**Learning:** Replacing native synchronous `window.confirm` blockers with asynchronous custom ConfirmDialogs prevents UI thread freezing and provides consistent visual feedback, but must be paired with clear ARIA alertdialog roles and accessible focus management to ensure screen reader compatibility.
**Action:** Always implement custom confirmation overlays with Radix UI Dialog (role="alertdialog") and manage open state strictly using controlled hooks (onOpenChange) to prevent modal state de-synchronization.
