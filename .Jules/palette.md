## 2026-09-20 - Focus Retention on Input Helper Buttons

**Learning:** Clicking inline helper or increment buttons within text input controls natively steals browser focus from the text input field, triggering unwanted blur events and disturbing keyboard flow.
**Action:** Attach `onMouseDown={(e) => e.preventDefault()}` on interactive inline helper buttons so mouse clicks perform the action without stripping focus from the parent input.
