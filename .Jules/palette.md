## 2026-07-22 - Radix UI Dialog Mounting and Conditional Rendering
**Learning:** When using Radix UI's Dialog primitives, the Dialog.Root requires an open prop (e.g. open={true}) to render and be visible if there is no explicit Dialog.Trigger element. Simply mounting the component conditionally (e.g. {logToDelete && <ConfirmDialog />}) is not enough if the internal Root does not default to open.
**Action:** Always provide a default open={true} value in the ConfirmDialog props or pass open={true} explicitly during conditional rendering to ensure the dialog displays correctly.
