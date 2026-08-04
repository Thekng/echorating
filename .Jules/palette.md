## 2026-08-04 - Replacing Native Window Confirm with Accessible Confirm Dialog
**Learning:** Using window.confirm blocks the main thread, offers no styling flexibility, and is poor for accessibility. A custom accessible ConfirmDialog built using Radix UI primitives with ARIA role 'alertdialog' and useTransition provides screen reader support, prevents UI thread blocking, and maintains a highly consistent UX.
**Action:** Always replace browser confirm/alert dialogs with custom accessible Radix UI dialog variants, defaulting open to true for backwards compatibility with conditional rendering.
