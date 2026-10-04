## 2026-10-04 - Input focus preservation on quick adjustment buttons
**Learning:** In text inputs featuring helper action buttons (such as +1m/-1m increment buttons or clear buttons), clicking the buttons normally triggers default mouse-down behavior that shifts focus away from the input element. Adding `onMouseDown={(e) => e.preventDefault()}` on these buttons prevents input focus loss while keeping quick actions smooth and uninterrupted.
**Action:** Apply `onMouseDown={(e) => e.preventDefault()}` on inline input action buttons alongside proper `aria-label` attributes.
