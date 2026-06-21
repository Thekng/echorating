# Palette's UX Journal - EchoRating

## 2025-05-14 - Unifying Confirmation Patterns
**Learning:** The application had a basic `ConfirmDialog` component, yet `window.confirm` was still being used for destructive actions like deleting logs. Native confirms are not accessible via screen readers in a consistent way and don't match the application's design system.
**Action:** Enhance the shared `ConfirmDialog` with accessibility best practices (ARIA roles, focus management, keyboard support) and integrate it into core workflows to replace native browser primitives.
