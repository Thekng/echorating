## 2026-09-13 - Focus retention on quick input adjustments

**Learning:** Clicking quick action buttons (like +1m/-1m or clear) adjacent to text inputs steals focus away from the input element unless `onMouseDown={(e) => e.preventDefault()}` is explicitly declared on the button handlers.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` alongside `aria-label` when implementing helper buttons inside or alongside text inputs.
