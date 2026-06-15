## 2025-05-22 - [ConfirmDialog Accessibility & Focus Management]
**Learning:** For destructive actions in custom dialogs, it is best practice to focus the non-destructive action (e.g., "Cancel") by default to prevent accidental data loss from rapid keyboard interactions.
**Action:** Use `autoFocus` on the cancel button in `ConfirmDialog` and ensure the dialog implements the `alertdialog` role for proper screen reader communication.
