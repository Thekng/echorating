## 2025-05-15 - [Standardizing Accessible Confirmation Dialogs]
**Learning:** Native `window.confirm` is suboptimal for modern UX as it lacks styling consistency, isn't easily accessible to screen readers (without additional context), and blocks the main thread. Implementing a custom, accessible `ConfirmDialog` using Radix primitives or standard ARIA roles (`alertdialog`) provides a smoother, brand-consistent experience.

**Action:** Replace all instances of `window.confirm` with the custom `ConfirmDialog`. Ensure the dialog supports `isLoading` states for async actions and handles keyboard events (Escape to cancel) for full accessibility compliance.
