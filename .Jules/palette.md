## 2026-07-10 - Improving Confirmation Dialogs
**Learning:** Using a custom `ConfirmDialog` instead of `window.confirm` provides a more accessible and visually consistent experience. Integrating `useTransition` allows for better feedback during asynchronous destructive actions (like deletion) by showing a loading state directly within the dialog.
**Action:** Always prefer `ConfirmDialog` for destructive actions. Ensure it supports `isLoading` and `alertdialog` role for accessibility.
