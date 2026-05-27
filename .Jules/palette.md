## 2025-05-15 - Accessible Confirm Dialog Pattern
**Learning:** Replaced native 'window.confirm' with a custom 'ConfirmDialog' that supports 'isLoading' props. Native browser dialogs are jarring and don't allow for loading states during async server actions.
**Action:** Always use the custom 'ConfirmDialog' for destructive actions and manage async state with 'useTransition' to provide consistent user feedback.
