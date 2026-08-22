## 2026-08-22 - Combobox Accessibility Attributes on Text Inputs
**Learning:** Standard `<input type="text">` elements default to the `textbox` role, which causes ESLint `jsx-a11y/role-supports-aria-props` to flag `aria-expanded` as unsupported. Adding `role="combobox"` explicitly to search inputs with dropdown lists enables full screen reader combobox semantics (`aria-expanded`, `aria-controls`) cleanly.
**Action:** Always include `role="combobox"` on input fields that toggle popup selection dropdowns.
