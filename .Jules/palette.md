## 2025-04-25 - [Accessible Confirm Dialogs]
**Learning:** Native browser 'window.confirm' is not styleable and provides poor screen reader context. Using a custom 'ConfirmDialog' with 'role="alertdialog"' and 'aria-modal="true"' ensures interactions are accessible and consistent with the app's design system.
**Action:** Always replace 'window.confirm' with the custom 'ConfirmDialog' and use 'useTransition' for the 'onConfirm' action to provide visual feedback.
