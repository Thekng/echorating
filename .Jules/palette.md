## 2025-05-15 - Accessible Custom Dialog Pattern
**Learning:** Replacing native 'window.confirm' with a custom Dialog improves UX through consistent styling and better feedback (loading states). To maintain accessibility, custom dialogs MUST implement the 'alertdialog' role, focus trapping, Escape key support, and focus restoration to the previously active element.
**Action:** Use the refactored 'ConfirmDialog' for all destructive actions. Ensure 'useTransition' is used to provide loading feedback through the 'isLoading' prop.
