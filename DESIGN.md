# UI Design System v2.2 — Enterprise Management System

Reference doc for building/extending screens in this app. Follows the token-based
light/dark theming pattern used throughout (`:root.light` / `:root.dark` CSS vars
mapped into Tailwind config). Color system is Material Design 3–style (surface
roles + primary/secondary/tertiary + fixed/inverse variants).

## Stack
- Tailwind CSS (CDN, `darkMode: 'class'`)
- AG Grid Community (data tables)
- Lucide Icons
- Vanilla JS (no framework in this reference build)

## Design Tokens (CSS Variables)

### Light theme
| Token | Value | Usage |
|---|---|---|
| `surface` | `#f8f9fa` | Page background |
| `surface-dim` | `#d9dadb` | Dimmed/inactive surface |
| `surface-bright` | `#f8f9fa` | Brightest surface variant |
| `surface-container-lowest` | `#ffffff` | Lowest-emphasis container |
| `surface-container-low` | `#f3f4f5` | Toolbars, table headers |
| `surface-container` | `#ffffff` | Cards, inputs, panels |
| `surface-container-high` | `#e7e8e9` | Hover states |
| `surface-container-highest` | `#e1e3e4` | Highest-emphasis container |
| `surface-variant` | `#e1e3e4` | Alternate surface fill |
| `on-surface` | `#191c1d` | Primary text/icons on surface |
| `on-surface-variant` | `#414754` | Secondary text/icons on surface |
| `inverse-surface` | `#2e3132` | Inverse surface (e.g. toasts/tooltips) |
| `inverse-on-surface` | `#f0f1f2` | Text/icons on inverse surface |
| `outline` | `#727785` | Borders, dividers (default emphasis) |
| `outline-variant` | `#E0E2E6` | Low-emphasis borders/dividers |
| `surface-tint` | `#005bc0` | Elevation tint overlay |
| `background` | `#f8f9fa` | App background |
| `on-background` | `#191c1d` | Text/icons on background |
| `text-primary` | `#202124` | Primary body text |
| `text-secondary` | `#444746` | Secondary/muted body text |
| `brand-cobalt` | `#0B57D0` | Brand accent (marketing/emphasis moments) |

### Primary / Secondary / Tertiary / Error
| Token | Value | Usage |
|---|---|---|
| `primary` | `#005bbf` | Primary actions, active/selected states |
| `on-primary` | `#ffffff` | Text/icons on primary fill |
| `primary-container` | `#1a73e8` | Primary container fill (e.g. filled tonal buttons) |
| `on-primary-container` | `#ffffff` | Text/icons on primary container |
| `inverse-primary` | `#adc7ff` | Primary color for use on inverse surfaces |
| `secondary` | `#3f6377` | Secondary actions, supporting emphasis |
| `on-secondary` | `#ffffff` | Text/icons on secondary fill |
| `secondary-container` | `#c0e5fd` | Secondary container fill |
| `on-secondary-container` | `#43677b` | Text/icons on secondary container |
| `tertiary` | `#9e4300` | Tertiary accents, contrasting emphasis |
| `on-tertiary` | `#ffffff` | Text/icons on tertiary fill |
| `tertiary-container` | `#c55500` | Tertiary container fill |
| `on-tertiary-container` | `#0e0200` | Text/icons on tertiary container |
| `error` | `#ba1a1a` | Destructive/error actions, validation |
| `on-error` | `#ffffff` | Text/icons on error fill |
| `error-container` | `#ffdad6` | Error container fill (e.g. banners) |
| `on-error-container` | `#93000a` | Text/icons on error container |

