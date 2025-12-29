## 2024-05-22 - Icon-Only Button Accessibility
**Learning:** The codebase uses `lucide-react` icons inside buttons frequently without accompanying text labels. These are often missing `aria-label` attributes, making them invisible to screen readers.
**Action:** Systematically check all icon-only buttons (especially in common components like headers and panels) and add descriptive `aria-label` attributes.
