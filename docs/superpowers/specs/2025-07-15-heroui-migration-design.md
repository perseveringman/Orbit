# HeroUI Design System Migration

## Problem

Orbit uses a custom design system (`orbit-design-system.css`, `@orbit/ui-tokens`, component descriptors in `@orbit/ui-dom`) with 131 CSS classes, 100+ CSS custom properties, 4 style variants, and 5 component descriptor factories. This duplicates capabilities already provided by HeroUI v3, which is partially adopted in the desktop agent-hub pages.

The goal is a clean break: delete the entire custom design system and replace it everywhere with HeroUI components + Tailwind utility classes + HeroUI semantic tokens.

## Decisions

| Decision | Choice |
|----------|--------|
| Style variants (notion/spaceship/library) | **Drop all** — HeroUI light/dark only |
| Component descriptors | **Delete entirely** — use HeroUI components directly |
| Custom CSS tokens | **Delete** — use HeroUI semantic tokens |
| Migration scope | **Both apps simultaneously** (web + desktop) |
| Migration strategy | **Big-bang** — single clean pass, no compat layer |
| Domain-specific UI | **Mix** — HeroUI where match exists, custom Tailwind for the rest |

## Deletion Scope

### Files Removed

| File | Lines | Reason |
|------|-------|--------|
| `packages/ui-dom/src/orbit-design-system.css` | 1012 | Entire custom design system |
| `packages/ui-dom/src/theme-notion.css` | 72 | Style variant |
| `packages/ui-dom/src/theme-spaceship.css` | 108 | Style variant |
| `packages/ui-dom/src/theme-library.css` | 100 | Style variant |
| `packages/ui-dom/src/components/Button.ts` | — | Descriptor factory |
| `packages/ui-dom/src/components/Badge.ts` | — | Descriptor factory |
| `packages/ui-dom/src/components/Card.ts` | — | Descriptor factory |
| `packages/ui-dom/src/components/Modal.ts` | — | Descriptor factory |
| `packages/ui-dom/src/components/NavItem.ts` | — | Descriptor factory |
| `packages/ui-tokens/` | entire pkg | Custom token generation |

### Exports Removed from `@orbit/ui-dom`

- `setStyleVariant()`, `OrbitStyleVariant` type
- `createButtonDescriptor`, `createBadgeDescriptor`, `createCardDescriptor`, `createModalDescriptor`, `createNavItemDescriptor`
- `getDesignSystemCSS()`, `createDomSlot()`

### Exports Kept in `@orbit/ui-dom`

- `setTheme(mode)` — toggles light/dark, syncs `class` + `data-theme` for HeroUI
- `getCurrentTheme()` — reads current mode
- `injectTheme()` — initial theme injection
- `syncDocumentThemeMode()` — keeps `class` and `data-theme` in sync
- `createDomThemeContract()` — if referenced by other packages

## Component Mapping

### Layout Shell

| Custom Class | Replacement |
|-------------|-------------|
| `.app` | `<div className="flex h-screen bg-background text-foreground">` |
| `.sidebar` | `<aside className="flex w-64 flex-col border-r border-border bg-surface">` |
| `.main-content` | `<main className="flex flex-1 flex-col overflow-hidden">` |
| `.right-panel` | `<aside className="flex w-80 flex-col border-l border-border bg-surface">` |

### Sidebar

| Custom Class | Replacement |
|-------------|-------------|
| `.sidebar-header` | `<div className="flex items-center gap-2 border-b border-border px-4 py-3">` |
| `.sidebar-logo` | `<div className="flex items-center gap-2 text-lg font-semibold">` |
| `.sidebar-new-btn` | `<Button variant="primary" fullWidth>` |
| `.sidebar-nav-item` | `<button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-secondary">` |
| `.sidebar-nav-item.active` | Add `bg-accent-soft text-accent font-medium` |
| `.sidebar-divider` | `<Separator />` |
| `.sidebar-section-header` | `<div className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">` |
| `.sidebar-footer-item` | Same as nav-item pattern |
| `.icon-btn` | `<Button variant="ghost" isIconOnly size="sm">` |
| `.count` | `<Chip size="sm">` or `<Badge>` |

### Header & Navigation

| Custom Class | Replacement |
|-------------|-------------|
| `.page-header` | `<div className="flex items-center justify-between border-b border-border px-6 py-3">` |
| `.page-title` | `<h1 className="text-xl font-bold">` |
| `.nav-arrow-btn` | `<Button variant="ghost" isIconOnly size="sm">` |
| `.today-btn` | `<Button variant="secondary" size="sm">` |
| `.toolbar-btn` | `<Button variant="ghost" isIconOnly size="sm">` |
| `.tab-bar` + `.tab-item` | `<Tabs>` + `<Tab>` (HeroUI compound component) |
| `.tab-count` | `<Chip size="sm">` inside Tab |

### Cards

| Custom Class | Replacement |
|-------------|-------------|
| `.object-card` | `<Card>` |
| `.object-card-header` | `<Card.Header>` |
| `.object-card-title` | `<Card.Title>` |
| `.object-card-body` | `<Card.Content>` |
| `.object-card-footer` | `<Card.Footer>` |

### Type Labels & Tags

| Custom Class | Replacement |
|-------------|-------------|
| `.type-label` | `<Chip variant="soft">` |
| `.type-label.project` | `<Chip variant="soft" color="accent">` |
| `.type-label.atomic` | `<Chip variant="soft" color="warning">` |
| `.type-label.daily` | `<Chip variant="soft" color="success">` |
| `.type-label.tag` | `<Chip variant="soft" color="default">` |
| `.tag-badge` | `<Chip size="sm" variant="soft">` |

