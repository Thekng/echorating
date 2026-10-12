## 2026-10-12 - Preserving Input Focus in Stepper & Quick Action Buttons
**Learning:** Adding `onMouseDown={(e) => e.preventDefault()}` to quick action / stepper buttons (+1m/-1m) inside text input controls prevents focus from shifting away from the text input element during interaction.
**Action:** Always include `onMouseDown={(e) => e.preventDefault()}` on auxiliary input control buttons alongside accessible ARIA labels to ensure a smooth keyboard and screen-reader experience without focus flickering.
