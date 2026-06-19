## 2026-06-19 - [Accessible Confirm Dialogs]
**Learning:** Standard browser `window.confirm` is disruptive and not stylable. Replacing it with a custom `ConfirmDialog` improves UX, but requires careful handling of focus, keyboard events (Escape), and ARIA roles (`alertdialog`) to maintain accessibility. Integrating it with `useTransition` allows for smooth loading states during async deletions.
**Action:** Always prefer `ConfirmDialog` over `window.confirm` for destructive actions. Ensure it supports `isLoading` states and keyboard shortcuts.
