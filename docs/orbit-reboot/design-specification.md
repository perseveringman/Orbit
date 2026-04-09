# Capacities Design System Specification

> Comprehensive design system extracted from Capacities (app.capacities.io) — covering tokens, components, layouts, and interaction patterns across all pages.

---

## 1. Foundation

### 1.1 Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `Inter, ui-sans-serif, system-ui` | Primary body/UI font |
| `--font-mono` | `"Courier New", monospace` | Code blocks |
| `--font-code` | `"Overpass Mono", "SF Mono", "JetBrains Mono NF"...` | Rich code editor |
| `--font-serif` | `Georgia, serif` | Fallback serif |

#### Type Scale

| Token | Size | Computed | Usage |
|-------|------|----------|-------|
| `--text-xxs` | 0.6875rem | 11px | Micro labels |
| `--text-xs` | 0.75rem | 12px | Badges, counts, captions |
| `--text-sm` | 0.84375rem | 13.5px | Card body, tab labels, small text |
| `--text-sm-plus` | 0.875rem | 14px | Nav items, buttons, properties |
| `--text-base` | 0.9375rem | 15px | Body text (default) |
| `--text-md` | 1rem | 16px | Editor text, inputs |
| `--text-lg` | 1.125rem | 18px | Section titles, note titles |
| `--text-xl` | 1.25rem | 20px | Page header titles (H1) |
| `--text-2xl` | 1.5rem | 24px | Large headings |
| `--text-25xl` | 1.65rem | 26.4px | — |
| `--text-35xl` | 2rem | 32px | Getting Started title |
| `--text-4xl` | 2.25rem | 36px | Object detail title |
| `--text-5xl` | 3rem | 48px | Hero headings |

#### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--fw-extralight` | 200 | Decorative |
| `--fw-light` | 300 | Subtitle accents |
| `--fw-normal` | 400 | Body text, nav items |
| `--fw-medium` | 500 | Active tabs, selected states |
| `--fw-semibold` | 600 | Section headers, card titles |
| `--fw-bold` | 700 | Page titles, H1, object titles |

#### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--lh-xxs` | 0.875rem | Micro text |
| `--lh-xs` | 1rem | Badge text |
| `--lh-sm` | 1.2rem | Small text |
| `--lh-sm-plus` | 1.25rem | Buttons |
| `--lh-base` | 1.325rem | Body default |
| `--lh-md` | 1.5rem | Standard paragraph |
| `--lh-lg` | 1.625rem | Comfortable reading |
| `--lh-xl` | 1.75rem | Large text |

#### Letter Spacing

| Token | Value |
|-------|-------|
| `--tracking-tighter` | -0.05em |
| `--tracking-tight` | -0.025em |
| `--tracking-wide` | 0.025em |
| `--tracking-wider` | 0.05em |

---

### 1.2 Color System

Capacities uses **OKLCH** color space for perceptually uniform colors. The palette includes 1000+ tokens organized by:
- **Scale**: 50–1000 in increments of ~25-50
- **Hue families**: gray, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose

#### Semantic Background Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg-back` | `oklch(0.986 0.002 67)` ≈ #f8f8f7 | `#1a1a1e` | App background |
| `--bg-base` | `oklch(1.000 0.000 263)` ≈ #ffffff | `#242428` | Content base |
| `--bg-base-hover` | `oklch(0.986 0.002 67)` ≈ #f8f8f7 | `#2a2a2e` | Base hover |
| `--bg-front` | `oklch(1.000 0.000 263)` ≈ #ffffff | `#2a2a2e` | Cards, panels |
| `--bg-front-hover` | `oklch(0.986 0.002 67)` | `#333338` | Card hover |
| `--bg-el` | `oklch(0.968 0.002 67)` ≈ #f3f3f2 | `#3c3c42` | Elements (active tabs) |
| `--bg-el-hover` | `oklch(0.941 0.002 67)` ≈ #ebebea | `#424248` | Element hover |
| `--bg-el-subtle` | white | `#2a2a2e` | Subtle elements |
| `--bg-el-active` | `oklch(0.916 0.002 67)` ≈ #e2e2e1 | `#4d4d52` | Active state |
| `--bg-el-strong` | `oklch(0.916 0.002 67)` | `#4d4d52` | Strong emphasis |
| `--bg-button-primary` | `oklch(0.389 0.005 301)` ≈ #5c5c5e | `#e5e5e3` | Primary button |
| `--bg-input` | white | `#2a2a2e` | Input fields |
| `--bg-state-active` | `oklch(0.467 0.004 17)` ≈ #6e6e68 | `#e5e5e3` | Active state |

