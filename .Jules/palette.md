## 2026-10-01 - Preventing input focus loss on helper button clicks
**Learning:** In custom input components (e.g., `TimeInput`), quick adjustment or clear buttons inside the input container steal focus on click, closing focused-dependent controls or triggering premature validation blur.
**Action:** Add `onMouseDown={(e) => e.preventDefault()}` to helper buttons inside inputs so clicking them retains active focus on the text input field.