### Fixed variants (persist across light/dark, e.g. onboarding, chips)
| Token | Value |
|---|---|
| `primary-fixed` | `#d8e2ff` |
| `primary-fixed-dim` | `#adc7ff` |
| `on-primary-fixed` | `#001a41` |
| `on-primary-fixed-variant` | `#004493` |
| `secondary-fixed` | `#c3e7ff` |
| `secondary-fixed-dim` | `#a7cbe3` |
| `on-secondary-fixed` | `#001e2c` |
| `on-secondary-fixed-variant` | `#264b5e` |
| `tertiary-fixed` | `#ffdbcb` |
| `tertiary-fixed-dim` | `#ffb691` |
| `on-tertiary-fixed` | `#341100` |
| `on-tertiary-fixed-variant` | `#783100` |

### Dark theme
| Token | Value | Usage |
|---|---|---|
| `dark-surface` | `#131416` | Page background |
| `dark-surface-container` | `#1c1d1f` | Cards, inputs, panels |
| `dark-surface-container-low` | `#232427` | Toolbars, table headers |
| `dark-surface-container-high` | `#2a2b2e` | Hover states |
| `dark-on-surface` | `#e3e3e4` | Primary text/icons |
| `dark-on-surface-variant` | `#c4c7c5` | Secondary/muted text |
| `dark-outline-variant` | `#2e3033` | Borders, dividers |

`primary`/`secondary`/`tertiary`/`error` roles and their `on-*`/`-container`
counterparts stay the same tokens across themes unless a dark-specific override
is introduced later — swap `outline` → `dark-outline-variant` and the `surface-*`
family → their `dark-*` counterparts when `.dark` is active.

Wire tokens into `tailwind.config` under `colors.*` (flat, matching the names
above, e.g. `colors.primary`, `colors['on-primary']`, `colors['surface-container']`,
`colors['outline-variant']`) so classes read as `bg-primary`, `text-on-surface`,
`border-outline-variant`, etc. Never hardcode hex values in markup.

### AG Grid token mapping
```
--ag-background-color: var(--surface-container)
--ag-header-background-color: var(--surface-container-low)
--ag-border-color: var(--outline-variant)
--ag-foreground-color: var(--on-surface)
--ag-secondary-foreground-color: var(--on-surface-variant)
--ag-row-hover-color: var(--surface-container-high)
--ag-header-foreground-color: var(--on-surface)
--ag-font-size: 13px
--ag-grid-size: 6px
```
Grid wrapper: `.ag-root-wrapper { border-radius: var(--radius); border-color: var(--outline-variant); }`

## Typography
- Base font: system stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Base size: `14px`
- Page title: `text-xl font-semibold tracking-tight text-on-surface`
- Page subtitle: `text-xs text-on-surface-variant`
- Stat label: `text-xs font-medium text-on-surface-variant`
- Stat value: `text-2xl font-semibold text-on-surface`
- Table/body text: `text-xs`

## Layout
- Page shell: `p-6 min-h-screen flex flex-col gap-6`
- Sections stack vertically with `gap-6`; internal toolbar groups use `gap-2`–`gap-3`
- Header: flex row, `justify-between items-center`, bottom border (`border-b border-outline-variant pb-4`)
- Stat cards: `grid grid-cols-1 md:grid-cols-4 gap-4`

## Components

### Buttons
- **Primary (filled)**: `bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3 py-2 rounded flex items-center gap-2`
- **Secondary (outlined)**: `border border-outline bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium px-3 py-2 rounded flex items-center gap-2`
- **Destructive**: `bg-error hover:bg-error-container text-on-error hover:text-on-error-container text-xs font-medium px-3 py-2 rounded flex items-center gap-2`
- Icon + label pattern: Lucide icon (`w-4 h-4`) followed by `<span>` label
- **Loading state**: preserve button's rendered width/height inline before disabling, hide the icon, insert a `loader-2` Lucide icon with `animate-spin`, restore after the async action resolves (2s in the demo). Never let the button reflow/shrink when it enters loading.

### Cards (stat cards)
`p-4 rounded border border-outline-variant bg-surface-container` — each has a
live-content state and a matching skeleton state (see Skeletons below) toggled
together.

