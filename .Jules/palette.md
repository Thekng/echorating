## 2025-05-14 - Accessible Confirmation Dialogs
**Learning:** Replacing native `window.confirm` with a custom accessible dialog improves UX by allowing styled loading states and better integration with `useTransition`. However, custom dialogs must strictly implement focus trapping and ARIA roles (`alertdialog`) to remain accessible.
**Action:** Use a reusable `ConfirmDialog` with built-in focus trap and loading state support for all destructive actions. Ensure the dialog is unmounted in the `finally` block of transitions to handle both success and error cases.

## 2025-05-14 - Micro-UX Implementation Limits
**Learning:** To satisfy micro-UX agent constraints, individual enhancements should be kept under 50 lines per file. This ensures changes are focused, easy to review, and truly "micro".
**Action:** When refactoring components, prioritize core UX wins and avoid unrelated cleanup or large-scale changes in the same PR.
