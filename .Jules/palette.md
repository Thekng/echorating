## 2025-05-12 - Combobox Accessibility Requirements
**Learning:** Elements with `role="combobox"` MUST have `aria-controls` and `aria-expanded` attributes defined on the same element to satisfy `jsx-a11y/role-has-required-aria-props`. Additionally, updating state synchronously within `useEffect` (e.g., resetting an index when a query changes) is flagged by `react-hooks/set-state-in-effect`; it's better to update such state directly in the event handler (e.g., `onChange`).
**Action:** Always check for required ARIA pairs when using specific roles and prefer state updates in event handlers over effects for synchronous resets.

## 2025-05-12 - Environment Isolation for Frontend Testing
**Learning:** Local dev servers may fail if Supabase environment variables are missing due to strict middleware checks. Creating a temporary unprotected route (e.g., `app/test-palette/page.tsx`) and temporarily bypassing middleware checks allows for visual verification without a full Supabase setup.
**Action:** Use temporary routes for isolated component testing but ensure all temporary files and middleware bypasses are reverted before submission.
