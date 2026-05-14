## 2025-05-14 - Accessible Custom Dialogs
**Learning:** When replacing native browser 'window.confirm' with custom dialogs, it is critical to manage focus correctly. This includes trapping focus within the dialog, supporting the Escape key, and crucially, returning focus to the triggering element upon closing to prevent keyboard/screen reader users from losing their place.
**Action:** Always implement a focus trap and a 'previousFocus' ref to restore focus on unmount in custom modal/dialog components.
