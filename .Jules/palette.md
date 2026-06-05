## 2025-05-15 - [Accessible Confirm Dialogs]
**Learning:** Custom confirm dialogs provide a better UX than `window.confirm` by supporting loading states and consistent styling, but must implement focus trapping and ARIA roles (`role="alertdialog"`) for accessibility.
**Action:** Use the `ConfirmDialog` shared component for destructive actions, ensuring it remains under 50 lines and handles async states with `isLoading`.
