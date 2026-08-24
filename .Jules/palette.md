## 2026-08-24 - Radix DropdownMenu Form Submits & Roving Focus
**Learning:** In Radix UI DropdownMenu, forms that wrap trigger buttons (like logout forms) must enclose the button in `<DropdownMenuItem asChild>` so Radix forwards keyboard navigation listeners, roving focus, and `role="menuitem"` semantics.
**Action:** Always wrap form submission buttons inside Radix UI dropdown menus with `<DropdownMenuItem asChild>`.
