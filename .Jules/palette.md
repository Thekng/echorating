## 2026-07-14 - Accessible Confirm Dialog Pattern
**Learning:** Standardizing on Radix UI AlertDialog for destructive actions provides a consistent, accessible (focus management, ARIA roles), and non-blocking alternative to window.confirm. Integrating it with useTransition allows for smooth loading feedback within the dialog itself.
**Action:** Use the enhanced ConfirmDialog component for all destructive organization or data-level deletions.
