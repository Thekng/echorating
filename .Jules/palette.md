## 2025-05-14 - Accessible ConfirmDialog Pattern
**Learning:** Replaced native `window.confirm` with a custom `ConfirmDialog` component that provides a consistent theme and significantly better accessibility (focus trap, ARIA roles, keyboard navigation).
**Action:** Always use `ConfirmDialog` for destructive actions and ensure it implements `role="alertdialog"` with a focus trap and Escape key support.
