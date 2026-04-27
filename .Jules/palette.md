## 2026-04-27 - [Accessible Confirmation Dialogs]
**Learning:** Replacing native 'window.confirm' with a custom, accessible 'ConfirmDialog' improves UX consistency and provides better screen reader support (role='alertdialog').
**Action:** Use 'ConfirmDialog' from 'components/shared/confirm-dialog.tsx' for all destructive actions, ensuring 'autoFocus' is on the Cancel button to prevent accidental confirmation.
