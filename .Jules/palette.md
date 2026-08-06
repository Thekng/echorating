## 2026-08-06 - Replacing window.confirm with accessible Radix ConfirmDialog
**Learning:** Replacing standard blocking window.confirm with an accessible modal using Radix UI Dialog primitives and useTransition improves non-blocking interactivity and visual consistency. In React 18 environments, using a dedicated loading state alongside startTransition is crucial for highly accurate pending visual feedback.
**Action:** Always replace standard window.confirm with a custom Radix-based ConfirmDialog that supports both controlled open/onOpenChange and backwards-compatible conditional rendering.
