## 2025-05-14 - Accessible Confirmation Dialogs
**Learning:** Native `window.confirm` is poor for accessibility and UX as it lacks styling, doesn't support async loading states, and isn't keyboard-friendly (Escape key/focus trap) by default in a way that matches the app's design system. Replacing it with a custom `ConfirmDialog` that uses `role="alertdialog"` and `aria-modal="true"` improves both.
**Action:** Always use `ConfirmDialog` from `components/shared/confirm-dialog.tsx` for destructive actions, and integrate it with `useTransition` for visual feedback during pending states.