#### Semantic Text Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--text-primary` | `oklch(0.219 0.006 286)` ≈ #1a1a1e | `#ffffff` | Headings, titles |
| `--text-secondary` | `oklch(0.389 0.005 301)` ≈ #5c5c5e | `#a8a8a2` | Body text, nav |
| `--text-subtle` | `oklch(0.573 0.005 34)` ≈ #8a8a85 | `#6e6e68` | Placeholders, counts |
| `--text-button-primary` | `oklch(0.968 0.002 67)` | `#1a1a1e` | Button text |

#### Semantic Border Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--border-base` | `oklch(0.916 0.002 67)` ≈ #e2e2e1 | `#3c3c42` | Default borders |
| `--border-base-strong` | `oklch(0.864 0.002 67)` ≈ #d5d5d3 | `#525258` | Strong borders |
| `--border-el` | `oklch(0.864 0.002 67)` | `#525258` | Element borders |
| `--border-el-hover` | `oklch(0.716 0.006 31)` ≈ #a8a8a2 | `#6e6e68` | Hover borders |
| `--border-state-active` | `oklch(0.716 0.006 31)` | `#a8a8a2` | Active ring |

#### Object Type Colors (constant across themes)

| Type | Background | Text | Border |
|------|-----------|------|--------|
| **Project** | `oklch(0.973 0.031 157)` (mint) | `oklch(0.533 0.122 152)` | `oklch(0.871 0.136 154)` |
| **Quote** | `oklch(0.953 0.022 17)` (blush) | `oklch(0.506 0.155 25)` | `oklch(0.808 0.104 20)` |
| **Atomic note** | `oklch(0.981 0.048 103)` (cream) | `oklch(0.553 0.105 76)` | `oklch(0.905 0.166 98)` |
| **Daily Note** | `oklch(0.951 0.024 256)` (periwinkle) | `oklch(0.504 0.158 264)` | `oklch(0.809 0.096 252)` |
| **Page** | `oklch(0.986 0.002 67)` (warm gray) | `oklch(0.389 0.005 301)` | `oklch(0.864 0.002 67)` |
| **Tag** | `oklch(0.962 0.018 272)` (lavender) | `oklch(0.479 0.181 280)` | `oklch(0.785 0.104 275)` |

#### Day-of-Week Colors

| Day | Color Token | Value |
|-----|-------------|-------|
| Monday | `--color-monday` | `oklch(0.746 0.155 72)` (amber) |
| Tuesday | `--color-tuesday` | `oklch(0.635 0.200 15)` (rose) |
| Wednesday | `--color-wednesday` | `oklch(0.698 0.176 150)` (green) |
| Thursday | `--color-thursday` | `oklch(0.613 0.175 260)` (blue) |
| Friday | `--color-friday` | `oklch(0.621 0.219 304)` (purple) |
| Saturday | `--color-saturday` | `oklch(0.687 0.173 49)` (orange) |
| Sunday | `--color-sunday` | `oklch(0.646 0.198 354)` (pink) |

---

### 1.3 Spacing

Base unit: **4px** (`0.25rem`)

| Token | Value | Pixels |
|-------|-------|--------|
| `--sp-0` | 0 | 0 |
| `--sp-px` | 1px | 1 |
| `--sp-0-5` | 0.125rem | 2 |
| `--sp-1` | 0.25rem | 4 |
| `--sp-1-5` | 0.375rem | 6 |
| `--sp-2` | 0.5rem | 8 |
| `--sp-3` | 0.75rem | 12 |
| `--sp-4` | 1rem | 16 |
| `--sp-5` | 1.25rem | 20 |
| `--sp-6` | 1.5rem | 24 |
| `--sp-8` | 2rem | 32 |
| `--sp-10` | 2.5rem | 40 |
| `--sp-12` | 3rem | 48 |
| `--sp-16` | 4rem | 64 |

