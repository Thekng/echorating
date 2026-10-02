## 2026-10-02 - TimeInput Focus & ARIA Improvement
**Learning:** In input components with quick adjustment or helper buttons (such as +1m/-1m or clear buttons), attaching `onMouseDown={(e) => e.preventDefault()}` to the buttons prevents mouse clicks from stealing keyboard focus away from the input element.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` and descriptive `aria-label` attributes to inline quick-action buttons on input fields.
