## 2025-05-15 - [Accessible Confirm Dialog]
**Learning:** Replacing native `window.confirm` with a custom dialog improves UX but requires careful focus management and ARIA attributes (role="alertdialog") to remain accessible. Using `useId` for stable labeling and ensuring focus starts correctly is key.
**Action:** Always use the custom `ConfirmDialog` for destructive actions and ensure it supports loading states to prevent double-submissions.
