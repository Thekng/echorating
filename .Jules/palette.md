## 2025-05-14 - [Accessible Confirmation Dialogs]
**Learning:** Browser native `window.confirm` is not accessible for screen readers and does not match custom UI themes. A custom accessible dialog requires proper ARIA roles (`alertdialog`), focus management (trap and restoration), and keyboard support (Escape key).
**Action:** Use the enhanced `ConfirmDialog` in `components/shared/confirm-dialog.tsx` for all destructive actions.

## 2025-05-14 - [Async Feedback in Dialogs]
**Learning:** When using `ConfirmDialog` for async operations within `useTransition`, clearing the state that unmounts the dialog (e.g., `setItemToDelete(null)`) must wait until AFTER the async action finishes to provide proper loading feedback.
**Action:** Wrap the async call and state reset in `startDeleteTransition`.
