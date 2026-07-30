# Design System v2.1 Additions

## Data Tables

### Table Engine

All data grids must use:
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
```yaml
Table Library: AG Grid
```

Do not use:

* Native HTML tables for business data
* Custom-built table implementations
* One-off table components

AG Grid becomes the single standardized table solution across the application.

---

## AG Grid Styling

AG Grid must inherit design tokens.

Never hardcode colors inside AG Grid themes.

Use CSS variables:

```css
--ag-background-color: var(--surface-container);
--ag-header-background-color: var(--surface-container-low);
--ag-border-color: var(--outline);
--ag-foreground-color: var(--text-primary);
--ag-secondary-foreground-color: var(--text-secondary);
```

All AG Grid instances must automatically adapt to:

* Light theme
* Dark theme
* Future branding changes

without modifying grid code.

---

## AG Grid Features

Every grid should support:

### Required

* Pagination
* Column Sorting
* Column Filtering
* Column Resizing
* Row Selection
* Quick Search
* Responsive Layout

### Preferred

* Export CSV
* Export Excel
* Column Visibility
* Saved User Preferences

---

## Pagination

Pagination is mandatory.

Never display thousands of records in a single scrollable page.

### Standard

```yaml
Default Page Size: 25
Options:
  - 25
  - 50
  - 100
```

### Layout

```text
Showing 1-25 of 8,540
[Previous]
[1]
[2]
[3]
...
[Last]
[Next]
```

Pagination should remain visible at the bottom of every grid.

---

# Loading States

Loading feedback must be scoped to the action being performed.

---

## Button Loading

Buttons must display an inline loading indicator.

### Required Behavior

When clicked:

* Disable button
* Preserve width
* Preserve height
* Show spinner inside button
* Prevent duplicate submissions

### Example

Before:

```text
[ Save ]
```

Loading:

```text
[ ⟳ Save ]
```

Never:

* Change button width
* Show page loader
* Show blocking overlay

---

## Spinner

Use:

```yaml
Component: Spinner
Animation: Continuous Rotation
Library: Framer Motion
```

Color should inherit button text color automatically.

---

# Skeleton Loading

For content loading:

Use Skeleton Loaders.

Do not use:

* Large centered spinners
* Full-page loading screens
* Empty white cards

---

## Cards

Loading state:

```text
┌─────────────────┐
██████████████
████████
████████████
└─────────────────┘
```

---

## AG Grid

Loading state:

```text
HEADER
██████████████████████
██████████████████████
██████████████████████
██████████████████████
██████████████████████
```

The skeleton should visually match the final structure.

---

## Dashboard Statistics

Loading state:

```text
┌────────────┐
██████████
██████████████
└────────────┘
```

---

# Icons

### Standard Icon Library

Only:

```yaml
Library: Lucide React
```

Never mix:

* HeroIcons
* Font Awesome
* Material Icons
* Bootstrap Icons

---

## Button Icons

Use icons only when they improve recognition.

### Recommended

| Action   | Icon      |
| -------- | --------- |
| Add      | Plus      |
| Save     | Save      |
| Delete   | Trash2    |
| Export   | Download  |
| Refresh  | RefreshCw |
| Search   | Search    |
| Filter   | Funnel    |
| Edit     | Pencil    |
| Settings | Settings  |
| Upload   | Upload    |
| Download | Download  |

---

## Icon Size

```yaml
Button Icons: 16px
Navigation Icons: 18px
Page Action Icons: 18px
Table Action Icons: 16px
```

---

## Button Layout

```text
[ Icon Label ]
```

Example:

```text
[ + Create Work Order ]
```

Spacing:

```yaml
Icon Gap: 8px
```

---

# Empty States

Every data component must support an empty state.

Example:

```text
📄
No Work Orders Found

Try changing filters
or create a new work order.
```

Never display blank screens.

---

# Search Experience

All AG Grid pages must include:

### Global Search

Position:

```text
[ Search................ ]
```

Top right of grid toolbar.

### Debounce

```yaml
Delay: 300ms
```

---

# Toolbar Standard

Every AG Grid page should follow:

```text
+ Create
Export
Refresh

-----------------------

Search...

-----------------------

AG Grid

-----------------------

Pagination
```

This layout should remain consistent throughout the application.

---

# Theme Requirements

All components must use centralized tokens.

This includes:

* AG Grid
* Pagination
* Buttons
* Inputs
* Cards
* Dropdowns
* Modals
* Tooltips
* Skeletons
* Alerts

No component may define its own colors.

All visual properties must derive from:

```yaml
colors
spacing
radius
typography
shadows
```

through CSS variables and Tailwind theme extensions.

---

# Enterprise UX Principles

The application should feel like:

* Google Admin Console
* Jira
* Linear
* Atlassian Cloud
* Asset Panda
* IBM Maximo

Prioritize:

