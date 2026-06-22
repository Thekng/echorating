## 2025-05-22 - Enhanced Confirmation Dialog Patterns
**Learning:** Replacing native `window.confirm` with a custom `ConfirmDialog` improves accessibility (ARIA, keyboard navigation) and allows for integrated loading states via React's `useTransition`.
**Action:** Use `ConfirmDialog` with `isLoading` and `autoFocus` on the primary button for all destructive actions to ensure a consistent, accessible, and responsive user experience.
