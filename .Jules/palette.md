## 2026-08-28 - ARIA Combobox pattern for autocomplete search inputs
**Learning:** Adding explicit WAI-ARIA combobox attributes (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) and keyboard handlers (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) to search inputs with dropdown lists dramatically improves screen reader and keyboard accessibility without requiring complex external dependencies.
**Action:** Always include keyboard selection state management and ARIA combobox semantics when building custom dropdown search or autocomplete components.
