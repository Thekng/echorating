## 2026-10-22 - Accessible Search Input Dropdowns
**Learning:** Icon-only clear buttons inside search inputs often miss `type="button"` and `aria-label`, causing screen reader invisibility and risk of unintended form submit actions when used inside forms. Additionally, dynamically displayed empty state notices require `role="status"` and `aria-live="polite"` so screen reader users are informed when no matches exist.
**Action:** Always include `type="button"`, `aria-label="Clear search"`, `role="status"`, and `aria-live="polite"` in search components with live drop-down results.
