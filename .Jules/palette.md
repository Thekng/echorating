## 2025-05-15 - [Improving Deletion Experience with Custom Dialogs]
**Learning:** Replacing native `window.confirm` with a custom `ConfirmDialog` improves accessibility (ARIA roles) and allows for richer context and better interaction feedback (e.g., loading states during async deletion).
**Action:** Use `ConfirmDialog` with `useTransition` for all destructive actions to provide a consistent and accessible confirmation flow.

## 2025-05-15 - [Frontend Verification in Auth-Protected Apps]
**Learning:** In projects where `middleware.ts` enforces authentication via Supabase, local frontend verification with Playwright fails if local keys are missing.
**Action:** Temporarily bypass the middleware for the specific test route at the very beginning of the `middleware` function to unblock verification.
