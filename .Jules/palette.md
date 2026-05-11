## 2025-05-15 - [Accessible Confirm Dialog Pattern]
**Learning:** Replacing native browser `window.confirm` with a custom dialog improves accessibility (ARIA, focus traps) and allows for async loading feedback (e.g., "Processing..."), which is critical for destructive operations. However, ensure manual focus traps are robust or use established primitives if available.
**Action:** Use the enhanced `ConfirmDialog` component in `components/shared/confirm-dialog.tsx` for all destructive actions to maintain consistent UX and accessibility standards.
