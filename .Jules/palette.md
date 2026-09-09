## 2026-09-09 - Accessible Search Inputs and Dropdown Lists
**Learning:** Search inputs with conditionally rendered result dropdowns require explicit `aria-label` attributes on both the search field and icon-only clear buttons, as well as `role="listbox"` and `role="option"` semantics for search results to ensure full screen reader accessibility.
**Action:** Always complement icon-only clear buttons in search controls with `aria-label="Clear search"` and apply visible focus indicators (`focus-visible:ring-ring`).
