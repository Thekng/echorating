## 2026-07-09 - Accessibility in Dynamic Metric Forms
**Learning:** Linking labels to complex inputs in dynamic loops requires a dual approach: standard 'htmlFor' for simple inputs and 'role="radiogroup"' with 'aria-labelledby' for grouped inputs (like radio buttons) to ensure full screen reader coverage without ID collisions.
**Action:** Always generate stable, prefixed IDs for metrics in loops and apply them consistently to both the primary interactive element and any wrapping ARIA group.
