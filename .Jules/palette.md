## 2025-05-14 - [Accessible Confirm Dialog]
**Learning:** Native `window.confirm` is not accessible, cannot be styled to match the app's design system, and provides a poor user experience as it blocks the main thread. Replacing it with a custom, accessible dialog (using Radix-like patterns or similar) improves consistency and usability.
**Action:** Always use the custom `ConfirmDialog` component for destructive actions. Ensure it includes `role="alertdialog"`, `aria-modal="true"`, and appropriate `aria-labelledby`/`aria-describedby` attributes.