* Information Density
* Fast Scanning
* Consistency
* Predictability
* Low Cognitive Load

Avoid:

* Oversized cards
* Large paddings
* Decorative animations
* Marketing-style layouts
* Empty whitespace

The UI is a productivity tool, not a landing page.

---

# Mobile & Tablet Responsiveness

All components, pages, and workflows must be fully responsive and optimized for touch and smaller viewports.

---

## Breakpoints

Standard breakpoints across the application:

```yaml
Mobile: < 640px (sm)
Tablet / Landscape: 640px - 1023px (md / lg)
Desktop: >= 1024px (xl)
Large Desktop: >= 1280px (2xl)
```

---

## Layout & Navigation

### Desktop (>= 1024px)
* Fixed left sidebar navigation (expanded or compact collapsible).
* Full multi-column dashboard and data grid layouts.

### Tablet (640px - 1023px)
* Collapsible left sidebar (icons-only rail mode by default).
* Slide-out drawer on menu trigger.
* Flexible 2-column card and form grids.

### Mobile (< 640px)
* Compact top header bar with page title and hamburger menu button.
* Off-canvas slide-over navigation drawer with backdrop overlay.
* Optional sticky bottom bar for fast switching between core workflows (e.g. Work Orders, Tickets, Assets, Profile).

---

## AG Grid & Data Tables

Data grids must adapt gracefully to touchscreens and narrow viewports:

### Column Priority & Hiding Rules
* **Mobile (< 640px)**: Display only 2 to 3 core columns (e.g., ID/Title, Status badge, Primary Action). Hide secondary details (Dates, Category, Assignee, Priority).
* **Tablet (640px - 1023px)**: Display 4 to 6 primary columns. Hide non-essential tertiary columns.
* **Desktop (>= 1024px)**: Display all columns with user column-visibility toggle.

### Touch & Scroll Strategy
* Enable horizontal scrolling (`overflow-x: auto`) with sticky freeze on the leftmost column (ID/Name) and rightmost column (Actions).
* For mobile-first list views, support **Card View Fallback** where table rows render as stacked info cards with expandable detail drawers.

---

## Toolbar & Action Bar Adaptation

### Desktop Layout
```text
[ Search Input................ ]   [ + Create ] [ Filter ] [ Export ] [ Refresh ]
```

### Mobile & Tablet Layout (< 768px)
* Stack toolbar elements into 2 vertical rows:

```text
Row 1: [ Search Input................................. ]
Row 2: [ + Create ]  [ Filter ]  [ ⋮ More Actions ]
```

* Collapse secondary actions (Export CSV, Batch Actions, Refresh) into an overflow menu (`⋮`).
* On small mobile screens (< 480px), primary creation buttons (e.g. `+ Create`) can convert into a sticky bottom action button or Floating Action Button (FAB).

---

## Form Controls & Inputs

### Grid Column Stacking
* **Desktop**: 2 or 3-column form layouts (`grid-cols-2`, `grid-cols-3`).
* **Tablet**: 2-column form layout (`grid-cols-2`).
* **Mobile**: Single-column vertical stack (`grid-cols-1`).

### Touch Targets
* Minimum touch target height for buttons, inputs, select boxes, and checkboxes: `44px` (recommended `48px`).
* Minimum spacing between tap targets: `8px`.

### Virtual Keypad Optimizations
* Inputs must declare appropriate HTML5 attributes (`inputmode="numeric"`, `type="email"`, `type="tel"`, `type="date"`) to trigger correct mobile OS keypads.

---

## Modals, Dialogs & Sheets

* **Desktop & Tablet**: Centered modal dialog (`max-width: 600px`/`800px`, `max-height: 90vh` with scrollable body).
* **Mobile (< 640px)**:
  * Convert modals to **Bottom Sheets** sliding up from bottom edge or full-screen overlays (`100vw x 100vh`).
  * Include a sticky header with a prominent Close (`X`) button and sticky bottom action bar (e.g. `[ Cancel ] [ Submit ]`).

---

## Dashboard Metrics & Analytics Cards

### Responsive Grid Stacking
```yaml
Desktop: 4 columns (grid-cols-4)
Tablet:  2 columns (grid-cols-2)
Mobile:  1 column  (grid-cols-1)
```

### Mobile Padding & Typography
* Reduce card padding from `16px` (`p-4`) to `12px` (`p-3`) on mobile to preserve vertical screen space.
* Stat counter typography scales down proportionally (e.g., `text-2xl` on desktop to `text-xl` on mobile).

---

## Touch & Gesture Standards

* Use `touch-action: manipulation` on all buttons and interactive controls to eliminate 300ms tap delay and unintended double-tap zoom.
* Provide immediate `:active` touch feedback (e.g., subtle scale down `active:scale-95` or background shade transition).
* Hover-only tooltips and menus must support tap-to-toggle interactions on touch devices.

