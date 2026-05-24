## 2025-05-14 - Accessible Confirmation Dialogs
**Learning:** Native `window.confirm` is inaccessible and inconsistent with modern UI themes. Implementing a custom, accessible `ConfirmDialog` with focus restoration and `isLoading` support significantly improves the micro-UX of destructive actions.
**Action:** Use the shared `ConfirmDialog` component for all destructive confirmations to ensure ARIA compliance and smooth state transitions.
