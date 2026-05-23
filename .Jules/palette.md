## 2025-05-14 - [Accessible Custom Dialogs]
**Learning:** Browser-native `window.confirm` provides a poor, non-accessible user experience and lacks integration with React's state management (like `useTransition`). A custom `ConfirmDialog` with proper ARIA roles (`alertdialog`), focus traps, and loading states significantly improves UX and accessibility.
**Action:** Use the custom `ConfirmDialog` in `components/shared/confirm-dialog.tsx` for all destructive actions. Ensure `useTransition` is used to provide loading feedback during async operations.
