## 2025-05-15 - Accessible Custom Confirmation Dialog
**Learning:** Replacing native `window.confirm` with a custom dialog improves visual consistency and allows for asynchronous loading states, but requires careful attention to ARIA roles (`alertdialog`), keyboard navigation (Escape key), and focus management (`autoFocus`) to maintain accessibility.
**Action:** Use the enhanced `ConfirmDialog` component with `useTransition` for destructive actions to provide immediate feedback and maintain a keyboard-friendly experience.
