# 全源阅读 (Full-Source Reading) — UI Design Document

> **Module**: `@orbit/feature-reader` · **Status**: Design Proposal  
> **Surfaces**: apps/web, apps/desktop · **Locale**: zh-CN primary

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Navigation Entry](#2-navigation-entry)
3. [Library / Inbox View](#3-library--inbox-view)
4. [Subscription Management](#4-subscription-management)
5. [Unified Reader View](#5-unified-reader-view)
6. [Highlight & Annotation UI](#6-highlight--annotation-ui)
7. [Translation Toggle](#7-translation-toggle)
8. [Book / Long-form View](#8-book--long-form-view)
9. [Transcript / Podcast View](#9-transcript--podcast-view)
10. [Content Pipeline Status](#10-content-pipeline-status)
11. [Reading Exit Actions](#11-reading-exit-actions)
12. [Empty States](#12-empty-states)
13. [Mobile Adaptation](#13-mobile-adaptation)
14. [i18n Keys](#14-i18n-keys)

---

## 1. Design Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **原文不可覆盖** — Translation never replaces original | Mirrors `TranslationMode` design; original text is sacred |
| 2 | **阅读出口即工作流** — Every selection becomes an action | 5 `ReadingExitKind` map to real Orbit objects |
| 3 | **管道可见** — Pipeline state is always visible, never blocking | Users see `ContentState` transitions without being gated |
| 4 | **三栏归一** — Reader expands into the 3-panel layout, never escapes it | No modals for primary reading; context lives in the right panel |
| 5 | **渐进呈现** — Show metadata progressively as layers materialize | 4 content layers (`Raw → Readable → Metadata → Derived`) appear incrementally |

---

## 2. Navigation Entry

### Position & Label

```
┌──────────────────────────┐
│  ○ Orbit                 │
│  [+ 新建对象]             │
│ ─────────────────────────│
│  📅  今日          3     │
│  ◎  聚焦                 │
│  📊  回顾                 │
│ ─────────────────────────│
│  📖  阅读         12  ← NEW
│ ─────────────────────────│
│  📁  项目          5     │
│  📋  任务         14     │
│ ─────────────────────────│
│  …object type shortcuts  │
└──────────────────────────┘
```

- **Label**: `阅读` (Reading) — not "库" (Library). The verb better captures the active nature; "Library" implies static storage.
- **i18n key**: `reader.nav.label` → `'阅读'`
- **Icon**: `BookOpen` from lucide-react — distinguishes from the existing `FolderOpen` (项目) and `ClipboardList` (任务).
- **Position**: Between the "Review" group and the "Projects" group, separated by `<Separator />`. Reading is a daily ritual closer in cadence to Today/Focus/Review than to project management.
- **Badge**: Unread count — number of items with `status === 'ready_to_read'` and `readingStatus === 'unread'`. Display as `text-xs text-muted ml-auto`, same pattern as existing section counts. Badge disappears at 0.

### Active state

```tsx
// Active: bg-accent-soft text-accent font-medium rounded-lg
// Hover: bg-el-subtle-hover
```

Same pattern as `WorkbenchSectionViewModel.active`.

### HeroUI components

- `Button` (variant="light", fullWidth) for nav item
- `Chip` (size="sm", variant="flat") for unread badge (only when count > 0)

---

## 3. Library / Inbox View

Clicking "阅读" loads the Library view into the **main content panel** (flex-1). The right panel shows contextual info for the selected item.

### 3.1 Layout

```
┌─ Left Sidebar ─┐┌─── Main Content (flex-1) ──────────────────┐┌─ Right Panel (w-72) ─┐
│                ││ ┌─ Header ─────────────────────────────────┐ ││                       │
│   [阅读] ●     ││ │  阅读                        🔍  ⊕  ⋯  │ ││  [Preview / Meta]     │
│                ││ └──────────────────────────────────────────┘ ││                       │
│                ││ ┌─ Tabs ───────────────────────────────────┐ ││  Title                │
│                ││ │  收件箱 │ 全部 │ 稍后读 │ 已归档          │ ││  Author · Source      │
│                ││ └──────────────────────────────────────────┘ ││  ──────────           │
│                ││ ┌─ Filter Bar ─────────────────────────────┐ ││  摘要                 │
│                ││ │  [类型 ▾] [来源 ▾] [语言 ▾] [排序 ▾]     │ ││  AI generated summary │
│                ││ └──────────────────────────────────────────┘ ││  ──────────           │
│                ││                                              ││  Tags / Topics        │
│                ││  ┌─ Article Row ──────────────────────────┐  ││  ──────────           │
│                ││  │ ○  Title of Article                    │  ││  Pipeline Status      │
│                ││  │    source · 3 min · 2h ago       ◉ 🔖 │  ││  [ready_to_read ✓]    │
│                ││  └────────────────────────────────────────┘  ││                       │
│                ││  ┌─ Article Row (unread) ─────────────────┐  ││                       │
│                ││  │ ●  Another Article Title               │  ││                       │
│                ││  │    source · 8 min · 5h ago          🔖 │  ││                       │
│                ││  └────────────────────────────────────────┘  ││                       │
│                ││  ┌─ Book Row ─────────────────────────────┐  ││                       │
│                ││  │ 📕 Book Title                          │  ││                       │
│                ││  │    Author · 42% · Ch.3            🔖  │  ││                       │
│                ││  └────────────────────────────────────────┘  ││                       │
│                ││  …                                           ││                       │
│                ││  (virtual scroll)                            ││                       │
└────────────────┘└──────────────────────────────────────────────┘└───────────────────────┘
```

### 3.2 Header

| Element | Component | Spec |
|---------|-----------|------|
| Title | `<h1>` | `text-lg font-semibold text-primary` |
| Search | `Button` isIconOnly | `Search` icon, opens inline search field |
| Add source | `Button` isIconOnly | `Plus` icon, opens Add Source dialog (§4) |
| More | `Button` isIconOnly | `MoreHorizontal` icon → dropdown: Manage subscriptions, Import OPML, Settings |

### 3.3 Tabs

Use `Tabs` / `Tabs.List` / `Tabs.Tab` from HeroUI.

| Tab | Filter logic | Badge |
|-----|-------------|-------|
| **收件箱** (Inbox) | `status === 'ready_to_read' && readingStatus === 'unread'` | Unread count |
| **全部** (All) | All non-archived items | Total count |
| **稍后读** (Read Later) | User-bookmarked items (`savedForLater === true`) | Count |
| **已归档** (Archived) | `readingStatus === 'archived'` | — |

### 3.4 Filter Bar

Horizontal row of `Button` (variant="flat", size="sm") acting as dropdown triggers:

| Filter | Options | Maps to |
|--------|---------|---------|
| **类型** (Type) | 文章, 书籍, 播客, 视频, 文档, 全部 | `ContentMediaType` |
| **来源** (Source) | Dynamic list from user's `SourceEndpoint[]` | `sourceEndpointId` |
| **语言** (Language) | 中文, English, 日本語, 全部 | `MetadataLayer.language` |
| **排序** (Sort) | 最新优先, 最早优先, 阅读进度, 阅读时长 | `publishedAt`, `readingProgress`, `readingTimeMinutes` |

### 3.5 Content List — Row Layout

Each row is a **clickable `div`** (not a HeroUI Card, to reduce visual weight in a dense list):

```
┌──────────────────────────────────────────────────────────────┐
│  ● │ 📄  Title of the Article                     ◉  🔖    │
│    │      Source Name · 5 min read · 3小时前                 │
│    │      [AI摘要] [翻译中…]                                 │
└──────────────────────────────────────────────────────────────┘
```

| Element | Detail |
|---------|--------|
| **Unread dot** | `●` (6px circle, `bg-accent`) when `unread`; hidden otherwise |
| **Media icon** | `FileText` (article), `Book` (book), `Headphones` (podcast), `Video` (video) — from lucide-react |
| **Title** | `text-sm font-medium text-primary`, single line truncate |
| **Source name** | `text-xs text-secondary` — `SourceEndpoint.title` |
| **Reading time** | `text-xs text-subtle` — from `MetadataLayer.readingTimeMinutes` |
| **Relative time** | `text-xs text-subtle` — from `publishedAt` |
| **Pipeline chip** | `Chip` (size="sm") showing `translating…` / `extracting…` when status ∉ `ready_to_read`/`archived`. See §10. |
| **Progress indicator** | Small circular progress ring (for books/long-form with `readingProgress > 0`) |
| **Bookmark** | `Bookmark` / `BookmarkCheck` icon toggle |

**Interaction**:
- Click → opens item in **Unified Reader View** (§5)
- Right-click / long-press → context menu: Open, Archive, Mark as Read, Delete, Copy URL
- Keyboard: ↑/↓ to navigate, Enter to open, `a` to archive

**Scroll**: Virtual scroll (`overflow-y: auto`) on the content list. Header + Tabs + Filters are sticky.

### 3.6 Right Panel — Item Preview

When an item is **selected** (single-click or arrow-key focused) but not yet opened:

```
┌───────────────────────┐
│  [Preview]            │
│                       │
│  Article Title        │
│  By Author · Source   │
│  ─────────────────    │
│  5 min · 1,200 words  │
│  Published 2024-01-15 │
│  Language: en-US      │
│  ─────────────────    │
│                       │
│  AI 摘要              │
│  "Summary text from   │
│   DerivedLayer…"      │
│  ─────────────────    │
│                       │
│  关键引用              │
│  · "Quote 1…"         │
│  · "Quote 2…"         │
│  ─────────────────    │
│                       │
│  主题                  │
│  [Topic1] [Topic2]    │
│  ─────────────────    │
│                       │
│  管道状态              │
│  ✓ fetch → ✓ extract  │
│  → ✓ ready            │
│  ─────────────────    │
│                       │
│  [打开阅读]  [归档]    │
└───────────────────────┘
```

| Section | Source |
|---------|--------|
| Metadata | `MetadataLayer` (title, author, language, wordCount, readingTimeMinutes, tags) |
| AI Summary | `DerivedLayer.aiSummary` |
| Key Quotes | `DerivedLayer.keyQuotes` |
| Topics | `DerivedLayer.topics` → rendered as `Chip` (variant="flat", size="sm") |
| Pipeline Status | `ContentState` from state machine, visualized as step dots |
| Actions | `Button` "打开阅读" (primary) + `Button` "归档" (flat) |

---

## 4. Subscription Management

### 4.1 Add Source Dialog

Triggered by the **⊕** button in the Library header. Uses a **slide-over panel** that replaces the right panel content (stays within the 3-panel layout, no modal overlay).

```
┌─ Right Panel (w-72) ──────────┐
│  ← 添加来源                    │
│  ──────────────────────────── │
│                               │
│  [🔗 输入网址或 RSS 地址…    ] │
│                               │
│  ──── 发现结果 ──────────────  │
│                               │
│  ┌─ Feed Result ────────────┐ │
│  │  📡  Blog RSS Feed       │ │
│  │      blog.example.com    │ │
│  │      "Description…"      │ │
│  │              [+ 订阅]    │ │
│  └──────────────────────────┘ │
│  ┌─ Feed Result ────────────┐ │
│  │  📡  Atom Feed           │ │
│  │      blog.example.com    │ │
│  │              [+ 订阅]    │ │
│  └──────────────────────────┘ │
│                               │
│  ──── 或 ────────────────────  │
│                               │
│  [📡 RSS 订阅]               │
│  [🔍 站点监控]               │
│  [📨 社交摘要]               │
│  [📎 手动添加 URL]           │
│                               │
└───────────────────────────────┘
```

**Flow**:

1. User pastes URL → calls `discoverRssFeeds(url, html)` → shows `RssDiscoveryResult[]`
2. Each result shows feed title, site URL, description
3. User clicks "+ 订阅" → calls `createSubscription()` with the selected feed
4. If no feeds found → offer "站点监控" (`createSiteWatch`) or "手动添加" (manual URL)

**HeroUI Components**:
- `Input` (variant="bordered", startContent={`Link` icon}) for URL entry
- `Button` (variant="flat", size="sm") for "订阅"
- `Card` for each discovery result
- `Separator` between sections
- `Spinner` during discovery

### 4.2 Subscription List View

Accessible from the **⋯** menu → "管理订阅". Replaces the main content area.

```
┌─── Main Content ──────────────────────────────────────────────┐
│  ← 订阅管理                                    🔍  ⊕  ⋯    │
│  ─────────────────────────────────────────────────────────── │
│  活跃 (8)  │  已暂停 (2)  │  错误 (1)  │  已归档 (0)         │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  ┌─ Subscription Row ──────────────────────────────────────┐  │
│  │  🌐  Hacker News RSS                                    │  │
│  │      rss · 每60分钟 · 上次抓取: 10分钟前                   │  │
│  │      [●活跃]                    [⏸暂停] [⚙设置] [🗑]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─ Subscription Row ──────────────────────────────────────┐  │
│  │  🌐  Stratechery                                        │  │
│  │      newsletter · 每120分钟 · 上次抓取: 1小时前            │  │
│  │      [●活跃]                    [⏸暂停] [⚙设置] [🗑]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─ Subscription Row (error) ──────────────────────────────┐  │
│  │  🌐  Broken Feed                                ⚠       │  │
│  │      rss · 错误: 404 Not Found                           │  │
│  │      [●错误]                    [🔄重试] [⚙设置] [🗑]    │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 Subscription Detail (Right Panel)

When a subscription row is selected, the right panel shows:

```
┌─ Right Panel ─────────────────┐
│  [Subscription Detail]        │
│                               │
│  Hacker News RSS              │
│  📡 rss_feed                  │
│  ──────────────────────────── │
│                               │
│  状态:  [●活跃]               │
│  频率:  每 [60▾] 分钟         │
│  语言:  en-US                 │
│  URL:   hn.algolia.com/rss    │
│  ──────────────────────────── │
│                               │
│  抓取统计                      │
│  上次抓取: 10分钟前             │
│  总抓取数: 342                 │
│  本周新增: 28                  │
│  ──────────────────────────── │
│                               │
│  操作                          │
│  [⏸ 暂停]  [🔇 静默]         │
│  [🗑 退订]                    │
└───────────────────────────────┘
```

| Control | Maps to |
|---------|---------|
| Frequency dropdown | `SubscriptionManager.setFetchInterval(id, minutes)` — options: 15, 30, 60, 120, 360, 720, 1440 min |
| 暂停/恢复 | `SubscriptionManager.pause(id)` / `.resume(id)` |
| 静默/取消静默 | `SubscriptionManager.mute(id)` / `.unmute(id)` — muted sources don't contribute to unread badge |
| 退订 | `SubscriptionManager.unsubscribe(id)` — confirmation via popover, not modal |

**Status Chips** (maps to `SourceEndpointStatus`):

| Status | Chip | Color |
|--------|------|-------|
| `active` | `●活跃` | `color="success"` |
| `paused` | `⏸已暂停` | `color="warning"` |
| `error` | `⚠错误` | `color="danger"` |
| `archived` | `📦已归档` | `color="default"` |

---

## 5. Unified Reader View

THE core experience. When user opens an item from the Library, the entire 3-panel layout transforms.

### 5.1 Full Layout

```
┌─ Left (collapsed) ┐┌──── Main Content (flex-1) ─────────────────┐┌─ Right Panel (w-72) ────┐
│                    ││ ┌─ Reader Toolbar ───────────────────────┐  ││                          │
│  ○                 ││ │ ← 返回  │  Title…          │ 🌐 ⋯   │  ││  [Context Panel]         │
│  ──                ││ └────────────────────────────────────────┘  ││                          │
│  📅               ││                                             ││  Tabs:                   │
│  ◎                ││ ┌─ Source Info Bar ───────────────────────┐  ││  [批注] [相关] [目录]     │
│  📊               ││ │ 🌐 source.com · Author · Jan 15, 2024 │  ││                          │
│  ──                ││ │ 5 min read · 1,200 words     [原文链接]│  ││  ── Highlights ────────  │
│  📖 ●             ││ └────────────────────────────────────────┘  ││                          │
│  ──                ││                                             ││  ┌─ Highlight ──────┐   │
│  📁               ││  ┌─ Reading Progress ──────────────────┐    ││  │ "Quote text…"     │   │
│  📋               ││  │ ████████████░░░░░░░░░░░░░░░  42%   │    ││  │ 🟡 · 10:23 AM    │   │
│                    ││  └─────────────────────────────────────┘    ││  │ [Note attached]   │   │
│                    ││                                             ││  └───────────────────┘   │
│                    ││  ┌─ Translation Toggle ────────────────┐    ││                          │
│                    ││  │ [原文] [双语] [多语]  │ 🌐 zh→en   │    ││  ┌─ Highlight ──────┐   │
│                    ││  └─────────────────────────────────────┘    ││  │ "Another quote…"  │   │
│                    ││                                             ││  │ 🟢 · 10:25 AM    │   │
│                    ││  ── Article Content ─────────────────────   ││  └───────────────────┘   │
│                    ││                                             ││                          │
│                    ││  Paragraph text here. This is the main      ││  ── Related ──────────   │
│                    ││  reading area with comfortable line height   ││                          │
│                    ││  and optimal reading width (max-w-prose,     ││  · Related Article 1    │
│                    ││  ~65ch).                                     ││  · Related Article 2    │
│                    ││                                             ││                          │
│                    ││  > Blockquote with special styling          ││  ── Definitions ──────   │
│                    ││                                             ││                          │
│                    ││  More paragraph text with [highlighted      ││  · Term → Definition    │
│                    ││  text shown with background color]…         ││                          │
│                    ││                                             ││                          │
│                    ││  ── Translation Layer (when bilingual) ──   ││                          │
│                    ││  Original paragraph                         ││                          │
│                    ││  译文段落（较小字号、不同颜色）                 ││                          │
│                    ││                                             ││                          │
│                    ││  (virtual scroll, smooth)                    ││                          │
└────────────────────┘└─────────────────────────────────────────────┘└──────────────────────────┘
```

### 5.2 Panel Behavior

| Panel | Reader Mode Behavior |
|-------|---------------------|
| **Left sidebar** | **Collapses to icon-only** (w-16 / 64px). Shows only nav icons, no labels. Active "阅读" icon highlighted. Click any icon → exits reader, navigates to that section. |
| **Main content** | Takes maximum width. Content constrained to `max-w-prose` (65ch) centered within the panel for optimal readability. Background: `bg-back`. |
| **Right panel** | Stays at `w-72`. Becomes the **Context Panel** with highlights, related items, and navigation. Can be toggled hidden via `PanelRightClose` icon for distraction-free reading (main content expands to full width). |

### 5.3 Reader Toolbar

Sticky at top of main content, `bg-base/80 backdrop-blur-md` for transparency.

| Element | Component | Action |
|---------|-----------|--------|
| ← 返回 | `Button` (variant="light", isIconOnly) | `ChevronLeft` — returns to Library, preserving scroll position |
| Title | `<span>` | Truncated article title, `text-sm text-primary` |
| 🌐 Translation | `Button` (isIconOnly) | `Languages` icon — toggles translation bar |
| ⋯ More | `Button` (isIconOnly) | `MoreHorizontal` — dropdown: Font size, Theme (serif/sans), Copy URL, Share, Archive, Delete |

### 5.4 Source Info Bar

Non-sticky, scrolls with content. `text-xs text-secondary`.

Elements: favicon + source name · author · date · reading time · word count · `Button` "原文链接" (external link icon).

### 5.5 Main Content Area

- **Typography**: `font-sans` default, user-switchable to `font-serif` via ⋯ menu
- **Font size**: 4 steps — 14/16/18/20px, controlled via reader settings, stored in localStorage
- **Line height**: `leading-relaxed` (1.75) for body, `leading-tight` for headings
- **Max width**: `max-w-prose` centered with `mx-auto`
- **Paragraph spacing**: `space-y-4` (16px) between paragraphs
- **Rendered by**: `ArticleRenderer.renderParagraphs()` → maps `ArticleSectionKind` to styled elements:

| `ArticleSectionKind` | Styling |
|----------------------|---------|
| `paragraph` | `text-primary leading-relaxed` |
| `heading` | `text-lg font-semibold text-primary mt-8 mb-4` |
| `blockquote` | `border-l-3 border-accent pl-4 text-secondary italic` |
| `code` | `bg-el-subtle rounded-lg p-4 font-mono text-sm` |
| `image` | `rounded-lg max-w-full` with optional caption |
| `list` | `list-disc pl-6 space-y-1` |

### 5.6 Highlight Layer

Highlights rendered as `<mark>` overlays on the content text, using `HighlightColor` mapping:

| `HighlightColor` | CSS | Tailwind |
|------------------|-----|----------|
| `yellow` | `oklch(0.95 0.12 90)` | `bg-yellow-200/50 dark:bg-yellow-800/30` |
| `green` | `oklch(0.93 0.10 145)` | `bg-green-200/50 dark:bg-green-800/30` |
| `blue` | `oklch(0.93 0.10 240)` | `bg-blue-200/50 dark:bg-blue-800/30` |
| `pink` | `oklch(0.93 0.10 350)` | `bg-pink-200/50 dark:bg-pink-800/30` |
| `purple` | `oklch(0.93 0.10 300)` | `bg-purple-200/50 dark:bg-purple-800/30` |
| `orange` | `oklch(0.93 0.12 60)` | `bg-orange-200/50 dark:bg-orange-800/30` |

Clicking a highlight scrolls the right-panel Context Panel to the corresponding annotation.

### 5.7 Reading Progress

Thin (`h-1`) progress bar fixed at very top of main content, above toolbar.

- Color: `bg-accent` (fills left-to-right)
- Tracks: `ReaderScrollState.scrollPercentage`
- Updates via `updateReadingProgress(vm, scrollPercentage, paragraphIndex)` on scroll (debounced 500ms)

### 5.8 Context Panel (Right Panel in Reader Mode)

Three tabs using `Tabs`:

**Tab 1: 批注 (Annotations)**
- Lists all `Highlight[]` and `Note[]` for this article
- Each item shows: quote text (truncated), color dot, timestamp
- Click → scrolls main content to the anchor position
- "+" button at bottom → same as text selection highlight flow

**Tab 2: 相关 (Related)**
- `ContextSidebarItem[]` where `kind === 'related_article' | 'definition'`
- Related articles: title + source, click → opens in reader
- Definitions: term + explanation (from glossary or AI-derived)

**Tab 3: 目录 (Outline)**
- Auto-generated from `heading` blocks in `ArticleSection[]`
- Indented by heading level
- Click → smooth scroll to heading
- Active heading highlighted based on scroll position

---

## 6. Highlight & Annotation UI

### 6.1 Text Selection → Floating Menu

When user selects text in the reader content area, a **floating toolbar** appears above the selection:

```
            ┌──────────────────────────────────────────────────┐
            │  🟡 🟢 🔵 🟣 🩷 🟠  │  📝 💡 🔬 ✅ ✍️  │  ⋯  │
            └──────────────────────────────────────────────────┘
                              ▼
          "The selected text appears highlighted here"
```

**Left group — Highlight colors** (maps to `HighlightColor`):
- 6 color circles, each 20px
- Tap → instantly creates highlight via `createHighlightExit()`
- Default color remembered from last selection

**Right group — Reading Exit actions** (maps to `ReadingExitKind`):
- 📝 `to_highlight` → create highlight + open annotation input
- 💡 `to_note` → create note (opens inline note editor)
- 🔬 `to_research` → create research question
- ✅ `to_action` → create task
- ✍️ `to_writing` → insert into draft
- See §11 for full detail

**⋯ More**:
- Copy text
- Look up / Dictionary
- Search in Orbit
- Translate selection

### 6.2 Annotation Input

After highlighting, an **inline annotation card** slides in below the highlighted text:

```
  "The highlighted text shown here with yellow background"
  ┌─ Annotation Input ────────────────────────────────┐
  │  [Type your note here…                          ] │
  │                                                    │
  │  Color: 🟡 🟢 🔵 🟣 🩷 🟠                         │
  │  Kind:  [高亮▾]  (高亮 / 问题 / 证据 / 引用)        │
  │                              [取消]  [保存]        │
  └────────────────────────────────────────────────────┘
```

- `Input` (variant="bordered", multiline) for note text
- Color selector: 6 circles, pre-selected
- Kind selector: dropdown mapping to `HighlightKind` (`highlight`, `question_seed`, `evidence`, `quote`)
- `Button` "保存" (variant="solid", color="primary"), `Button` "取消" (variant="light")
- Keyboard: `Cmd+Enter` to save, `Escape` to cancel

---

## 7. Translation Toggle

### 7.1 Translation Bar

Appears below source info bar when user activates translation (🌐 icon in toolbar):

```
┌─ Translation Bar ──────────────────────────────────────────┐
│  模式: [原文] [段落双语] [多语] [术语优先]   语言: [zh→en ▾] │
└────────────────────────────────────────────────────────────┘
```

**Mode selector**: `Tabs` (variant="underlined", size="sm") mapping to `TranslationMode`:

| UI Label | `TranslationMode` | Behavior |
|----------|-------------------|----------|
| 原文 | `off` | No translation shown |
| 段落双语 | `paragraph_bilingual` | Each paragraph followed by translation |
| 多语 | `multilingual` | Side-by-side columns (only when viewport ≥ 1280px) |
| 术语优先 | `glossary_priority` | Inline term translations only (uses `GlossaryEntry[]`) |

**Language selector**: `Button` (variant="flat", size="sm") → popover with source/target language pickers. Maps to `TranslationConfig.sourceLanguage` / `targetLanguages`.

### 7.2 Bilingual View (`paragraph_bilingual`)

The default and most common mode. Uses `buildBilingualView()`.

```
  Original paragraph text in the source language. This is displayed
  at full font size with the primary text color.

  译文段落。以较小字号显示，使用 text-secondary 颜色，
  带左侧 2px 竖线装饰（border-l-2 border-accent-soft）。
```

| Layer | Style |
|-------|-------|
| Original | `text-primary text-base` (user's selected font size) |
| Translation | `text-secondary text-sm mt-1 pl-3 border-l-2 border-accent-soft` |

### 7.3 Multilingual Side-by-Side (`multilingual`)

Only available when `main content panel width ≥ 768px`. Otherwise falls back to bilingual.

```
┌─── Original (50%) ──────────┐┌─── Translation (50%) ────────┐
│                              ││                               │
│  Original paragraph 1        ││  翻译段落 1                    │
│                              ││                               │
│  Original paragraph 2        ││  翻译段落 2                    │
│                              ││                               │
└──────────────────────────────┘└───────────────────────────────┘
```

Uses `grid grid-cols-2 gap-6`. Paragraphs synced by index from `BilingualParagraph[]`.

### 7.4 Glossary Priority (`glossary_priority`)

Original text displayed normally, with glossary terms underlined with a dotted line. Hover/tap shows a tooltip with `GlossaryEntry.preferredTranslation` and `context`.

```
  This paragraph discusses the concept of ̲a̲t̲t̲e̲n̲t̲i̲o̲n̲ ̲m̲e̲c̲h̲a̲n̲i̲s̲m̲
  in the context of transformer architectures.
                                    ┌─────────────────────┐
                                    │ 注意力机制            │
                                    │ context: 深度学习术语 │
                                    └─────────────────────┘
```

Uses a `Tooltip` (from HeroUI) or custom popover on the dotted-underlined span.

---

## 8. Book / Long-form View

When `getRendererForMediaType(mediaType)` returns `'book'`, the reader adapts.

### 8.1 Layout Changes

```
┌─ Left (icon) ──┐┌──── Main Content ──────────────────────┐┌─ Right Panel ────────────┐
│                ││ ┌─ Book Toolbar ─────────────────────┐  ││                          │
│  ○             ││ │ ← │ Book Title   │ Ch 3/12 │ ⋯   │  ││  [目录]                  │
│                ││ └────────────────────────────────────┘  ││                          │
│                ││ ┌─ Chapter Header ───────────────────┐  ││  Pt I: Foundation        │
│                ││ │ 第三章：Attention Is All You Need  │  ││    ├ Ch 1 ✓             │
│                ││ └────────────────────────────────────┘  ││    ├ Ch 2 ✓             │
│                ││                                         ││    ├ Ch 3 ● ←           │
│                ││  Chapter content flows here…            ││    └ Ch 4               │
│                ││                                         ││  Pt II: Applications     │
│                ││  (same typography as article view)      ││    ├ Ch 5               │
│                ││                                         ││    ├ Ch 6               │
│                ││                                         ││    └ Ch 7               │
│                ││ ┌─ Chapter Nav ──────────────────────┐  ││                          │
│                ││ │  ← 上一章          下一章 →        │  ││  ── 书签 ──────────────   │
│                ││ └────────────────────────────────────┘  ││                          │
│                ││                                         ││  · p.42 "Quote…"        │
│                ││ ┌─ Progress Footer ─────────────────┐  ││  · p.87 "Quote…"        │
│                ││ │ ████████████░░░░░░  42% · p.87    │  ││                          │
│                ││ └────────────────────────────────────┘  ││  ── 批注 ──────────────   │
│                ││                                         ││  (same as article)       │
└────────────────┘└─────────────────────────────────────────┘└──────────────────────────┘
```

### 8.2 Key Differences from Article View

| Feature | Article | Book |
|---------|---------|------|
| **Right panel default tab** | 批注 (Annotations) | 目录 (Chapter TOC) |
| **Navigation** | Continuous scroll | Chapter-based with prev/next buttons |
| **Progress** | Scroll percentage | Page/chapter + percentage |
| **Toolbar info** | Source + date | Chapter X of Y |
| **Bookmarks** | Not shown | Bookmark list in right panel |

### 8.3 Chapter Navigation (Right Panel)

Renders `ChapterNode[]` from `BookRenderer.renderChapterTree()` as a tree:

- Indentation based on `ChapterNode.level`
- `✓` for completed chapters (readingProgress of chapter = 100%)
- `●` for current chapter
- Click → navigates to chapter, loads `ChapterNode.content`

### 8.4 Reading Progress Bar

Fixed at bottom of main content:

```
┌──────────────────────────────────────────────────────────┐
│  ████████████████████░░░░░░░░░░░░░░  42%  ·  第87页     │
│  第3章 / 共12章                                          │
└──────────────────────────────────────────────────────────┘
```

- `progress` element styled with `bg-accent` fill
- Percentage: `Book.readingProgress`
- Page: derived from scroll position within chapter
- Chapter: `Book.currentChapter` of `Book.totalChapters`

### 8.5 Bookmark System

- **Add bookmark**: Click `Bookmark` icon in toolbar or use `Cmd+D`
- **Bookmark list**: Right panel "书签" section, sorted by page number
- Each bookmark: page number + first line of text at that position
- Click → navigates to bookmarked position

---

## 9. Transcript / Podcast View

When `getRendererForMediaType(mediaType)` returns `'transcript'`.

### 9.1 Layout

```
┌─ Left (icon) ──┐┌──── Main Content ──────────────────────────┐┌─ Right Panel ──────┐
│                ││ ┌─ Player Bar (sticky) ──────────────────┐  ││                    │
│                ││ │  ▶ advancement  │▁▂▃▅▆▇█▇▅▃▁│  32:15 │  ││  [搜索转录文本]     │
│                ││ │  ⏮ ⏪   ▶   ⏩ ⏭   1.0x▾  🔊        │  ││                    │
│                ││ └────────────────────────────────────────┘  ││  ── 发言人 ────────│
│                ││                                             ││                    │
│                ││  ┌─ Segment ──────────────────────────────┐ ││  🔴 Host           │
│                ││  │  🔴 Host                      [00:00]  │ ││  🔵 Guest          │
│                ││  │  Welcome to the show. Today we're      │ ││                    │
│                ││  │  going to talk about…                  │ ││  ── 章节 ──────────│
│                ││  └────────────────────────────────────────┘ ││                    │
│                ││  ┌─ Segment (active) ─────────────────────┐ ││  · Intro  [00:00]  │
│                ││  │  🔵 Guest                     [05:23]  │ ││  · Topic 1 [05:00] │
│                ││  │  That's a great question. The key      │ ││  · Topic 2 [18:30] │
│                ││  │  insight is that…                      │ ││  · Closing [45:00] │
│                ││  └────────────────────────────────────────┘ ││                    │
│                ││  ┌─ Segment ──────────────────────────────┐ ││  ── 高亮 ──────────│
│                ││  │  🔴 Host                      [07:45]  │ ││                    │
│                ││  │  Could you elaborate on…               │ ││  · "Key insight…"  │
│                ││  └────────────────────────────────────────┘ ││    [05:23]          │
│                ││                                             ││                    │
│                ││  (segments auto-scroll to follow playback)  ││                    │
└────────────────┘└─────────────────────────────────────────────┘└────────────────────┘
```

### 9.2 Player Bar

Sticky at top of main content. Minimal integrated player concept (actual audio playback is a platform concern; UI provides the control surface).

| Element | Component |
|---------|-----------|
| Play/Pause | `Button` (isIconOnly, variant="solid", color="primary") |
| Skip ±15s | `Button` (isIconOnly, variant="light") — `SkipBack` / `SkipForward` icons |
| Waveform / Scrubber | Custom `div` with progress bar + click-to-seek |
| Time | `text-xs font-mono text-secondary` — current / total |
| Speed | `Button` (variant="flat", size="sm") → popover: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x |
| Volume | `Volume2` icon + slider |

### 9.3 Transcript Segments

Each `TranscriptSegment` rendered as a block:

```tsx
// Active segment (currently playing):
// bg-accent-soft border-l-3 border-accent

// Inactive segment:
// hover:bg-el-subtle-hover

// Segment layout:
// [SpeakerColorDot] [SpeakerLabel]          [Timecode]
// [Transcript text, full width]
```

- **Speaker color**: from `SpeakerProfile.color` — rendered as a 10px dot
- **Timecode**: `text-xs font-mono text-subtle`, formatted as `MM:SS`
- **Active segment**: determined by `getSegmentAtTime(transcript, currentPlaybackTime)`, auto-scrolls into view
- **Click segment**: seeks playback to `segment.startTime`
- **Text selection**: same floating menu as article view (§6), but `AnchorData` includes `startTime`/`endTime` from the segment

### 9.4 Right Panel

| Section | Content |
|---------|---------|
| **搜索** | `Input` (variant="bordered") → calls `searchTranscript(transcript, query)` → highlights matching segments |
| **发言人** | `SpeakerProfile[]` with color dots and labels. Click to filter segments to that speaker. |
| **章节** | AI-derived chapter markers (from `DerivedLayer.topics`) with timecodes. Click → seek. |
| **高亮** | Same as article highlight list, but with timecodes instead of paragraph indices. |

### 9.5 Translation for Transcripts

Translation toggle works the same as article view (§7). In bilingual mode, each segment shows original + translation:

```
┌─ Segment ──────────────────────────────────────┐
│  🔵 Guest                            [05:23]   │
│  The key insight is that attention…             │
│  关键洞察是，注意力机制…                          │
└─────────────────────────────────────────────────┘
```

---

## 10. Content Pipeline Status

Users need to understand why an item isn't ready yet. Pipeline status is shown in **three places**.

### 10.1 Library List — Inline Chip

Items not yet `ready_to_read` show a `Chip` in the row:

| `ContentState` | Chip Label | Chip Color | Icon |
|----------------|-----------|------------|------|
| `discovered` | 已发现 | `default` | `Globe` |
| `saved` | 已保存 | `default` | `Bookmark` |
| `queued` | 队列中 | `default` | `Clock` |
| `fetching` | 抓取中… | `primary` | `Loader` (spinning) |
| `fetched` | 已抓取 | `success` | `Check` |
| `normalizing` | 处理中… | `primary` | `Loader` (spinning) |
| `extracting` | 提取中… | `primary` | `Loader` (spinning) |
| `extracted` | 已提取 | `success` | `Check` |
| `transcribing` | 转录中… | `primary` | `Loader` (spinning) |
| `translating` | 翻译中… | `primary` | `Loader` (spinning) |
| `ready_to_read` | (no chip) | — | — |
| `archived` | 已归档 | `default` | `Archive` |
| `fetch_failed` | 抓取失败 | `danger` | `AlertCircle` |
| `extract_failed` | 提取失败 | `danger` | `AlertCircle` |
| `transcribe_failed` | 转录失败 | `danger` | `AlertCircle` |
| `quarantined` | 已隔离 | `warning` | `ShieldAlert` |

### 10.2 Right Panel — Pipeline Steps

In the Library's right panel preview (§3.6), a **step indicator** shows the pipeline progress:

```
  管道状态
  ── fetch ──── extract ──── normalize ──── ready ──
      ✓            ✓           ◎ (running)     ○
```

Each step from `PipelineStep[]`:
- `✓` (`success`) — filled green circle
- `◎` (`running`) — pulsing accent circle
- `✗` (`failed`) — red circle with click-to-retry
- `○` (`pending`) — empty circle
- `—` (`skipped`) — gray dash

### 10.3 Error Recovery

When a step fails:
- The chip in the list row turns red: `抓取失败`
- The right panel shows the error message from `PipelineStep.error`
- A `Button` "重试" (variant="flat", color="primary") calls the retry flow
- Retry respects `RetryPolicy` (max 3 retries, exponential backoff)
- If `quarantined`, show explanation and "重新发现" button to restart from `discovered`

---

## 11. Reading Exit Actions

The most important interaction pattern. When text is selected in the reader, the floating menu (§6.1) offers 5 exit actions.

### 11.1 Floating Action Menu — Full Spec

```
┌───────────────────────────────────────────────────────┐
│  Colors:  🟡 🟢 🔵 🟣 🩷 🟠                          │
│  ─────────────────────────────────────────────────── │
│  📝 保存高亮     Save as highlight                    │
│  💡 创建笔记     Create a note from selection         │
│  🔬 加入研究     Add to research question             │
│  ✅ 创建任务     Create a task from this              │
│  ✍️ 用于写作     Insert into current draft            │
│  ─────────────────────────────────────────────────── │
│  📋 复制文本     Copy to clipboard                    │
│  🔍 在Orbit搜索  Search in workspace                  │
│  🌐 翻译选区     Translate selection                  │
└───────────────────────────────────────────────────────┘
```

**Positioning**: Centered above selection, capped to viewport. If selection is near top, menu appears below. Uses `position: absolute` relative to the reader content container.

**Appearance**: `bg-base border border-el rounded-xl shadow-lg p-2`. Each row is `Button` (variant="light", size="sm", fullWidth, justify="start").

### 11.2 Exit Flows

| Exit | `ReadingExitKind` | Immediate Action | Follow-up |
|------|-------------------|-----------------|-----------|
| **保存高亮** | `to_highlight` | Creates `Highlight` with selected `HighlightColor` via `createHighlightExit()` | Optional: opens annotation input inline (§6.2) |
| **创建笔记** | `to_note` | Creates `Note` (kind='annotation', origin='highlight') via `createNoteExit()` | Opens a **mini editor** inline below the selection. Uses the block editor from `editor-dom` in compact mode. `Cmd+Enter` saves. |
| **加入研究** | `to_research` | Creates `research_question` object via `createResearchExit()` | Toast: "已加入研究问题". Click toast → navigates to research view. |
| **创建任务** | `to_action` | Creates `Task` via `createActionExit()` | Opens a small **inline task form**: title (pre-filled from selection), project selector, due date. |
| **用于写作** | `to_writing` | Copies selection + source attribution via `createWritingExit()` | If a draft is open in the editor, inserts as a `quote` block with source. If no draft, creates a new one. Toast: "已插入草稿". |

### 11.3 Inline Micro-Forms

For "创建笔记" and "创建任务", small forms appear **below the selected text** (not in a modal):

**Note micro-form**:
```
┌─ 新笔记 ─────────────────────────────────────────┐
│  > "Selected quote text…"                         │
│  ──────────────────────────────────────────────── │
│  [Your thoughts on this…                        ] │
│  ──────────────────────────────────────────────── │
│  Kind: [注解▾]   Link: [选择关联对象…]             │
│                                [取消]  [保存]     │
└───────────────────────────────────────────────────┘
```

**Task micro-form**:
```
┌─ 新任务 ─────────────────────────────────────────┐
│  标题: [Pre-filled from selection…             ]  │
│  项目: [选择项目 ▾]                               │
│  截止: [选择日期]                                  │
│                                [取消]  [创建]     │
└───────────────────────────────────────────────────┘
```

### 11.4 Toast Notifications

After any exit action, a toast appears at bottom-center:

```
┌──────────────────────────────────────┐
│  ✓  已保存高亮                [撤销]  │
└──────────────────────────────────────┘
```

- Auto-dismiss after 4 seconds
- "撤销" (Undo) undoes the action
- Stacks if multiple toasts (max 3 visible)

---

## 12. Empty States

### 12.1 First-time User — No Subscriptions

```
┌─── Main Content ──────────────────────────────────────────┐
│                                                            │
│                        📖                                  │
│                                                            │
│              开始你的全源阅读之旅                             │
│                                                            │
│      订阅 RSS、监控网站、或手动添加文章，                      │
│      Orbit 会自动抓取、提取和整理内容。                       │
│                                                            │
│              [+ 添加第一个来源]                              │
│                                                            │
│      ──── 快速开始 ────                                    │
│                                                            │
│      📡 粘贴 RSS 链接                                      │
│      🌐 输入任意网址，自动发现订阅源                          │
│      📎 粘贴文章链接，手动添加                                │
│      📚 导入 OPML 文件                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- `Button` "添加第一个来源" (variant="solid", color="primary", size="lg")
- Quick-start items are `Button` (variant="light", fullWidth, justify="start")
- Illustration: `BookOpen` icon at 48px, `text-subtle`

### 12.2 Has Subscriptions, No Articles Yet

```
│                        ⏳                                  │
│                                                            │
│              正在获取内容…                                   │
│                                                            │
│      你的订阅源已添加，Orbit 正在抓取最新内容。                │
│      通常需要几分钟时间。                                    │
│                                                            │
│              [查看订阅状态]                                  │
```

- Shows pipeline activity indicator
- `Button` "查看订阅状态" → navigates to subscription management

### 12.3 Inbox Tab Empty (all read)

```
│                        ✨                                  │
│                                                            │
│              全部读完了！                                    │
│                                                            │
│      没有未读内容。去 [全部] 标签查看所有文章，                │
│      或 [添加新来源] 发现更多内容。                           │
```

### 12.4 Search — No Results

```
│                        🔍                                  │
│                                                            │
│              未找到匹配内容                                  │
│                                                            │
│      尝试不同的关键词，或 [清除筛选条件]。                     │
```

### 12.5 Reader — Translation Unavailable

```
  (inside translation bar area)
  ┌──────────────────────────────────────────────────┐
  │  ⚠ 翻译暂不可用。此内容的语言尚未被检测到。        │
  │     [手动设置源语言]                               │
  └──────────────────────────────────────────────────┘
```

### 12.6 Error State — Pipeline Failure

```
│                        ⚠️                                  │
│                                                            │
│              内容获取失败                                    │
│                                                            │
│      错误: 404 Not Found                                   │
│      URL: https://example.com/article                      │
│                                                            │
│              [重试]  [查看原文]  [删除]                      │
```

---

## 13. Mobile Adaptation

Reference: `packages/feature-mobile/` patterns. Mobile uses `packages/ui-native/` for iOS but also needs responsive web for `apps/web` on small screens.

### 13.1 Breakpoint Strategy

| Breakpoint | Layout | Panels |
|-----------|--------|--------|
| `≥1280px` (xl) | Full 3-panel | Sidebar + Main + Right |
| `≥768px` (md) | 2-panel | Sidebar (collapsible) + Main |
| `<768px` (sm) | Single panel | Stack with bottom nav |

### 13.2 Mobile Library (< 768px)

```
┌─ Mobile Library ──────────────────────┐
│  ┌─ Header ────────────────────────┐  │
│  │  阅读                  🔍  ⊕   │  │
│  └─────────────────────────────────┘  │
│  ┌─ Tabs (scrollable) ────────────┐  │
│  │  收件箱  全部  稍后读  已归档    │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─ Article Card ──────────────────┐  │
│  │  Title of the Article           │  │
│  │  source · 5 min · 3h ago       │  │
│  └─────────────────────────────────┘  │
│  ┌─ Article Card ──────────────────┐  │
│  │  Another Article                │  │
│  │  source · 8 min · 5h ago       │  │
│  └─────────────────────────────────┘  │
│  …                                    │
│                                       │
│  ┌─ Bottom Nav ────────────────────┐  │
│  │  📅  ◎  📖  📁  📋            │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

- Tabs become horizontally scrollable
- Filter bar collapses to a single "筛选" button opening a bottom sheet
- Right panel preview becomes a bottom sheet on item long-press
- No virtual scroll — native scroll with intersection observer

### 13.3 Mobile Reader (< 768px)

```
┌─ Mobile Reader ───────────────────────┐
│  ┌─ Toolbar ───────────────────────┐  │
│  │  ← │ Title…       │ 🌐  ⋯     │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─ Progress ──────────────────────┐  │
│  │  ████████░░░░░░░░░░  42%       │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Source · Author · 5 min              │
│                                       │
│  Article content flows here with      │
│  full width padding (px-4).           │
│                                       │
│  Text selection shows floating        │
│  menu as a bottom sheet instead       │
│  of hovering above selection.         │
│                                       │
│  Translation shown inline only        │
│  (no side-by-side on mobile).         │
│                                       │
└───────────────────────────────────────┘
```

- Right panel context → accessible via swipe-left gesture or `☰` icon → bottom sheet with annotations/outline
- Translation: only `paragraph_bilingual` mode available (no side-by-side)
- Floating action menu → bottom action sheet (similar pattern to iOS share sheet)
- Font size: responsive, min 16px on mobile for readability

### 13.4 Mobile Transcript View

- Player bar sticky at top (smaller, 48px height)
- Segments take full width
- Speed selector → bottom sheet
- Right panel sections → collapsible accordion within the main scroll

---

## 14. i18n Keys

New keys to register in `packages/i18n/src/` under the `reader.*` namespace:

```typescript
// Navigation
'reader.nav.label':            '阅读',
'reader.nav.badge.unread':     '{{count}} 篇未读',

// Library
'reader.library.title':        '阅读',
'reader.library.tab.inbox':    '收件箱',
'reader.library.tab.all':      '全部',
'reader.library.tab.later':    '稍后读',
'reader.library.tab.archived': '已归档',
'reader.library.filter.type':  '类型',
'reader.library.filter.source':'来源',
'reader.library.filter.lang':  '语言',
'reader.library.filter.sort':  '排序',
'reader.library.sort.newest':  '最新优先',
'reader.library.sort.oldest':  '最早优先',
'reader.library.sort.progress':'阅读进度',
'reader.library.sort.length':  '阅读时长',

// Subscription
'reader.sub.title':            '订阅管理',
'reader.sub.add':              '添加来源',
'reader.sub.add.url_placeholder': '输入网址或 RSS 地址…',
'reader.sub.add.discover':     '发现结果',
'reader.sub.add.subscribe':    '订阅',
'reader.sub.status.active':    '活跃',
'reader.sub.status.paused':    '已暂停',
'reader.sub.status.error':     '错误',
'reader.sub.status.archived':  '已归档',
'reader.sub.frequency':        '每 {{minutes}} 分钟',
'reader.sub.last_fetch':       '上次抓取: {{time}}',
'reader.sub.actions.pause':    '暂停',
'reader.sub.actions.resume':   '恢复',
'reader.sub.actions.mute':     '静默',
'reader.sub.actions.unmute':   '取消静默',
'reader.sub.actions.unsub':    '退订',
'reader.sub.actions.retry':    '重试',

// Reader
'reader.view.back':            '返回',
'reader.view.original_link':   '原文链接',
'reader.view.reading_time':    '{{minutes}} 分钟',
'reader.view.word_count':      '{{count}} 字',
'reader.view.progress':        '{{percent}}%',

// Context panel
'reader.context.tab.annotations':'批注',
'reader.context.tab.related':  '相关',
'reader.context.tab.outline':  '目录',
'reader.context.tab.bookmarks':'书签',

// Translation
'reader.translation.mode.off':       '原文',
'reader.translation.mode.bilingual': '段落双语',
'reader.translation.mode.multi':     '多语',
'reader.translation.mode.glossary':  '术语优先',
'reader.translation.lang_select':    '语言',
'reader.translation.unavailable':    '翻译暂不可用',

// Highlights & exits
'reader.highlight.save':       '保存高亮',
'reader.exit.to_note':         '创建笔记',
'reader.exit.to_research':     '加入研究',
'reader.exit.to_action':       '创建任务',
'reader.exit.to_writing':      '用于写作',
'reader.exit.copy':            '复制文本',
'reader.exit.search':          '在Orbit搜索',
'reader.exit.translate':       '翻译选区',

// Pipeline
'reader.pipeline.discovered':  '已发现',
'reader.pipeline.queued':      '队列中',
'reader.pipeline.fetching':    '抓取中…',
'reader.pipeline.extracting':  '提取中…',
'reader.pipeline.transcribing':'转录中…',
'reader.pipeline.translating': '翻译中…',
'reader.pipeline.ready':       '可阅读',
'reader.pipeline.failed':      '失败',
'reader.pipeline.retry':       '重试',

// Empty states
'reader.empty.first_time.title':      '开始你的全源阅读之旅',
'reader.empty.first_time.desc':       '订阅 RSS、监控网站、或手动添加文章，Orbit 会自动抓取、提取和整理内容。',
'reader.empty.first_time.cta':        '添加第一个来源',
'reader.empty.fetching.title':        '正在获取内容…',
'reader.empty.fetching.desc':         '你的订阅源已添加，Orbit 正在抓取最新内容。通常需要几分钟时间。',
'reader.empty.all_read.title':        '全部读完了！',
'reader.empty.all_read.desc':         '没有未读内容。',
'reader.empty.no_results.title':      '未找到匹配内容',
'reader.empty.no_results.desc':       '尝试不同的关键词，或清除筛选条件。',

// Book
'reader.book.chapter':         '第{{current}}章 / 共{{total}}章',
'reader.book.prev_chapter':    '上一章',
'reader.book.next_chapter':    '下一章',
'reader.book.page':            '第{{page}}页',

// Transcript
'reader.transcript.search':    '搜索转录文本',
'reader.transcript.speakers':  '发言人',
'reader.transcript.chapters':  '章节',

// Toast
'reader.toast.highlight_saved':'已保存高亮',
'reader.toast.note_created':   '已创建笔记',
'reader.toast.task_created':   '已创建任务',
'reader.toast.added_research': '已加入研究问题',
'reader.toast.inserted_draft': '已插入草稿',
'reader.toast.undo':           '撤销',
'reader.toast.archived':       '已归档',
```

---

## Component Inventory

Summary of all HeroUI and custom components required:

| Component | Source | Used In |
|-----------|--------|---------|
| `Button` | HeroUI | Everywhere — nav, toolbar, actions, forms |
| `Tabs` / `Tabs.List` / `Tabs.Tab` | HeroUI | Library tabs, context panel tabs, translation mode |
| `Chip` | HeroUI | Pipeline status, subscription status, topic tags |
| `Card` | HeroUI | Subscription discovery results, preview cards |
| `Input` | HeroUI | URL input, search, annotation text, note form |
| `Separator` | HeroUI | Section dividers in sidebar, panels |
| `Tooltip` | HeroUI | Glossary terms, icon buttons |
| `Spinner` | HeroUI | Pipeline loading states |
| `Progress` | HeroUI | Reading progress bar (if available) or custom div |
| `FloatingMenu` | Custom | Text selection action menu |
| `InlineAnnotation` | Custom | Annotation input below highlight |
| `PipelineSteps` | Custom | Pipeline step visualization |
| `TranscriptSegment` | Custom | Timecoded transcript blocks |
| `PlayerBar` | Custom | Audio/video playback controls |
| `ChapterTree` | Custom | Book chapter navigation |
| `BilingualBlock` | Custom | Paragraph + translation pair |
| `EmptyState` | Custom | Reusable empty state with icon + text + CTA |

---

## Interaction Summary

| User Action | Trigger | Result |
|-------------|---------|--------|
| Click "阅读" in sidebar | Nav click | Load Library view in main panel |
| Click article in list | Row click | Open Unified Reader view |
| Select text in reader | Mouse/touch selection | Show floating action menu |
| Choose highlight color | Menu click | Create highlight, dismiss menu |
| Choose "创建笔记" | Menu click | Open inline note form |
| Toggle translation | 🌐 icon | Show/hide translation bar |
| Switch translation mode | Tab click | Rebuild content with `buildBilingualView()` |
| Click chapter in TOC | Tree item click | Navigate to chapter content |
| Click transcript segment | Segment click | Seek audio to `startTime` |
| Scroll in reader | Scroll event | Update `ReaderScrollState` (debounced) |
| ← 返回 from reader | Button click | Return to Library, restore scroll position |
| Add source via ⊕ | Button click | Open Add Source in right panel |
| Paste URL in Add Source | Input + paste | Auto-discover feeds via `discoverRssFeeds()` |
| Right-click article row | Context menu | Archive / Mark Read / Delete / Copy URL |
| `Cmd+D` in book reader | Keyboard shortcut | Add bookmark at current position |
| Click failed pipeline chip | Chip click | Show error + retry option |

---

*End of design document.*
