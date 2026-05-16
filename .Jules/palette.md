## 2025-05-15 - Accessible Confirmation Dialogs
**Learning:** Replaced native `window.confirm` with a custom `ConfirmDialog` that implements `role="alertdialog"`, focus traps, and keyboard navigation. This significantly improves accessibility for screen reader users and keyboard-only users while providing a more cohesive brand experience.
**Action:** Use the enhanced `ConfirmDialog` for all destructive actions or important confirmations across the app. Ensure it receives a clear title, descriptive body, and handles asynchronous loading states to prevent double submissions.
