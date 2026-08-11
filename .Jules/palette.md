# Palette's Journal

🎨 A log of critical UX/accessibility learnings.

## 2026-08-11 - Accessible Custom Confirm Dialogs over Native Dialogs
**Learning:** Browser native `window.confirm` is highly intrusive, blocks the browser's main thread, and cannot be styled to match custom design systems or provide visual loading indicators during asynchronous network requests. Replacing it with a custom `ConfirmDialog` implementing `role="alertdialog"` and `useTransition` ensures non-blocking UI interactions, proper accessibility for screen readers (via `aria-labelledby`, `aria-describedby`, and `aria-modal`), and a beautiful, feedback-driven delete flow with disabled cancel triggers and loading spinners.
**Action:** Always prefer custom, accessible alert dialogs over browser-native confirms for critical and destructive actions to maintain thread integrity, consistency, and clean assistive technology support.
