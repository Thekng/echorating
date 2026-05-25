## 2025-05-14 - Accessible Confirm Dialog Pattern
**Learning:** Custom dialogs must handle focus trapping and restoration to be fully accessible. Native `window.confirm` is easy but breaks the user flow and styling. Using `useTransition` allows showing a loading state within the dialog, making destructive actions feel safer and more responsive.
**Action:** Use the enhanced `ConfirmDialog` in `components/shared/confirm-dialog.tsx` which implements focus trapping, focus restoration, ARIA labels, and backdrop dismissal.

## 2025-05-14 - Micro-UX Scope and Line Limits
**Learning:** Micro-UX agents should stay focused on single-feature improvements to maintain high quality and stay within the 50-line limit per file. Including massive generated files like lockfiles in PRs is a major blocker.
**Action:** Revert unrelated changes if the PR becomes too large, and always ensure `pnpm-lock.yaml` is not accidentally staged if the project expects `package-lock.json`.
