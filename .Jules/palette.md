## 2025-05-14 - Accessible ConfirmDialog with React Transition
**Learning:** Native `window.confirm` is inaccessible and lacks styling. A custom `ConfirmDialog` should use `useTransition` for async actions, implement ARIA roles, and handle keyboard navigation (Escape key and autoFocus).
**Action:** Use `ConfirmDialog` from `components/shared/` instead of `window.confirm` for all destructive actions to ensure consistency and accessibility.
