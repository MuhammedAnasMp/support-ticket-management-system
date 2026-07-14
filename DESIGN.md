---
name: Systematic Integrity
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#FFFFFF'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#414754'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#727785'
  outline-variant: '#E0E2E6'
  surface-tint: '#005bc0'
  primary: '#005bbf'
  on-primary: '#ffffff'
  primary-container: '#1a73e8'
  on-primary-container: '#ffffff'
  inverse-primary: '#adc7ff'
  secondary: '#3f6377'
  on-secondary: '#ffffff'
  secondary-container: '#c0e5fd'
  on-secondary-container: '#43677b'
  tertiary: '#9e4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#c55500'
  on-tertiary-container: '#0e0200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc7ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#c3e7ff'
  secondary-fixed-dim: '#a7cbe3'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#264b5e'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783100'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  text-primary: '#202124'
  text-secondary: '#444746'
  brand-cobalt: '#0B57D0'
  dark-surface: '#131416'
  dark-surface-container: '#1c1d1f'
  dark-surface-container-low: '#232427'
  dark-surface-container-high: '#2a2b2e'
  dark-on-surface: '#e3e3e4'
  dark-on-surface-variant: '#c4c7c5'
  dark-outline-variant: '#2e3033'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  column-gap: 24px
  row-gap: 24px
---

## Brand & Style
This design system is engineered for high-density **maintenance tracking and asset management**, prioritizing stability, clarity, and utilitarian efficiency. Inspired by modern productivity suites, the aesthetic is **Corporate / Modern** with a focus on systematic integrity.

The target audience consists of maintenance operators, technicians, and facility managers who need to log work orders, track asset health, and monitor schedules while minimizing cognitive load. The UI evokes a sense of "quiet competence" — it stays out of the way until needed, using generous whitespace to define relationships rather than decorative elements. Every visual choice is optimized for long-session readability and rhythmic consistency, since technicians and supervisors may reference this system for hours during a shift.

