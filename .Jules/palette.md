## 2026-09-19 - Quick Adjustment Buttons Focus Loss

**Learning:** Quick action or helper buttons inside text input controls cause the text field to lose focus upon clicking unless default mousedown behavior is prevented.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` and descriptive `aria-label` attributes to inline quick-action and clear buttons.
