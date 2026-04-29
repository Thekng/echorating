## 2025-05-22 - [Accessible Confirmation Dialogs]
**Learning:** Replacing native `window.confirm` with a custom component allows for better UX consistency and accessibility, but requires careful implementation of ARIA roles (`alertdialog`), focus management (auto-focusing the 'Cancel' button for destructive actions), and keyboard support (Escape key).
**Action:** Use the enhanced `ConfirmDialog` component for all future confirmation flows, ensuring it has `role="alertdialog"`, `aria-modal="true"`, and appropriate `aria-labelledby`/`aria-describedby` associations.
