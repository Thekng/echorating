## 2026-07-15 - [Enhanced ConfirmDialog for Accessible Deletions]
**Learning:** Replacing 'window.confirm' with a custom, accessible 'ConfirmDialog' (using ARIA 'alertdialog' role and 'useTransition') is a preferred Palette UX pattern for destructive actions to avoid blocking the main thread and provide consistent visual feedback.
**Action:** Use Radix UI Dialog primitives and managed state (useTransition) for all destructive confirmations to ensure smooth interaction and screen reader compatibility.