---

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--r-sm` | 0.25rem (4px) | Tiny elements |
| `--r-small` | 0.3rem (4.8px) | — |
| `--r-md` | 0.375rem (6px) | Inputs |
| `--r-base` | 0.5rem (8px) | **Most common**: buttons, nav items, dropdowns |
| `--r-lg` | 0.5rem (8px) | — |
| `--r-xl` | 0.75rem (12px) | Dropdown menus, view switcher |
| `--r-2xl` | 1rem (16px) | Cards, daily note sections, modals |
| `--r-3xl` | 1.5rem (24px) | Large cards |
| `--r-full` | 9999px | Pills, badges |

---

### 1.5 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | 3-layer, max 6px blur | Subtle lift |
| `--shadow-sm` | 3-layer, max 9px blur | Small cards |
| `--shadow` | 3-layer, max 14px blur | **Object cards** (default) |
| `--shadow-md` | 3-layer, max 20px blur | Card hover state |
| `--shadow-lg` | 3-layer, max 28px blur | **Dropdown menus** |
| `--shadow-xl` | 3-layer, max 40px blur | Floating panels |
| `--shadow-2xl` | 3-layer, max 56px blur | **Modals** |
| `--shadow-3xl` | 3-layer, max 80px blur | Top-level overlays |

All shadows use **3-layer technique** with very low opacity (0.01–0.05 per layer) for natural depth.

---

### 1.6 Motion & Transitions

| Property | Value |
|----------|-------|
| Default duration | `0.15s` |
| Ease-in-out | `cubic-bezier(.4, 0, .2, 1)` |
| Ease-in | `cubic-bezier(.4, 0, 1, 1)` |
| Ease-out | `cubic-bezier(0, 0, .2, 1)` |
| Spin | `spin 1s linear infinite` |
| Pulse | `pulse 2s cubic-bezier(.4,0,.6,1) infinite` |
| Ping | `ping 1s cubic-bezier(0,0,.2,1) infinite` |

---


## 2. Layout System

### 2.1 Three-Panel Layout

The app uses a **three-panel layout** that fills the viewport:

```
┌──────────────┬──────────────────────────────┬─────────────────┐
│   Sidebar    │       Main Content           │  Right Panel    │
│   288px      │   flex: 1 (adaptive)         │  431–465px      │
│   fixed      │   min-width: 0              │  flex-shrink: 0 │
│              │                              │                 │
└──────────────┴──────────────────────────────┴─────────────────┘
```

| Panel | Width | Background | Border |
|-------|-------|------------|--------|
| **Sidebar** | 288px fixed | `--bg-back` | 0.5px right `--border-base` |
| **Main Content** | flex: 1 | transparent | — |
| **Right Panel** | 431–465px | `--bg-back` | 0.5px left `--border-base` |

### 2.2 Sidebar Structure

```
┌─────────────────────────────┐
│  Logo + Title (Notes)       │  padding: 12px 10px
│  + New Object button        │  padding: 8px 10px
├─────────────────────────────┤
│  📅 Calendar                │  nav-item: h=32px, r=8px
│  🚀 Getting started  0/7   │  badge: green bg
│                             │
│  📌 Pinned           0     │  section header
│  📦 Object types     6     │  section header (collapsible)
│    ├ P Projects       0     │  nav-item: h=29px, indent=16px
│    ├ Q Quotes        99     │  icon: 16x16, colored by type
│    ├ A Atomic notes   2     │  active: bg-el, fw-medium
│    ├ T Tags           0     │
│    ├ D Daily Notes    1     │
│    └ P Pages          1     │
│                             │
│  + Add section              │  subtle text
├─────────────────────────────┤
│  🗑 Trash                   │  footer-item: h=32px
│  🎯 First steps             │  color: text-subtle
│  ❓ Ask a question           │
│  📖 Documentation           │
│  💬 Feedback                │
├─────────────────────────────┤
│  ⚙️ 🌙 👤                  │  icon buttons: 32x32
└─────────────────────────────┘
```

#### Nav Item Specs
- **Height**: 32px (section headers), 29px (sub-items)
- **Padding**: 4px 8px (sections), 4px 8px 4px 16px (sub-items)
- **Border Radius**: 8px
- **Font**: 14px, fw-400 normal
- **Active**: bg-el, fw-500 medium
- **Hover**: bg-el-hover
- **Gap**: 6px between icon and text
- **Count badge**: text-xs, text-subtle, margin-left: auto

### 2.3 Main Content Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Page Header (58px min)                                     │
│  ├ Left: Title + Nav arrows + Today + View switcher         │
│  └ Right: Search + Sort + More + New Object                 │
├─────────────────────────────────────────────────────────────┤
│  Tab Bar (40px) — Overview | All # count                    │
├─────────────────────────────────────────────────────────────┤
│  Page Body (flex: 1, overflow-y: auto)                      │
│  ├ Content area (padding: 24px)                             │
│  └ Right panel (431px)                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Right Panel Structure

```
┌───────────────────────┐
│  Tabs: 99 Quotes |    │  tab: r=8px, border 0.0625em
│  Daily Notes |        │  font: 13px
│  Atomic notes |       │  active: bg-el, fw-500
│  Graph view ✓         │
├───────────────────────┤
│                       │
│  Content area         │  padding: 16px
│  (Graph SVG /         │
│   Note list)          │
│                       │
└───────────────────────┘
```

---

## 3. Component Library

### 3.1 Buttons

#### Primary Button
```css
padding: 6px 14px;
border-radius: 8px;
background: var(--bg-button-primary);     /* dark in light mode */
border: 1px solid var(--border-button-primary);
color: var(--text-button-primary);        /* light text */
font-size: 13.5px;
font-weight: 500;
```

#### Toolbar Button
```css
width: 32px; height: 32px;
border-radius: 8px;
background: transparent;
border: 1px solid var(--border-el-subtle);
color: var(--text-subtle);
font-size: 14px;
```

#### Nav Arrow Button
```css
width: 28px; height: 28px;
border-radius: 8px;
background: transparent;
border: none;
```

#### Today Button
```css
padding: 4px 10px;
border-radius: 8px;
border: 1px solid var(--border-el-subtle);
background: transparent;
font-size: 13.5px;
```

#### Add Daily Note Button
```css
padding: 4px 10px;
border-radius: 8px;
border: 1px dashed var(--border-el-subtle);
background: transparent;
font-size: 13.5px;
color: var(--text-subtle);
/* Hover: border becomes solid, bg-el-hover */
```

#### New Object Sidebar Button
```css
padding: 6px 10px;
border-radius: 8px;
border: 1px solid var(--border-el);
font-size: 13.5px;
color: var(--text-secondary);
```

### 3.2 Object Cards

```css
background: var(--bg-front);
border: 1px solid var(--border-base);
border-radius: 12px;
box-shadow: var(--shadow);
padding: 16px;
margin-bottom: 12px;

