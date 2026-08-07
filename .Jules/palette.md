## 2026-07-11 - [Enhanced Accessible ConfirmDialog]
**Learning:** Replacing native `window.confirm` with a custom Radix-based `ConfirmDialog` improves accessibility (via `alertdialog` role) and allows for better UX through loading states and non-blocking interactions. Transitions (`useTransition`) should be used to provide immediate feedback during destructive actions.
**Action:** Always prefer `ConfirmDialog` for destructive actions; ensure it supports `isLoading` states to prevent double-submissions and provide visual feedback.
