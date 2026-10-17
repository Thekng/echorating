## 2026-10-17 - Prevent Focus Theft on Input Action Buttons
**Learning:** Adding quick action or clear buttons inside text inputs can steal focus away from the text input on click. Using `onMouseDown={(e) => e.preventDefault()}` on the helper buttons keeps focus within the text field and avoids layout/cursor jumps.
**Action:** Always add `onMouseDown={(e) => e.preventDefault()}` and `type="button"` to helper/clear buttons inside text inputs.
