## 2025-05-22 - Accessible Confirmation Dialogs
**Learning:** Replacing native `window.confirm` with a custom dialog improves UX by allowing loading states and consistent styling, but requires manual handling of accessibility features like focus trapping and Escape key listeners to remain inclusive.
**Action:** Always use the enhanced `ConfirmDialog` component for destructive actions and manage async states with `useTransition` to provide immediate user feedback.
