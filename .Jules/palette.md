## 2025-05-14 - [Accessible Confirmation Dialog]
**Learning:** Custom confirmation dialogs should prioritize `autoFocus` on the primary action button and `Escape` key listeners to provide a smooth keyboard experience, especially when replacing `window.confirm`. Using `useTransition` for server actions in dialogs allows for clean loading states without complex local state management.
**Action:** Always include `autoFocus` on the "Confirm/Delete" button and add a global `Escape` listener in custom modals. Use `useTransition` to drive `isLoading` props.
