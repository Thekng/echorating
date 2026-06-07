## 2025-05-22 - Accessible Confirmation Dialogs
**Learning:** Browser native `window.confirm` is poor for UX because it blocks the main thread and lacks styling/accessibility control. A custom `ConfirmDialog` with focus trapping and `useTransition` integration provides a much smoother, accessible experience.
**Action:** Always prefer `ConfirmDialog` for destructive actions, ensuring it supports `isLoading` and `alertdialog` ARIA roles.
