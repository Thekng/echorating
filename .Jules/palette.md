## 2026-08-29 - TimeInput Label-Input Association & Button ARIA Labels
**Learning:** Adding explicit `useId()` fallback for input component IDs ensures seamless `htmlFor` / `id` label associations even when parent callers omit an explicit `id` prop, while adding `focus-visible:ring-1` to inline action buttons provides vital feedback for keyboard navigation users.
**Action:** Always provide auto-generated IDs via `useId()` when wrapping inputs with standard `<label>` components, and ensure inline icon buttons include both `aria-label` and `focus-visible` ring utilities.
