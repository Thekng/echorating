## 2025-10-27 - Improving Metric Input Accessibility
**Learning:** For complex inputs like radio groups, linking a label via `htmlFor` to a wrapper `div` is invalid. Instead, the label should have a unique `id` and the wrapper should use `role="radiogroup"` with `aria-labelledby` pointing to that label's `id`. For standard inputs, `htmlFor` remains the best practice for accessibility.
**Action:** Always check the input type before applying `htmlFor`. Use `aria-labelledby` for group components like radio buttons or checkboxes to ensure correct screen reader behavior and valid HTML.