/* Hover */
border-color: var(--border-el-hover);
box-shadow: var(--shadow-md);
```

**Structure:**
```
┌──────────────────────────────────┐
│  [Type Label] Atomic note        │  type-label component
│                                  │
│  Title Text                      │  16px, fw-700
│  Body preview text...            │  13.5px, text-subtle
│                                  │
│  Tags: tag1 tag2      metadata   │  12px, tags in pills
└──────────────────────────────────┘
```

### 3.3 Type Labels

```css
display: inline-flex;
align-items: center;
gap: 4px;
padding: 2px 8px;
border-radius: 8px;
font-size: 12px;
border: 1px solid;
```

Six variants: `.project`, `.quote`, `.atomic`, `.daily`, `.page`, `.tag` — each with unique bg/text/border from Object Type Colors.

### 3.4 Tag Badges

```css
padding: 1px 6px;
border-radius: 8px;
background: var(--bg-el);
font-size: 12px;
color: var(--text-subtle);
```

### 3.5 View Switcher Dropdown

```css
/* Trigger */
padding: 4px 10px;
border-radius: 8px;
border: 1px solid var(--border-el-subtle);
background: var(--bg-el);
font-size: 13.5px;
font-weight: 500;

/* Dropdown */
position: absolute;
margin-top: 4px;
background: var(--bg-front);
border: 1px solid var(--border-base);
border-radius: 12px;
box-shadow: var(--shadow-lg);
padding: 4px;
min-width: 140px;

