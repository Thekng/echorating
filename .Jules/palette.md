## 2026-06-12 - Accessible Radio Selection Metrics
**Learning:** In dynamic forms where selection metrics can be rendered as radio buttons, a standard `label htmlFor` approach isn't sufficient for the group itself. The group needs to be treated as a `radiogroup` and associated with the section heading/label.
**Action:** Use `role="radiogroup"` and `aria-labelledby` pointing to the label's ID for radio groups, while using `htmlFor` for single input types (select, input, textarea).
