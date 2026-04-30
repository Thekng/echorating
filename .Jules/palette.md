## 2025-05-14 - [Accessible Confirmation Dialogs]
**Learning:** Destructive actions should use a custom, accessible `ConfirmDialog` instead of `window.confirm`. A good confirm dialog implements `role="alertdialog"`, `aria-modal="true"`, and provides an Escape key listener. Auto-focusing the "Cancel" button prevents accidental destructive actions.
**Action:** Use the `ConfirmDialog` component in `components/shared/confirm-dialog.tsx` for all deletion and irreversible actions. Ensure `isPending` state is passed to provide visual feedback during async transitions.
