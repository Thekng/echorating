## 2025-06-23 - [Accessible Confirmation Dialogs]
**Learning:** Standard browser `window.confirm` dialogs are accessible but lack visual consistency and don't support loading states for async actions. A custom accessible `ConfirmDialog` must implement ARIA `alertdialog`, handle the `Escape` key, and provide clear loading feedback using `useTransition`.
**Action:** Use the enhanced `ConfirmDialog` pattern with `autoFocus` on the primary action button to ensure a smooth, keyboard-friendly experience for destructive actions.
