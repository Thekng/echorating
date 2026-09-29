## 2026-09-29 - Input Helper Button Focus Management
**Learning:** In text inputs with quick-adjust or clear buttons (such as time inputs or numeric incrementers), clicking helper buttons can cause the input field to lose focus, interrupting continuous keyboard/click input.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` alongside `aria-label` to input action buttons to prevent focus theft while preserving accessible screen reader interactions.
