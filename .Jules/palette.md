## 2026-09-17 - Combobox Accessibility in Search Inputs
**Learning:** When adding `role="combobox"` to search text inputs with dropdown suggestions, `aria-controls` should be conditionally assigned only when the dropdown listbox is visible to prevent screen readers from referencing missing DOM elements when closed.
**Action:** Use `aria-controls={isOpen && items.length > 0 ? 'listbox-id' : undefined}` on combobox inputs.