### Details Panel

| Custom Class | Replacement |
|-------------|-------------|
| `.detail-title` | `<h2 className="text-xl font-bold">` |
| `.detail-properties` | `<div className="flex flex-col gap-1">` |
| `.detail-prop` | `<div className="flex items-center justify-between py-1.5">` |
| `.detail-prop-label` | `<span className="text-sm text-muted">` |
| `.detail-prop-value` | `<span className="text-sm font-medium">` |

### Empty State

| Custom Class | Replacement |
|-------------|-------------|
| `.empty-state` | `<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">` |
| `.empty-state-icon` | `<div className="text-4xl">` |
| `.empty-state-title` | `<p className="text-sm text-muted">` |

### Modal / Dialog

| Custom Class | Replacement |
|-------------|-------------|
| `.modal-overlay` | `<Modal.Backdrop>` |
| `.modal` | `<Modal.Dialog>` |
| `.modal-search` | `<Input>` inside `<Modal.Body>` |
| `.modal-list` | `<ListBox>` or Tailwind flex-col |
| `.modal-list-item` | `<ListBox.Item>` or Tailwind button |

### DevTools (Inline Styles → Tailwind)

All inline `style={{ background: 'oklch(...)' }}` blocks in agent-devtools/ convert to HeroUI semantic classes:

| Inline Variable | Tailwind Class |
|----------------|----------------|
| `--oklch-bg` | `bg-background` |
| `--oklch-surface` | `bg-surface` |
| `--oklch-text` | `text-foreground` |
| `--oklch-border` | `border-border` |
| `--oklch-muted` | `text-muted` |

## Migration Phases

### Phase 1 — Delete Custom Design System

Remove all custom CSS files, component descriptors, theme variant files, and the `@orbit/ui-tokens` package. Clean up `@orbit/ui-dom` barrel exports.

**Files changed:**
- Delete: `orbit-design-system.css`, `theme-*.css`, `components/*.ts`
- Edit: `packages/ui-dom/src/index.ts` (remove deleted exports)
- Edit: `packages/ui-dom/src/dom-theme.ts` (remove `setStyleVariant`, `OrbitStyleVariant`)
- Delete or gut: `packages/ui-tokens/`
- Edit: `pnpm-workspace.yaml` (remove ui-tokens if listed)

### Phase 2 — Migrate `apps/web`

Rewrite `apps/web/src/App.tsx` to use HeroUI components + Tailwind. Update `styles.css` to remove orbit-design-system import. Remove `setStyleVariant` from `main.tsx`.

**Files changed:**
- `apps/web/src/App.tsx` — full rewrite of all 47 CSS classes
- `apps/web/src/styles.css` — remove orbit-design-system import
- `apps/web/src/main.tsx` — remove style variant logic

### Phase 3 — Migrate `apps/desktop`

Same as Phase 2 for desktop. The desktop `App.tsx` has the same 3-pane layout.

**Files changed:**
- `apps/desktop/src/renderer-entry/App.tsx` — full rewrite
- `apps/desktop/src/renderer-entry/styles.css` — remove orbit-design-system import
- `apps/desktop/src/renderer-entry/index.tsx` — remove style variant logic

### Phase 4 — Migrate `agent-devtools`

Convert 4 files from inline oklch styles to Tailwind + HeroUI semantic tokens.

**Files changed:**
- `apps/desktop/src/renderer-entry/agent-devtools/AgentDevTools.tsx`
- `apps/desktop/src/renderer-entry/agent-devtools/EventStreamPanel.tsx`
- `apps/desktop/src/renderer-entry/agent-devtools/ObservabilityPanel.tsx`
- `apps/desktop/src/renderer-entry/agent-devtools/LLMConfigPanel.tsx`

### Phase 5 — Verify `agent-hub` Pages

Confirm the 9 agent-hub pages don't reference anything from the deleted system. These already use HeroUI + Tailwind correctly.

### Phase 6 — Validate

- `pnpm --filter @orbit/ui-dom typecheck`
- `pnpm --filter @orbit/web typecheck && pnpm --filter @orbit/web build`
- `pnpm --filter @orbit/desktop typecheck && pnpm --filter @orbit/desktop build`
- Run existing test suites

## Token Mapping Reference

For any remaining custom CSS variables encountered during migration:

| Orbit Token | HeroUI Equivalent |
|------------|-------------------|
| `--bg-back` | `bg-background` |
| `--bg-base` | `bg-surface` |
| `--bg-front` | `bg-surface-secondary` |
| `--bg-el` | `bg-surface-tertiary` |
| `--bg-button-primary` | `bg-accent` |
| `--text-primary` | `text-foreground` |
| `--text-secondary` | `text-muted` |
| `--text-subtle` | `text-muted` (with opacity) |
| `--border-base` | `border-border` |
| `--border-front` | `border-separator` |
| `--ring-active` | `ring-focus` |
| `--color-link` | `text-link` |
| `--code-bg` | `bg-surface-secondary` |

## Notes

- The agent-hub pages serve as the reference implementation for how HeroUI + Tailwind should look in this codebase.
- Calendar views (day/week/month), graph placeholders, and getting-started flows don't exist in the current App.tsx mockup — they are defined in orbit-design-system.css but unused. They get deleted with the CSS file.
- Object-type colors (project/quote/atomic/daily/page/tag) map to HeroUI's semantic colors: accent, warning, success, default, danger.
- Day-of-week colors are domain-specific and can be defined as a small Tailwind plugin or inline utilities if needed later.
