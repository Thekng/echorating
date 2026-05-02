## 2025-03-05 - [Accessible ConfirmDialog Pattern]
**Learning:** Replacing native `window.confirm` with a custom dialog improves visual consistency and allows for ARIA-compliant focus management and loading states. For destructive actions, `autoFocus` should be placed on the 'Cancel' button to prevent accidental confirmation via keyboard.
**Action:** Use `components/shared/confirm-dialog.tsx` for all destructive confirmations, ensuring `isLoading` is passed during async operations and ARIA attributes are correctly mapped with `useId`.
