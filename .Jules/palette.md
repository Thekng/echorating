## 2026-09-30 - Focus Retention on Quick Adjustment Buttons
**Learning:** In input components with quick-adjustment or helper buttons (like increment/decrement or clear buttons in `TimeInput`), adding `onMouseDown={(e) => e.preventDefault()}` on the buttons prevents focus from being stolen away from the text input upon clicking, preserving typing flow and keyboard focus.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` and descriptive `aria-label` attributes to inline control buttons attached to input fields.
