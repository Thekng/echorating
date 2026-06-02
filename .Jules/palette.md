## 2025-05-14 - [Accessible Confirmation Dialogs]
**Learning:** Browser native 'window.confirm' is not accessible for screen readers and doesn't match the application's design system. A custom dialog with focus trapping and 'aria-modal="true"' provides a much better UX.
**Action:** Always prefer 'ConfirmDialog' for destructive actions, ensuring it handles focus management and loading states via 'useTransition'.