## Colors
The palette is centered around "Google Blue" (#1A73E8), used purposefully for primary actions and focus states to guide the user's eye. The foundation of the system relies on a tiered neutral structure:

- **Surface (#F8F9FA):** The lowest layer, used for page backgrounds to provide soft contrast against containers.
- **Surface Container (#FFFFFF):** The workspace layer. All cards, data tables, work-order forms, and asset detail panels sit on this level.
- **Text Tiers:** High-contrast Dark Gray (#202124) is reserved for content and headers, while Mid-Gray (#444746) is used for secondary labels and metadata (timestamps, asset IDs, technician names).
- **Accents:** A soft blue (#C2E7FF) acts as a high-visibility background for active chips or selected navigation items (e.g. "In Progress" work orders).
- **Status colors:** Use `error` (#BA1A1A) for overdue/critical maintenance, `tertiary` (#9E4300) for warning/due-soon states, and `secondary` (#3F6377) for scheduled/informational states.

### Dark Theme
Dark theme is a first-class requirement, not an inverted overlay:

- **Dark Surface (#131416):** Page background in dark mode.
- **Dark Surface Container (#1C1D1F):** Card and panel background.
- **Dark Surface Container Low (#232427):** Input fields, table row alternates.
- **Dark Surface Container High (#2A2B2E):** Modals, dropdown menus, elevated surfaces.
- **Dark On-Surface (#E3E3E4):** Primary text; **Dark On-Surface-Variant (#C4C7C5):** secondary text.
- Primary Blue (#1A73E8) and status colors remain consistent across themes for recognizability — only surfaces and text invert.
- Theme switching is user-toggleable and should be driven by a Redux theme slice (see Tech Stack below), not OS-only detection.

## Typography
Inter is utilized exclusively across all hierarchy levels to ensure a clean, functional appearance. It must be loaded as **Google Inter** (Google Fonts or self-hosted `next/font/google`), never a system-font fallback. The scale is built on a modular rhythm, prioritizing legibility in data-heavy views.

- **Headlines:** Use semi-bold weights with slight negative letter-spacing to appear compact and authoritative.
- **Body:** The default for prose and data is `body-md` (14px), providing a balance between information density and readability.
- **Labels:** Medium weights are used for buttons, navigation, and table headers to distinguish them from editable data.
- **Numeric/ID values:** Asset IDs, work order numbers, and meter readings should use a monospace treatment for scanability.
- **Scale:** On mobile, large headlines scale down to prevent excessive wrapping while maintaining hierarchy.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Navigation and sidebars are fixed, while the primary content area spans a fluid grid.

- **Grid:** A 12-column grid system is used for desktop (breakpoints at 1440px+ and 1024px).
- **Rhythm:** An 8px base unit (the "Round Eight" philosophy) governs all padding and margins.
- **Desktop:** 32px external margins with 24px gutters. Content cards should span 3, 4, 6, or 12 columns.
- **Tablet:** 8-column grid with 24px margins.
- **Mobile:** 4-column grid with 16px margins. Complex data tables (e.g. asset lists, work-order logs) must reflow into card-based lists on mobile devices.
- **Mobile-first is mandatory:** every new screen and component must be verified at mobile width before desktop; technicians frequently use this system from a phone or tablet in the field.

## Elevation & Depth
This design system uses **Tonal Layers** supplemented by subtle **Ambient Shadows** to communicate hierarchy.

- **Level 0 (Surface):** The background layer. No shadow.
- **Level 1 (Card/Container):** Primary work surface, with a soft, diffused shadow (0px 1px 3px rgba(0,0,0,0.1)).
- **Level 2 (Navigation/Menus):** Elements that float above the workspace (dropdowns, modals) use a deeper shadow (0px 4px 12px rgba(0,0,0,0.15)) to indicate focus.
- **Interaction:** On hover, clickable cards should subtly increase their shadow depth and move -1px on the Y-axis. Use Framer Motion for this transition (see Tech Stack).

## Shapes
The shape language is disciplined and consistent. A standard **8px (0.5rem)** radius is applied to almost all UI components, including buttons, input fields, and cards. This "Softened Geometry" strikes a balance between the rigid look of 0px corners and the overly casual nature of fully rounded shapes.

- **Large Containers:** Use `rounded-lg` (1rem) for major dashboard sections (asset overview, work-order summary) to soften the visual impact of large blocks.
- **Small Elements:** Icons and tags may use `rounded-sm` (0.25rem) if space is constrained.

## Components
- **Buttons:** Primary buttons use a solid #1A73E8 fill with white text. Secondary buttons use a #1A73E8 outline with no fill. All buttons have an 8px corner radius and `label-lg` typography.
  - **Icons:** Add a Lucide icon only when it aids recognition or the button is a common/repeated action (Save, Add, Delete, Export, Filter, Refresh) — icon-left, text-right, 16–18px size, matched to the button's text color. Icon-only buttons (e.g. table row actions) are square/circular, use `rounded` or `rounded-full`, and must include an `aria-label` and a tooltip on hover. Don't add icons to buttons where the icon adds no meaning (e.g. "Cancel", "Save Changes" in a modal) — skip rather than force one.
  - **Loading state:** On click or form submit, the button enters a disabled, non-interactive loading state **in place** — same width/height (never resize or reflow), label optionally hidden or dimmed, and a small spinner rendered **inside the button**, replacing or sitting beside the icon slot (centered if the label is hidden, left-aligned before the label if kept). Never show a page-level or overlay loader for a single button action — the loader is local to the button that was clicked. Spinner color inherits the button's text color (white on primary, Primary Blue on secondary/outline) and uses Framer Motion for a continuous rotation. Re-enable the button and restore its default state on success or error; show a toast/alert (see Alerts) for the result rather than changing the button's own label to "Success"/"Failed".
- **Input Fields:** Outlined style with a 1px border (#E0E2E6). Labels use `label-md` floating or positioned above the field. On focus, the border thickens to 2px and changes to Primary Blue.
- **Cards:** White (or dark-surface-container) background, 8px radius, and Level 1 elevation. Use internal padding of 24px (3x base) for standard dashboard cards.
- **Chips:** Used for maintenance status (e.g. "Overdue", "Scheduled", "Completed"). These should have a light tinted background based on status (e.g. light blue #C2E7FF for "Active") with 4px or 8px rounding.
- **Data Tables:** High-density rows (48px height) with 1px horizontal dividers. Header cells use `label-sm` with all-caps and increased letter spacing. Reflow to stacked cards below the tablet breakpoint.
- **Navigation Rail:** A slim vertical sidebar (72px–240px) using neutral surface color as the background and Primary Blue for the active state indicator.
- **Alerts / Toasts:** Use status colors for background tint (error/warning/success/info) with matching icon from Lucide, `label-lg` title + `body-md` description.
- **Modals:** Level 2 elevation, `rounded-lg`, max-width capped per breakpoint, entrance/exit handled via Framer Motion (fade + scale, ~150–200ms).
- **Dropdowns / Selects:** Match Input Field styling when closed; open state uses Level 2 elevation panel.
- **Checkboxes / Toggles:** 8px corner radius for checkboxes; toggle switches use `rounded-full`, Primary Blue when active, `outline-variant` when inactive.
- **Accordion:** `surface-container` background, chevron icon (Lucide `ChevronDown`) rotates on expand via Framer Motion, no border — use elevation/spacing to separate.
- **Slider:** Thin track (2–4px height), `rounded-full` ends, Primary Blue fill for the active range, circular thumb with Level 1 elevation.

All components above are **shared/reusable** — build once under a common component library path (e.g. `components/ui/`) and consume everywhere; no one-off, page-local variants.

## Loading & Async States
Loading feedback should always be scoped to the smallest element that triggered the API call — never block the whole screen for a local action.

- **Button click / form submit:** The loader lives **inside the button itself** (see Buttons above), not as a full-page overlay or spinner elsewhere on screen. This applies to primary actions, secondary actions, and icon-only buttons alike.
- **Inline/section data fetch** (e.g. loading a table, a card's contents, a chart): use a skeleton placeholder matching the shape of the content (rows for tables, block for cards) rather than a centered spinner — skeletons use `surface-container-high` with a subtle shimmer animation (Framer Motion).
- **Full-page/route loads:** reserved only for initial page load or full navigation — a centered spinner or top-of-page progress bar in Primary Blue is acceptable here, but this must not be reused for individual button or form actions.
- **Disabled state during load:** any button, input, or control involved in an in-flight request is disabled to prevent duplicate submissions, and returns to its normal interactive state once the request resolves (success or error).
- **Errors:** surface via the Alert/Toast component (status = error), not by leaving the button stuck in a loading state or by silently failing.

## Tech Stack & Implementation Rules
- **Font:** Google Inter, loaded via `next/font/google` (or equivalent), applied globally — no fallback system fonts in production.
- **Icons:** Lucide React (`lucide-react`) exclusively — no mixed icon libraries.
- **Motion:** Framer Motion for all transitions, hover states, modal/accordion enter-exit, and page-level micro-interactions.
- **State management:** Redux (Redux Toolkit) for global app state — theme, auth, work-order/asset data caches, and cross-page UI state. Local component state (e.g. form field values) can remain in React state.
- **Theming:** Light and dark themes both required, token-driven (see Colors above), toggle persisted via Redux + storage.
- **Responsiveness:** Mobile-first, fully responsive across mobile, tablet, and desktop breakpoints for every screen — no desktop-only components.
- **Component library reference:** Use TailGrids as the reference/component source (via its MCP) when scaffolding new reusable components, then re-skin to match this design system's tokens (colors, typography, radius, spacing) rather than using its default styling as-is.
- **Reusability rule:** Tables, alerts, modals, buttons, dropdowns, selects, checkboxes, accordions, toggle buttons, and sliders must all be built as shared, prop-driven components — never duplicated per-page.




dont hardcode color in code 

based on the css change it should reflect in the entire code , mainly the color (button ,bg , shadonw , font , all ) 

all ui control should in tied with tailwind in one file . 

