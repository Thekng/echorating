## 2025-05-22 - Replacing window.confirm with accessible ConfirmDialog
**Learning:** Replacing native browser confirm dialogs with custom 'alertdialog' components improves UX by maintaining theme consistency and preventing thread-blocking, but requires careful management of 'useTransition' and state reset to ensure the dialog closes only after the async action succeeds.
**Action:** Always use the project's ConfirmDialog with isLoading prop and focus management for destructive actions like deletions.
