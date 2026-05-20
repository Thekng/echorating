## 2025-05-14 - Accessible Custom Dialogs
**Learning:** Replacing native browser `window.confirm` with custom dialogs improves brand consistency but requires careful focus management (trapping focus inside the modal and restoring it on close) and ARIA attributes (`role="alertdialog"`, `aria-modal="true"`) to maintain accessibility.
**Action:** Always include a focus trap and Escape key listener in custom dialogs, and ensure they are under 50 lines to meet the micro-UX agent's scope constraints.
