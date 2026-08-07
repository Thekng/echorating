# Palette's Journal

## 2026-07-05 - Improving Destructive Action Safety
**Learning:** Using `window.confirm` for destructive actions like deleting logs is functional but lacks visual consistency and accessibility features like loading states. Replacing it with a custom `ConfirmDialog` improves the micro-UX by providing a non-blocking, themed, and accessible interface.
**Action:** Always prefer `ConfirmDialog` over `window.confirm` for destructive organization-level actions to ensure a consistent and safe user experience.
