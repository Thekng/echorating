## 2026-09-06 - Search Input Accessibility Attributes & Clear Button Feedback
**Learning:** Icon-only clear buttons within search components require explicit `type="button"` and `aria-label="Clear search"`, while search inputs require `aria-expanded` and `aria-autocomplete` to communicate filtering state accurately to assistive technologies.
**Action:** When working with search filter components, always verify clear buttons have `aria-label` and the input element conveys its popup/autocomplete state.
