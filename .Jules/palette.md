## 2026-05-31 - Custom ConfirmDialog Implementation
**Learning:** Replacing native browser `window.confirm` with a custom, accessible `ConfirmDialog` significantly improves micro-UX by providing a consistent look and feel, better control over loading states, and improved accessibility (ARIA roles, keyboard support).
**Action:** Use the `ConfirmDialog` component in `components/shared/confirm-dialog.tsx` for destructive actions. Ensure it supports `isLoading` for async feedback and implements basic accessibility like Escape key support and ARIA alertdialog roles.
