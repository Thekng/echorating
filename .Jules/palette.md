## 2026-08-21 - Accessible Search and ComboBox Inputs
**Learning:** Search and combo box components often lack explicit `aria-label` attributes on inputs and clear buttons, and miss `type="button"` on embedded buttons, which can cause screen reader confusion or accidental form submission.
**Action:** Always provide `aria-label` for search input and clear button, add `type="button"`, mark decorative icons with `aria-hidden="true"`, and support `Escape` and `Enter` key bindings.
