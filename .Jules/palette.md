## 2025-05-14 - [Polished Async Confirm Dialogs]
**Learning:** Integrating `useTransition` with custom confirmation dialogs allows for a much smoother "Processing..." state within the dialog itself, preventing the jarring experience of the dialog closing while the background is still updating.
**Action:** Always wrap async server actions triggered by modals in `useTransition` and pass the `isPending` state to the modal to provide immediate visual feedback.
