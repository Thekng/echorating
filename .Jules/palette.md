## 2025-05-15 - [Accessible & Safe Confirm Dialog]
**Learning:** For destructive actions, using a custom ConfirmDialog with `role="alertdialog"` and `aria-modal="true"` improves accessibility over `window.confirm`. Crucially, safety is enhanced by focusing the "Cancel" button by default (`autoFocus`) to prevent accidental deletions via the Enter key.
**Action:** Use `ConfirmDialog` for all destructive actions, ensuring `autoFocus` is on the non-destructive option and using `useTransition` for async feedback.