/* Item */
padding: 6px 10px;
border-radius: 8px;
font-size: 13.5px;

/* Active checkmark */
color: var(--color-wednesday); /* green */
```

### 3.6 Tab Bar

```css
/* Container */
height: 40px;
padding: 0 24px;
border-bottom: 0.5px solid var(--border-base);
gap: 2px;

/* Tab Item */
padding: 6px 10px;
border-radius: 8px;
font-size: 13.5px;
color: var(--text-subtle);

/* Active Tab */
color: var(--text-primary);
font-weight: 500;
background: var(--bg-el);
```

### 3.7 Right Panel Tabs

```css
padding: 2.6px 5px;
border-radius: 8px;
border: 0.0625em solid var(--border-el-subtle);
font-size: 13px;

/* Active */
color: var(--text-primary);
font-weight: 500;
background: var(--bg-el);
```

### 3.8 Modal / Command Palette

```css
/* Overlay */
background: rgba(0,0,0,0.3);
backdrop-filter: blur(4px);

/* Modal */
width: 480px;
max-height: 400px;
background: var(--bg-front);
border: 1px solid var(--border-base);
border-radius: 16px;
box-shadow: var(--shadow-2xl);

/* Search Input */
padding: 12px 16px;
border-bottom: 1px solid var(--border-base);
font-size: 16px;

/* List Item */
padding: 8px 10px;
border-radius: 8px;
gap: 10px;
font-size: 14px;

/* Item Icon */
width: 28px; height: 28px;
border-radius: 8px;
```

### 3.9 Today Badge

```css
padding: 1px 8px;
border-radius: 9999px;
background: oklch(0.627 0.192 25 / 0.12);
color: var(--color-today);
font-size: 12px;
font-weight: 500;
```

### 3.10 Tip Card

```css
border: 1px solid var(--color-link);
border-radius: 16px;
padding: 16px;
background: var(--bg-front);
```

### 3.11 Empty State

```css
/* Container */
padding: 64px 24px;
text-align: center;

/* Icon */
48x48px, border-radius: 12px, bg-el

/* Title */
font-size: 16px, text-secondary

/* Description */
font-size: 13.5px, max-width: 280px

/* CTA Button */
padding: 8px 16px, primary button styling
```

### 3.12 Getting Started Cards

```css
background: var(--bg-front);
border: 1px solid var(--border-base);
border-radius: 16px;
padding: 20px;
margin-bottom: 16px;

/* Checkbox */
width: 20px; height: 20px;
border-radius: 6px;
border: 2px solid var(--border-el);

/* Checked */
background: var(--color-wednesday);
border-color: var(--color-wednesday);
```

### 3.13 Object Detail / Editor

```css
/* Full-screen overlay */
position: fixed; inset: 0;
background: var(--bg-back);

/* Header */
padding: 12px 24px;
border-bottom: 0.5px solid var(--border-base);

/* Main content */
max-width: 720px;
margin: 0 auto;
padding: 32px 48px;

/* Title */
font-size: 36px (text-4xl);
font-weight: 700;
line-height: 1.2;
contenteditable: true;

/* Properties */
font-size: 14px;
label: text-subtle, min-width: 80px
value: text-secondary

