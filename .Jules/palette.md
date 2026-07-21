## 2026-07-21 - [Accessible ConfirmDialog UI Primitive]
**Learning:** Replacing blocking `window.confirm` calls with animated Radix-based Dialogs with role="alertdialog", appropriate transitions, autoFocus on the primary option, and keyboard/escape trap support drastically improves both the visual aesthetic and accessibility of destructive operations.
**Action:** When refactoring dialog prompts or action confirmations, always implement state-driven, accessible overlays using localized transitions to avoid blocking browser main-thread operations.
