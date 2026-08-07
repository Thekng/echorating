## 2026-07-07 - [Accessible Confirmation Pattern]
**Learning:** Replacing native 'window.confirm' with a themed Radix UI 'ConfirmDialog' (using 'alertdialog' role) improves both visual consistency and accessibility. Using 'useTransition' for the confirmation action allows for clear loading states within the dialog itself.
**Action:** Always prefer 'ConfirmDialog' for destructive actions to maintain design system consistency and provide better screen reader support.
