## 2025-05-06 - Accessible Confirmation Dialogs
**Learning:** Browser-native `window.confirm` lacks styling consistency and accessibility features like ARIA roles and loading feedback during asynchronous actions. Replacing it with a custom `ConfirmDialog` using `role="alertdialog"` and `useTransition` improves both UX and a11y.
**Action:** Use the custom `ConfirmDialog` for all destructive actions and ensure `isLoading` is passed to provide feedback during server actions.
