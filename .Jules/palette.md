## 2025-05-15 - Accessible Confirm Dialog Pattern
**Learning:** Replacing native `window.confirm` with a custom dialog improves theme consistency but requires manual focus management (trap, restoration) and keyboard support (Escape) to maintain accessibility standards.
**Action:** Use the `ConfirmDialog` component in `components/shared` and wrap async actions in `useTransition` to provide loading feedback within the dialog itself.

## 2025-05-15 - React Ref Management
**Learning:** Updating `useRef` values during the render phase violates React's pure rendering principles and can trigger ESLint errors (`react-hooks/refs`).
**Action:** Always wrap ref updates (e.g., `ref.current = prop`) in a `useEffect` hook to ensure they happen after the render is committed.
