## 2026-10-11 - Focus Preservation on Helper Control Buttons
**Learning:** Adding `onMouseDown={(e) => e.preventDefault()}` to inline helper/adjustment buttons (like `+1m`/`-1m` and clear buttons in input components) prevents clicking them from stealing focus away from the main input element.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` and descriptive `aria-label`s to quick-action helper buttons inside input fields.
