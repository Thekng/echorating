## 2026-05-18 - Search Dropdowns Accessibility & ARIA Announcements
**Learning:** Custom search input dropdowns with conditional result lists require proper ARIA listbox/option hierarchy, input labels, explicit `type="button"`, and `role="status"` with `aria-live="polite"` on empty states so screen reader users are notified when queries yield no match.
**Action:** Always complement listbox result menus with dynamic status region announcements and Escape key dismissals in search-as-you-type components.
