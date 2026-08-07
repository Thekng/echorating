## 2026-07-04 - Accessible Custom Confirmation Dialog
**Learning:** Replacing native browser `window.confirm` with a custom Radix-based `ConfirmDialog` improves UX consistency and allows for non-blocking asynchronous feedback (loading states). Implementing ARIA `alertdialog` roles and ensuring keyboard support (Escape/autoFocus) is critical for accessibility.
**Action:** Use the `ConfirmDialog` pattern with `useTransition` for all destructive actions to provide a polished, accessible, and responsive user experience.
