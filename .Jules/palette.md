## 2024-05-22 - [Custom Accessible Confirm Dialog]
**Learning:** Browser native `window.confirm` is inaccessible and inconsistent with modern UI. A custom dialog using Radix-like patterns (ARIA roles, focus management, backdrop click dismissal) provides a significantly better UX, especially when paired with `useTransition` for async feedback.
**Action:** Replace `window.confirm` with the enhanced `ConfirmDialog` component. Ensure `autoFocus` is on the primary action and handle `Escape` key for accessibility.
