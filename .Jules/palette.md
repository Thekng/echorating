## 2026-07-06 - Replacing window.confirm with Custom ConfirmDialog

**Learning:** Native blocking dialogs like `window.confirm` interrupt the main thread and offer poor accessibility and styling consistency. A custom `ConfirmDialog` built on Radix UI's `alertdialog` primitive provides better focus management, screen reader support, and a non-blocking user experience that matches the application's design system.

**Action:** Prefer using the project's `ConfirmDialog` for all destructive actions. Always ensure it handles `useTransition` for async server actions to provide visual feedback (like loading spinners) on the confirm button.
