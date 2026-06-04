## 2025-05-15 - [Accessible Confirm Dialog Pattern]
**Learning:** Replacing native `window.confirm` with a custom accessible dialog (`role="alertdialog"`) improves UX by allowing loading states and consistent styling, but requires careful focus management and keyboard handling (Escape key, Tab trapping).
**Action:** Use a reusable `ConfirmDialog` component with `useTransition` for destructive async actions to provide immediate feedback and maintain accessibility.
