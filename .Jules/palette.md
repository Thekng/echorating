## 2026-07-02 - Accessible and consistent confirmation dialogs
**Learning:** Using `useTransition` with a custom `ConfirmDialog` provides a much smoother UX than `window.confirm`. It allows for non-blocking UI interactions and explicit loading feedback while maintaining accessibility with `role="alertdialog"`.
**Action:** Always prefer `ConfirmDialog` over `window.confirm` for destructive actions, and ensure `useTransition` is used to manage the server action state and provide visual feedback.
