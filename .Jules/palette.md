## 2026-07-13 - Accessible ConfirmDialog Pattern
**Learning:** Replacing `window.confirm` with a custom Radix UI-based `ConfirmDialog` provides a non-blocking, accessible (ARIA `alertdialog`), and stylable alternative. Integrating `useTransition` allows for delightful loading feedback ("Deleting...") within the dialog itself.
**Action:** When refactoring shared UI components, prioritize maintaining backward compatibility for conditional rendering while enabling managed state for more complex async workflows.
