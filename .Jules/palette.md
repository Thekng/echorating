## 2026-07-12 - [Accessible Confirmation Pattern]
**Learning:** Standardizing asynchronous destructive actions with a custom `ConfirmDialog` using `useTransition` provides immediate visual feedback (loading states) and ensures accessibility (ARIA roles, focus trapping) that native `window.confirm` lacks.
**Action:** Always prefer `ConfirmDialog` over `window.confirm` for destructive actions. Integrate with `useTransition` to manage pending states and avoid blocking the main thread.
