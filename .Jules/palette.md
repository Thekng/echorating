## 2025-05-03 - Accessible Custom Confirmation Dialogs
**Learning:** Native `window.confirm` is blocking and provides a poor, inaccessible UX. Custom dialogs using `role="alertdialog"` and `aria-modal="true"` provide a better, non-blocking experience that integrates with the app's design system.
**Action:** Replace native `window.confirm` with `ConfirmDialog` for destructive actions. Use React's `useTransition` to provide loading feedback within the dialog.
