## 2025-05-15 - [Accessible Confirm Dialogs]
**Learning:** Replacing native `window.confirm` with a custom dialog improves accessibility (keyboard support, screen reader attributes) and allows for async feedback via `useTransition`.
**Action:** Always prefer `ConfirmDialog` with `role="alertdialog"` and `aria-modal="true"` for destructive actions.