/* Editor */
font-size: 16px;
line-height: 1.7;
min-height: 200px;
```

---

## 4. Page-by-Page Specifications

### 4.1 Calendar — Day View

**Header**: Date title (e.g., "Apr 8, 2026") + nav arrows + Today button + View switcher
**Content**:
- Day name (colored by weekday) + Today badge
- Full date (20px bold)
- Week number (12px subtle)
- Daily Note section (rounded card with type label, title, tags, body)
- Tip of the day card (blue border)

**Right Panel**: Graph view with SVG node visualization

### 4.2 Calendar — Week View

**Content**: Vertical list of 7 days (Monday → Sunday)
- Each day: colored day name + bold date + "Today" badge for current day
- Content cards inline for days with notes
- "+ Daily Note" dashed button for empty days

### 4.3 Calendar — Month View

**Content**: Split layout
- Left: 7-column grid (Mon–Sun headers), date cells
  - Today: red-tinted background
  - Selected: bg-el background
  - Other month: 40% opacity
- Right: Detail panel (320px) showing selected day's content

### 4.4 Object List Pages (Quotes, Projects, Atomic notes, Tags, Pages)

**Header**: Type title + toolbar (search, sort, more, + New Object)
**Tab Bar**: Overview | All # count
**Content**:
- With items: Object cards stacked vertically (12px gap)
- Empty: Empty state component with icon, title, description, CTA button
**Right Panel**: Graph view (may show "No graph view support")

### 4.5 Getting Started Page

**Content**: Intro section (h1 + description) + Task cards
- Each card: checkbox + title + description + action buttons
- Video card placeholder
- Object creation shortcuts (colored by type)
- Calendar link button

### 4.6 Object Detail Page

**Full-screen overlay** with:
- Header: Back arrow + type label + breadcrumb + pagination (1/2)
- Main (720px max): Type label → Title (editable, 36px) → Properties (Tags, Collections) → Editor → Backlinks section
- No right sidebar in detail view

### 4.7 New Object Modal

**Command palette style** dialog:
- Search input at top
- Object type list with colored icons
- Quick capture option at bottom
- Escape to dismiss, click outside to dismiss

---

## 5. Interaction Patterns

### 5.1 Navigation
- Sidebar items: click to navigate, active state with bg-el
- Calendar view switching: dropdown with checkmark for active view
- Object cards: click to open detail overlay
- Back button in detail: returns to list

### 5.2 Hover States
- All interactive elements transition with `0.15s cubic-bezier(.4,0,.2,1)`
- Buttons: background changes to hover variant
- Cards: border-color and shadow intensify
- Nav items: background appears (bg-el-hover)

### 5.3 Theme Switching
- Managed via `data-theme` attribute on `<html>`
- CSS custom properties swap all semantic colors
- Persisted to `localStorage`
- All object type colors remain constant across themes

### 5.4 Scrolling
- Custom scrollbar: 6px width, rounded thumb
- Sidebar and content areas independently scrollable
- Right panel independently scrollable

### 5.5 Modals
- Backdrop: rgba(0,0,0,0.3) with 4px blur
- Centered, top-biased positioning (120px from top)
- Escape key dismisses
- Click outside dismisses
- Search input auto-focused

---

## 6. Key CSS Architecture Notes

1. **Tailwind CSS v4** is used as the underlying utility framework
2. **OKLCH color space** throughout for perceptual uniformity
3. **1112+ CSS custom properties** on `:root` — the design system is token-driven
4. **Semantic layering**: back → base → front → el → el-hover → el-active (6 depth levels)
5. **Border width**: 0.5px for subtle panel separators, 1px for card/button borders, `0.0625em` for tab borders
6. **No hard-coded colors in components** — everything references tokens
7. **Font smoothing**: Both `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale`
8. **Container sizes**: xs(20rem) → sm(24rem) → md(28rem) → lg(32rem) → xl(36rem) → 2xl(42rem) → 3xl(48rem) → 7xl(80rem)

---

## 7. Raw Token Reference

### Complete Color Palette (excerpt of key values)

```
Gray:    50=#f8f8f7  100=#f3f3f2  200=#e2e2e1  300=#d5d5d3  400=#a8a8a2
         500=#8a8a85  600=#6e6e68  700=#5c5c5e  800=#3c3c42  900=#1a1a1e

Red:     100=oklch(0.936 0.031 18)  500=oklch(0.627 0.192 25)  900=oklch(0.359 0.057 20)
Green:   100=oklch(0.962 0.043 157) 500=oklch(0.698 0.176 150) 900=oklch(0.341 0.044 157)
Blue:    100=oklch(0.932 0.032 256) 500=oklch(0.613 0.175 260) 900=oklch(0.350 0.054 269)
Purple:  100=oklch(0.946 0.033 307) 500=oklch(0.621 0.219 304) 900=oklch(0.349 0.072 308)
Amber:   100=oklch(0.962 0.058 96)  500=oklch(0.746 0.155 72)  900=oklch(0.374 0.049 50)
```

---

*Generated from live analysis of app.capacities.io on April 8, 2026. Includes 1112+ design tokens extracted from computed CSS custom properties.*