### Inputs / Search
`bg-surface-container border border-outline text-on-surface text-xs rounded pl-8 pr-3 py-2 focus:outline-none focus:border-primary`
- Leading icon absolutely positioned (`absolute left-2.5 top-2.5 text-on-surface-variant`)
- Debounce input handlers at 300ms before applying (e.g. grid quick-filter)

### Data table (AG Grid)
- Wrap in `.ag-theme-alpine`, sized via container (`w-full h-[480px]`)
- `defaultColDef`: `sortable: true, resizable: true, filter: true`
- Checkbox selection column for row selection (`rowSelection: 'multiple'`)
- Status/priority chips via `cellRenderer`, color-coded against the palette:
  - High → `text-error bg-error-container`
  - Medium → `text-tertiary bg-tertiary-container/10` (or `text-amber-500 bg-amber-500/10` if no tertiary-tinted chip variant is defined)
  - Low → `text-secondary bg-secondary-container`
  - Chip class: `px-2 py-0.5 rounded text-xs font-medium`
- Empty state (`overlayNoRowsTemplate`): centered icon + heading + helper text, `p-8 text-center`, using `text-on-surface-variant` for icon/helper and `text-on-surface` for the heading
- Use AG Grid's built-in `pagination: true` for logic but `suppressPaginationPanel: true` and render pagination controls manually to match the design system (below)
- Re-run `lucide.createIcons()` in `onGridReady` and `onModelUpdated` since AG Grid re-renders DOM nodes Lucide can't see ahead of time

### Pagination (custom)
Row: `flex justify-between items-center text-xs text-on-surface-variant px-1 py-2 border-t border-outline-variant`
- Info text left (`Showing X-Y of Z`)
- Controls right: Previous / numbered pages / current-page highlighted (`border-primary bg-primary text-on-primary`) / ellipsis / Last / Next
- Inactive/disabled buttons: `disabled:opacity-50`

### Skeleton loading
- Animation: `pulse-bg` keyframes, opacity `1 → 0.4 → 1`, `1.5s cubic-bezier(0.4,0,0.6,1) infinite`
- Skeleton fill color: `background-color: var(--outline-variant)`
- Pattern: every stateful region has a sibling `*-skeleton` block (`hidden` by default); toggle `hidden` on the content and skeleton together, never show both
- Grid-level skeleton: absolutely positioned overlay (`absolute inset-0 z-10`) matching the card surface/border, with stacked skeleton bars mimicking header + rows

## Interaction Patterns
- **Theme toggle**: swap `light`/`dark` class on `<html>`; all colors cascade from CSS vars, no per-component dark: classes needed — dark mode remaps `surface-*` → `dark-surface-*` and `outline-variant` → `dark-outline-variant`; `primary`/`secondary`/`tertiary`/`error` families stay constant
- **Refresh**: show skeleton → simulate/await fetch → hide skeleton (see `refreshData()`)
- **Icons**: Lucide via `data-lucide="name"` attributes; call `lucide.createIcons()` after any DOM mutation that introduces new icon markup

## Conventions
- Always theme via CSS variables / Tailwind token classes — never hardcoded hex in markup
- `rounded` (not `rounded-md`/`rounded-lg`) everywhere; radius is a single global token
- Use `outline` for default-emphasis borders (input focus rings, primary dividers) and `outline-variant` for low-emphasis borders (card edges, row separators)
- Reach for `-container`/`on-*-container` pairs (not bare `primary`/`secondary`/`tertiary`) for larger fills like banners, chips, and tonal buttons — reserve bare `primary`/`secondary`/`tertiary`/`error` for small, high-emphasis surfaces like solid buttons and active states
- `brand-cobalt` is reserved for marketing/emphasis moments outside the core app chrome — not a substitute for `primary` in product UI
- Small, dense UI: `text-xs` is the default control/label size; `text-2xl`/`text-xl` reserved for key numbers and page titles