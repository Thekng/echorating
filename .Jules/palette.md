## 2025-05-15 - Accessible Custom Confirmation Dialog
**Learning:** Browser-native `window.confirm` is poor for UX because it blocks the main thread and lacks styling consistency/accessibility features like loading states. Implementing a custom ARIA-compliant `alertdialog` with `useTransition` allows for non-blocking deletions with immediate visual feedback.
**Action:** Always replace `window.confirm` with a custom `ConfirmDialog` that supports `isLoading` and ARIA roles to improve both polish and accessibility.
