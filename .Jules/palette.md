## 2026-09-24 - Focus Preservation and Label Linkage on Time Inputs

**Learning:** Quick action buttons (+1m, -1m, clear) embedded inside inputs steal input focus upon click unless `onMouseDown={(e) => e.preventDefault()}` is explicitly applied. Additionally, inputs rendered inside complex forms require unique `id` / `htmlFor` linkage so screen reader users can hear proper input context.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` to embedded helper/action buttons and pass `id` or fallback via `useId()` for `<label htmlFor="...">` in custom input components.
