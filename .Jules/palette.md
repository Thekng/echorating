## 2025-05-14 - Accessible Custom Confirmation Dialogs
**Learning:** Replacing native 'window.confirm' with a custom 'ConfirmDialog' improves UX consistency and accessibility. Using 'useId' for 'aria-labelledby' and 'aria-describedby' ensures screen reader compatibility.
**Action:** Always prefer 'ConfirmDialog' over native 'window.confirm' for destructive actions in this project.
