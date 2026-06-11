## 2025-06-11 - Custom Confirm Dialog and Form Accessibility
**Learning:** Replacing native `window.confirm` with a custom `ConfirmDialog` improves UX by providing a non-blocking, styled interface that fits the design system. Proper label-input association in dynamic forms is crucial for screen reader accessibility.
**Action:** Use `ConfirmDialog` with `useTransition` for destructive actions to provide loading feedback and maintain accessible focus management. Ensure all form fields generated in loops have unique IDs for labels.
