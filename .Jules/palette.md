## 2025-05-15 - [Accessible Confirm Dialog Pattern]
**Learning:** Replacing native `window.confirm` with a custom dialog improves UX but requires careful handling of focus management and asynchronous state to avoid a jarring experience.
**Action:** Use `useTransition` for server actions within custom dialogs, providing a clear loading state (e.g., a spinner inside the button) and ensuring the dialog only closes after the operation completes or fails (using `try...finally`). Add `autoFocus` to the primary action button and handle the `Escape` key for accessibility.
