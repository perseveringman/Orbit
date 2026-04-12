# 日志系统 (Journal) — UI Design Specification

> **Module:** `@orbit/feature-journal`
> **Status:** Proposal · v0.1
> **Platforms:** Desktop (Electron) · Web
> **Language:** zh-CN primary, en fallback

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Navigation Entry](#2-navigation-entry)
3. [Journal Day View — Primary View](#3-journal-day-view--primary-view)
4. [Calendar Navigation](#4-calendar-navigation)
5. [Day Note Editor](#5-day-note-editor)
6. [Timeline Visualization](#6-timeline-visualization)
7. [Summary Cards](#7-summary-cards)
8. [Insight Cards](#8-insight-cards)
9. [Privacy Indicators](#9-privacy-indicators)
10. [Protected Session UI](#10-protected-session-ui)
11. [Week / Month Overview](#11-week--month-overview)
12. [Empty States](#12-empty-states)
13. [Mobile Adaptation](#13-mobile-adaptation)
14. [Component Inventory](#14-component-inventory)
15. [Interaction Map](#15-interaction-map)

---

## 1. Design Principles

| Principle | Rationale |
|---|---|
| **被动可见 (Passive visibility)** | The journal is an ambient record, not a task. It should feel like opening a notebook, not a dashboard. |
| **五层渐进 (Five-layer progressive disclosure)** | Show Day Note + Timeline by default; Summary and Insights load on demand or after a scroll fold. |
| **隐私显眼 (Privacy first-class)** | Every entry's privacy state is visible at a glance. Protected mode is unmistakably communicated. |
| **时间即导航 (Time-as-navigation)** | Calendar is the primary navigation axis — all views anchor to a date. |
| **本地AI辅助 (Local AI assist)** | Summaries and insights are generated locally; always show provenance ("AI 生成" badge). |

---

## 2. Navigation Entry

### 2.1 Sidebar Placement

Add **"日志"** as a new section in the left sidebar, positioned between **Review (复盘)** and **Projects (项目)** — logically adjacent to both retrospective and project work.

```
┌──────────────────────────┐
│  🌀 Orbit                │
│                          │
│  [+ 新建对象]             │
│                          │
│  ── 工作区 ──             │
│  📅  今日          3      │
│  🎯  专注                 │
│  📊  复盘          1      │
│  📓  日志        ← NEW    │
│  ── 资源库 ──             │
│  📁  项目          5      │
│  ☑️  任务         12      │
│                          │
│  ⚙️  设置    🌙/☀️  👤    │
└──────────────────────────┘
```

### 2.2 Icon & Badge

| Element | Spec |
|---|---|
| **Icon** | `BookOpen` (Lucide) — conveys a notebook/diary metaphor, distinct from `Calendar` used by 今日 |
| **Label** | `日志` |
| **Badge** | Today's date number (e.g., `17`) rendered as a `Chip variant="soft" color="accent" size="sm"`. Only appears when `日志` is NOT the active section; when active, the badge hides since the user already sees today's date in the main view. |
| **Active state** | `bg-accent-soft text-accent font-medium` (consistent with existing sections) |
| **Inactive state** | `text-muted hover:bg-surface-secondary` |

### 2.3 Click Behavior

Clicking **日志** switches `activeSection` to `'journal'` and renders the **Journal Day View** for today's date in the main content panel. The right sidebar switches to a **Journal Context Panel** (calendar + insights summary).

---

## 3. Journal Day View — Primary View

The main content area (`flex-1`) renders a **single-day journal page** with five visually distinct regions stacked vertically. This mirrors the `JournalPage` interface: `dateHeader`, `dayNote`, `timeline`, `summary`, `insights`.

### 3.1 Layout Overview

```
┌─ Left Sidebar (w-60) ─┬─── Main Content (flex-1, max-w-3xl mx-auto) ────────┬─ Right Panel (w-72) ──┐
│                        │                                                      │                       │
│  ... nav sections ...  │  ┌─ [A] Date Header ──────────────────────────────┐  │  ┌─ Calendar ───────┐ │
│                        │  │  周三 · 2025年7月16日 · 今天     📊 12项活动    │  │  │  ◀ 7月 2025 ▶    │ │
│                        │  │  ──────────────────────────────────────────────│  │  │  Mo Tu We ...    │ │
│                        │  └────────────────────────────────────────────────┘  │  │  [16] ← active   │ │
│                        │                                                      │  │  dots = has data  │ │
│                        │  ┌─ [B] Day Note ─────────────────────────────────┐  │  └──────────────────┘ │
│                        │  │  📝 今日笔记                      🔒 normal    │  │                       │
│                        │  │  ┌──────────────────────────────────────────┐  │  │  ┌─ Quick Stats ───┐ │
│                        │  │  │  (block editor — editor-dom)            │  │  │  │  活动: 12        │ │
│                        │  │  │  Today I worked on the parser...        │  │  │  │  阅读: 3         │ │
│                        │  │  │  - Fixed bug in lexer                   │  │  │  │  写作: 2         │ │
│                        │  │  │  - Reviewed PR #42                      │  │  │  │  任务: 5 ✓       │ │
│                        │  │  └──────────────────────────────────────────┘  │  │  └──────────────────┘ │
│                        │  │  自动保存 · 上次编辑 14:32                      │  │                       │
│                        │  └────────────────────────────────────────────────┘  │  ┌─ Active Insight ─┐ │
│                        │                                                      │  │  🎯 专注模式      │ │
│                        │  ┌─ [C] Timeline ─────────────────────────────────┐  │  │  你 45% 时间花在  │ │
│                        │  │  ⏱ 活动时间线                    展开全部 ▾   │  │  │  "写作" 类型活动  │ │
│                        │  │                                                │  │  │  ── 置顶 · 忽略  │ │
│                        │  │  09:00 ─────────────────── 3 项              │  │  └──────────────────┘ │
│                        │  │  │ 📄 创建了 "解析器重构方案"      ●          │  │                       │
│                        │  │  │ 📖 开始阅读 "Crafting Interp…" ●          │  │  ┌─ Privacy Mode ───┐ │
│                        │  │  │ ☑️ 任务状态变更 "修复词法器"    ○          │  │  │  🟢 正常记录中    │ │
│                        │  │                                                │  │  │  [开启保护模式]   │ │
│                        │  │  10:00 ─────────────────── 5 项 ▸           │  │  └──────────────────┘ │
│                        │  │  (collapsed — click to expand)                 │  │                       │
│                        │  │                                                │  │                       │
│                        │  │  14:00 ─────────────────── 4 项              │  │                       │
│                        │  │  │ ✏️ 更新草稿 "周报"              ●          │  │                       │
│                        │  │  │ 🔗 关联了 "API设计" → "前端…"   ○          │  │                       │
│                        │  │  │ 📖 阅读进度 "Crafting…" 45%    ○          │  │                       │
│                        │  │  │ ✅ 完成任务 "修复词法器"        ●          │  │                       │
│                        │  └────────────────────────────────────────────────┘  │                       │
│                        │                                                      │                       │
│                        │  ── scroll fold (below-the-fold content) ──────────  │                       │
│                        │                                                      │                       │
│                        │  ┌─ [D] AI Summary ───────────────────────────────┐  │                       │
│                        │  │  🤖 AI 日总结              v1 · 生成于 23:00  │  │                       │
│                        │  │  ┌──────────────────────────────────────────┐  │  │                       │
│                        │  │  │  今天主要集中在解析器重构项目上…         │  │  │                       │
│                        │  │  │  完成了3项任务，阅读了1篇技术文章…      │  │  │                       │
│                        │  │  └──────────────────────────────────────────┘  │  │                       │
│                        │  │  [重新生成]  [查看来源]                        │  │                       │
│                        │  └────────────────────────────────────────────────┘  │                       │
│                        │                                                      │                       │
│                        │  ┌─ [E] Behavior Insights ────────────────────────┐  │                       │
│                        │  │  💡 行为洞察                                    │  │                       │
│                        │  │  ┌──────────────┐  ┌──────────────┐            │  │                       │
│                        │  │  │ 🎯 专注模式  │  │ 📊 输入输出  │            │  │                       │
│                        │  │  │ 45% 写作     │  │ 阅读:写作    │            │  │                       │
│                        │  │  │ ████████░░   │  │ = 3:2        │            │  │                       │
│                        │  │  │ 置顶 · 忽略  │  │ 置顶 · 忽略  │            │  │                       │
│                        │  │  └──────────────┘  └──────────────┘            │  │                       │
│                        │  └────────────────────────────────────────────────┘  │                       │
│                        │                                                      │                       │
└────────────────────────┴──────────────────────────────────────────────────────┴───────────────────────┘
```

### 3.2 Region Specifications

#### [A] Date Header

| Attribute | Spec |
|---|---|
| **Container** | `flex items-center justify-between px-6 py-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b border-border` |
| **Left group** | Day of week (`text-lg font-semibold text-foreground`) · Full date (`text-sm text-secondary`) · Today badge (`Chip color="accent" variant="soft" size="sm"` showing "今天") — only when viewing today |
| **Right group** | Notable count (`Chip variant="flat" size="sm"` — e.g., "12 项活动") · Privacy mode indicator (see §9) |
| **Date arrows** | `Button isIconOnly variant="ghost" size="sm"` with `ChevronLeft` / `ChevronRight` for prev/next day |
| **Interaction** | Click the date text to open calendar picker overlay. Arrow keys (← →) for prev/next day. |

#### [B] Day Note

| Attribute | Spec |
|---|---|
| **Container** | `Card` with subtle `border-border` border. Padding `p-4`. No shadow in light mode; `shadow-xs` in dark mode. |
| **Header** | Section label "📝 今日笔记" (`text-sm font-medium text-secondary`) + privacy chip (right-aligned) |
| **Editor area** | `editor-dom` block editor instance. Min height `120px`. Placeholder: "记录今天的想法…" |
| **Footer** | Auto-save indicator: "自动保存 · 上次编辑 HH:mm" (`text-xs text-subtle`) |
| **Empty state** | If `dayNote === null`: show placeholder with pulsing cursor animation. Click anywhere to start typing. |

#### [C] Timeline

| Attribute | Spec |
|---|---|
| **Container** | `space-y-1` vertical stack. Section header with "⏱ 活动时间线" label + "展开全部 / 折叠全部" toggle. |
| **Hour group** | One row per `TimelineGroup`. Left side: hour label (`text-xs text-subtle font-mono w-12`). Right side: count badge + expand chevron. Separator line underneath. |
| **Action log card** | Inside each hour group: a compact row per `ActionLog`. See §6 for full spec. |
| **Collapse behavior** | Hours with ≤ 3 logs: expanded by default. Hours with > 3 logs: collapsed by default, showing count. Click to expand. "展开全部" button in header expands all groups. |

#### [D] AI Summary

| Attribute | Spec |
|---|---|
| **Container** | `Card` with `Chip color="default" variant="soft"` badge: "🤖 AI 生成". |
| **Visibility** | Below the scroll fold. If `summary === null`, show "生成日总结" button. |
| **Content** | Rendered markdown (`prose` typography). Version indicator + generation time in footer. |
| **Actions** | "重新生成" (`Button variant="ghost" size="sm"`) · "查看来源" (expands source action log references) |

#### [E] Behavior Insights

| Attribute | Spec |
|---|---|
| **Container** | Section with "💡 行为洞察" header. Horizontal scroll or 2-column grid of insight cards. |
| **Visibility** | Only shown if `insights.length > 0`. Below AI Summary. |
| **Card layout** | See §8 for full insight card spec. |

---

## 4. Calendar Navigation

### 4.1 Right Panel Calendar (Persistent)

The right sidebar panel (`w-72`) shows a **mini calendar** at the top when the Journal section is active.

```
┌─────────────────────────────┐
│   ◀  2025年 7月  ▶          │
│   一  二  三  四  五  六  日  │
│                  1   2   3   │
│   4   5   6   7   8   9  10  │
│  11  12  13 [14] 15  16  17  │
│  18  19  20  21  22  23  24  │
│  25  26  27  28  29  30  31  │
│                              │
│  ● = has day note            │
│  ◦ = has activity only       │
│  [N] = selected day          │
└─────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Component** | Custom calendar grid (no external dependency). 7-column CSS grid. |
| **Month nav** | `Button isIconOnly variant="ghost" size="sm"` with `ChevronLeft`/`ChevronRight`. Month/year label centered. |
| **Day cells** | `w-8 h-8 rounded-full text-sm` centered. |
| **Selected day** | `bg-accent text-on-accent font-medium` (filled circle). |
| **Today indicator** | `ring-2 ring-accent` (outline ring, even when not selected). |
| **Activity dot** | `●` `w-1.5 h-1.5 rounded-full bg-accent` below the date number if the day has a `DayNote`. `◦` `bg-border` if only action logs exist. No dot if empty. |
| **Click** | Clicking a day cell updates the main content to that day's `JournalPage`. |
| **Keyboard** | Arrow keys navigate between cells. Enter selects. |

### 4.2 Date Header Inline Navigation

In the main content Date Header [A]:

- **◀ / ▶ arrows**: Navigate to previous / next day.
- **Click on date text**: Opens a floating calendar picker (same grid as right panel, rendered as a popover anchored to the date text).
- **"今天" button**: `Button variant="secondary" size="sm"` — only visible when viewing a day that is NOT today. Instantly jumps to today.

### 4.3 Week Strip (Compact Alternative)

Below the calendar in the right panel, show a **7-day horizontal strip** for the current week:

```
  一    二    三    四    五    六    日
  14    15   [16]   17    18    19    20
  ●          ●◦
```

This provides at-a-glance week context. Dots mirror the calendar rules above. Tapping a day in the strip is a quick day switch.

---

## 5. Day Note Editor

### 5.1 Editor Integration

The Day Note editor reuses `editor-dom`'s block editor. It renders inside the Day Note card [B] as an **inline embedded editor** — NOT a separate page or modal.

| Attribute | Spec |
|---|---|
| **Block types supported** | `paragraph`, `heading` (h2, h3 only), `list`, `list-item`, `callout`, `quote`, `code`, `divider`, `reference` |
| **Block types excluded** | `table`, `image`, `embed`, `snapshot` — these are too heavy for a daily note context |
| **Slash menu** | Available via `/` key. Filtered to show only the supported block types above. |
| **Toolbar** | No floating toolbar. Formatting via slash menu and markdown shortcuts (e.g., `# ` for heading, `- ` for list, `> ` for quote). |
| **Min height** | `120px` when empty, grows with content. Max height `400px` before internal scroll. |
| **Placeholder** | Gray italic text: "记录今天的想法、反思和笔记…" |

### 5.2 Auto-Save Behavior

| Trigger | Behavior |
|---|---|
| **Debounced save** | 1500ms after last keystroke, auto-call `updateDayNote(existing, newMarkdown)`. |
| **Blur save** | On editor blur, immediate save if dirty. |
| **Save indicator** | Bottom-left of card: `text-xs text-subtle` — "已保存" (saved), "保存中…" (saving), or "上次编辑 14:32". |
| **Error state** | If save fails: "保存失败 — 点击重试" in `text-warning`. |

### 5.3 Privacy Auto-Classification

As the user types, the content is periodically run through `classifyPrivacy(content)`. If the result changes:

- **normal → sensitive**: A non-intrusive toast appears: "检测到敏感内容 — 已自动标记为敏感" with an "撤销" action.
- **sensitive → sealed**: Unlikely from auto-detection, but if triggered: modal confirmation required.
- The privacy `Chip` in the Day Note header updates in real-time.

### 5.4 Creating vs. Editing

- If `dayNote === null` for the current day: clicking the placeholder area calls `createDayNote(dayKey, '', 'normal')` and focuses the editor.
- If `dayNote` exists: the editor pre-fills with `dayNote.markdown` and the user edits in place.
- Past days: editor is still editable (journal entries can be amended), but a subtle banner reads: "正在编辑过去的日记 — {date}" in `text-subtle`.

---

## 6. Timeline Visualization

### 6.1 Hour Group Structure

Each `TimelineGroup` from `groupByHour(logs)` renders as a collapsible section:

```
09:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3 项  ▾
│
├─ 📄 创建了 "解析器重构方案"                ●  normal
│     项目: 编译器   09:03
│
├─ 📖 开始阅读 "Crafting Interpreters"       ●  normal
│     09:15
│
└─ ☑️ 任务状态变更 → doing "修复词法器"       ○  normal
      项目: 编译器   09:22
```

### 6.2 Hour Group Header

| Element | Spec |
|---|---|
| **Hour label** | `text-xs font-mono text-subtle w-14 shrink-0` — e.g., "09:00" |
| **Separator line** | `Separator` with `flex-1` |
| **Count badge** | `text-xs text-secondary` — e.g., "3 项" |
| **Collapse chevron** | `ChevronDown` / `ChevronRight` (Lucide, 14px). Clickable to toggle. |
| **Collapsed preview** | When collapsed, show first log title as truncated one-liner: "📄 创建了 "解析器…" 等 3 项" |

### 6.3 Action Log Row

Each `ActionLog` renders as a compact row:

| Element | Spec |
|---|---|
| **Container** | `flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-surface-secondary transition-colors cursor-pointer` |
| **Timeline connector** | Left: `w-px bg-border` vertical line connecting rows within the same hour group (timeline stem). |
| **Category icon** | Lucide icon based on `SemanticEventCategory` mapping (see table below). Size 16px. Color varies by category. |
| **Title** | `formatActionLogTitle(actionKind, objectTitle)` — `text-sm text-foreground`. Object title in `font-medium`. |
| **Metadata row** | `text-xs text-subtle` — Project name (if applicable) · Timestamp (HH:mm) |
| **Importance dot** | Right side: `●` filled (`w-2 h-2 rounded-full bg-accent`) for important logs, `○` outline (`border border-border`) for normal, hidden for low importance. |
| **Privacy indicator** | Inline micro-indicator (see §9). |
| **Click action** | Opens the source object in main content (navigates to the referenced entity). |

### 6.4 Category → Icon Mapping

| SemanticEventCategory | Icon (Lucide) | Color Class |
|---|---|---|
| `object_lifecycle` | `Package` | `text-foreground` |
| `relation_change` | `Link` | `text-secondary` |
| `reading` | `BookOpen` | `text-blue-500` (or `text-accent`) |
| `research` | `Microscope` | `text-purple-500` |
| `writing` | `FileEdit` | `text-green-500` (or `text-success`) |
| `execution` | `ClipboardList` | `text-orange-500` (or `text-warning`) |
| `journal` | `BookOpen` | `text-accent` |

### 6.5 Aggregation Display

When events are aggregated (e.g., multiple `object.updated` within 15 min collapsed into one `ActionLog`):

- Show a stacked-card visual: the row has a subtle `+N` badge (`Chip size="sm" variant="flat"`) indicating N collapsed events.
- Clicking the row expands inline to show individual events in a nested list with lighter styling.

### 6.6 Empty Timeline

If `timeline.totalCount === 0`:

```
┌────────────────────────────────────────┐
│         ⏱                              │
│   今天还没有记录到活动                   │
│   开始工作后，活动会自动出现在这里       │
│                                        │
│   或者，在上方写一条日记开始吧 ↑        │
└────────────────────────────────────────┘
```

`text-subtle text-center py-12`. Icon at 24px, muted.

---

## 7. Summary Cards

### 7.1 Day Summary Card

Rendered in region [D] of the Journal Day View.

```
┌─────────────────────────────────────────────────┐
│  🤖 AI 日总结                    v1 · 23:00 生成 │
│                                                  │
│  今天的工作主要集中在编译器项目的解析器重构。完   │
│  成了词法器 Bug 修复，阅读了《Crafting           │
│  Interpreters》第 14 章，并推进了 API 设计文档   │
│  的草稿。                                        │
│                                                  │
│  主要成果:                                       │
│  • 完成 3 项任务 (2项来自编译器项目)              │
│  • 阅读进度推进 15%                              │
│  • 新建 1 篇设计文档草稿                         │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ 来源: 12 条活动记录 + 今日笔记            │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [重新生成]           [查看来源 12 ▸]            │
└─────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Container** | `Card` with `border-l-4 border-l-accent` left accent bar. |
| **AI badge** | `Chip variant="soft" color="default" size="sm"` — "🤖 AI 生成" |
| **Version** | `text-xs text-subtle` — "v1" (from `JournalSummary.version`). "生成于 23:00". |
| **Content** | Rendered markdown. `prose prose-sm` with Tailwind typography. Max 200 words for day summary. |
| **Source count** | Expandable footer. "来源: N 条活动记录 + 今日笔记" — click "查看来源" to expand a list of referenced `ActionLog` titles with timestamps. |
| **Regenerate** | `Button variant="ghost" size="sm"` with `RefreshCw` icon. Triggers `buildDaySummaryPrompt` → LLM → `createJournalSummary`. Shows spinner during generation. |
| **Generate CTA** | If `summary === null`: show a muted card with `Button variant="secondary"` — "生成日总结". Only enabled after the day has ≥ 3 action logs. |

### 7.2 Week Summary Card

Shown in the **Week Overview** (§11). Same card structure as day summary but:

| Difference | Spec |
|---|---|
| **Badge** | "🤖 AI 周总结" |
| **Content** | Up to 300 words. Uses `buildWeekSummaryPrompt`. |
| **Source** | "来源: N 天日总结 + M 条活动" |
| **Scope label** | "2025年 第29周 (7/14 — 7/20)" |

### 7.3 Month Summary Card

Same pattern. Badge: "🤖 AI 月总结". Up to 400 words. Uses `buildMonthSummaryPrompt`.

---

## 8. Insight Cards

### 8.1 Card Layout

Each `BehaviorInsight` renders as a compact card:

```
┌─────────────────────────────┐
│  🎯 专注模式           0.85  │
│                              │
│  你在过去 7 天中 45% 的时间  │
│  花在了「写作」类型活动上    │
│                              │
│  ████████████░░░░░  45%      │
│                              │
│  📊 证据: 写作 23次, 总计    │
│     51次活动                 │
│                              │
│  ⏳ 72天后过期                │
│                              │
│  [📌 置顶]    [✕ 忽略]       │
└─────────────────────────────┘
```

### 8.2 Element Specifications

| Element | Spec |
|---|---|
| **Container** | `Card` with `min-w-[240px] max-w-[300px]`. Border-top colored by pattern type (see color map below). |
| **Pattern icon** | Top-left. Icon per type (see table). Size 16px. |
| **Pattern label** | `text-sm font-medium text-foreground` — localized display name. |
| **Confidence badge** | Top-right. `text-xs font-mono` showing confidence (0.00–1.00). Color: `text-success` if ≥ 0.7, `text-warning` if 0.5–0.7, `text-subtle` if < 0.5. |
| **Statement** | `text-sm text-secondary` — The `insight.statement` text. 2-3 lines max, truncated with "…" and expand on click. |
| **Confidence bar** | `ProgressBar` (HeroUI) or custom bar. Color matches the pattern type accent. |
| **Evidence** | Collapsed by default. `text-xs text-subtle`. Toggle with "📊 证据" click. Shows key evidence fields from `insight.evidence`. |
| **Expiry countdown** | `text-xs text-subtle` — "⏳ N天后过期" calculated from retention policy. Hidden if pinned. |
| **Actions** | Two `Button variant="ghost" size="sm"`: "📌 置顶" (pin — moves to `core_permanent` retention) and "✕ 忽略" (dismiss — calls `dismissInsight`). |

### 8.3 Pattern Type → Visual Mapping

| BehaviorInsightType | Icon | Label (zh-CN) | Accent Color | Border-top |
|---|---|---|---|---|
| `focus_pattern` | `Crosshair` | 专注模式 | `accent` | `border-t-accent` |
| `input_to_output` | `ArrowRightLeft` | 输入与输出 | `blue-500` | `border-t-blue-500` |
| `project_drift` | `Shuffle` | 项目分散 | `warning` | `border-t-warning` |
| `review_gap` | `AlertTriangle` | 复盘缺失 | `destructive` (red) | `border-t-destructive` |

### 8.4 Insight States

| State | Visual |
|---|---|
| **Active** | Normal card as described above. |
| **Pinned** | Gold/amber left border: `border-l-4 border-l-amber-400`. "📌 已置顶" chip replaces "📌 置顶" button. No expiry countdown. |
| **Dismissed** | Removed from view with a brief slide-out animation. A snackbar toast: "洞察已忽略" with "撤销" action (5s timeout). |
| **Expired** | Not shown. `isExpired(insight)` items are filtered out before rendering. |

---

## 9. Privacy Indicators

### 9.1 Three-Level Visual System

Every content element (Day Note, Action Log, Summary) carries a privacy indicator. The system uses a **progressive escalation** visual approach:

| PrivacyLevel | Icon | Chip | Color | Behavior |
|---|---|---|---|---|
| `normal` | None (clean) | Hidden by default | — | No indicator shown unless user enables "show all privacy labels" in settings. Clean, minimal. |
| `sensitive` | `Shield` (Lucide, 14px) | `Chip color="warning" variant="soft" size="sm"` — "敏感" | `text-warning` | Shown inline next to the content title. Agent access limited to `summary_only`. |
| `sealed` | `Lock` (Lucide, 14px) | `Chip color="danger" variant="soft" size="sm"` — "密封" | `text-destructive` | Shown inline. Content is blurred/redacted by default. Requires `requestSealedAccess()` to view. |

### 9.2 Placement

| Context | Indicator Location |
|---|---|
| **Day Note card** | Header row, right-aligned, next to the "今日笔记" label. |
| **Action Log row** | After the title text, inline. Small icon only (no chip) to save space. Tooltip on hover with full label. |
| **Summary card** | In the AI badge area, as a secondary chip. |
| **Calendar day cell** | If any content for that day is `sealed`: a tiny `🔒` icon (8px) in the cell corner. |

### 9.3 Sealed Content Interaction

When a user encounters a `sealed` item:

1. **Blurred state**: Content text is replaced with "██████ ██████ ████" (redaction placeholder) in `text-muted`. The privacy chip shows "🔒 密封".
2. **Access request**: Clicking the item opens a compact modal:

```
┌───────────────────────────────────────┐
│  🔒 请求访问密封内容                    │
│                                        │
│  此内容已被标记为密封。                 │
│  访问权限将在 5 分钟后自动过期。        │
│                                        │
│  访问原因:                             │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│  [取消]                    [确认访问]   │
└───────────────────────────────────────┘
```

3. **Granted state**: Content un-blurs. A countdown timer appears: "🔓 访问中 — 4:32 剩余". After 5 minutes, content re-blurs automatically.

| Component | Spec |
|---|---|
| **Modal** | HeroUI `Modal` with `size="sm"`. |
| **Reason input** | `Input` with placeholder "输入访问原因…". Required field. |
| **Confirm button** | `Button color="primary"` — "确认访问". |
| **Timer** | After access granted, `Chip color="warning" variant="flat"` with `Clock` icon and countdown. Updates every second. |

---

## 10. Protected Session UI

### 10.1 Entry Point

The **Privacy Mode** widget lives in the right sidebar panel, below the calendar and stats:

```
┌─────────────────────────────┐
│  🟢 正常记录中               │
│                              │
│  所有活动正在被自动记录。     │
│                              │
│  [🛡 开启保护模式]            │
└─────────────────────────────┘
```

### 10.2 Entering Protected Mode

Clicking "🛡 开启保护模式" opens a confirmation dialog:

```
┌───────────────────────────────────────┐
│  🛡 开启保护模式                       │
│                                        │
│  保护模式期间，所有自动活动记录将暂     │
│  停。你仍然可以手动添加日记笔记。       │
│                                        │
│  原因 (可选):                          │
│  ┌────────────────────────────────┐    │
│  │  例如: 私人通话, 敏感会议       │    │
│  └────────────────────────────────┘    │
│                                        │
│  [取消]                 [开启保护模式]   │
└───────────────────────────────────────┘
```

### 10.3 Active Protected Mode — Global Visual Treatment

When `isInProtectedMode(sessions) === true`, the entire Journal UI shifts to a **visually distinct protected state**:

| Element | Normal Mode | Protected Mode |
|---|---|---|
| **Top banner** | None | Full-width banner above Date Header: `bg-warning/10 border-b border-warning text-warning` — "🛡 保护模式 — 自动记录已暂停 [结束保护模式]" |
| **Sidebar indicator** | "🟢 正常记录中" | "🛡 保护模式中" in `text-warning font-medium` |
| **Timeline region** | Shows action logs | Shows message: "⏸ 保护模式期间不记录活动" with `text-subtle`. No new entries appear. |
| **Day Note** | Editable | Still editable (manual recording allowed). A subtle note appears: "📝 手动模式 — 仅记录你主动编写的内容" |
| **Sidebar widget** | "开启保护模式" button | "🛡 保护模式中 · 已持续 12分钟" with `Button color="warning" variant="ghost"` — "结束保护模式" |
| **Page background** | `bg-background` | Subtle `bg-warning/5` tint across the main content area (very subtle amber wash) |

### 10.4 Ending Protected Mode

Clicking "结束保护模式" calls `endProtectedSession(session)`. A toast confirms: "保护模式已结束 — 自动记录已恢复". The UI reverts to normal immediately.

### 10.5 Protected Session in Timeline

After a protected session ends, the timeline shows a **session marker** at the relevant time:

```
11:00 ━━━━━━━━━━━━━━━━━━━━━━━━━ 2 项
│ ...

  🛡 保护模式 11:32 — 12:15  (43分钟)
     原因: 私人通话

13:00 ━━━━━━━━━━━━━━━━━━━━━━━━━ 4 项
│ ...
```

The marker is a distinct row with `bg-warning/5 rounded-lg border border-warning/20 py-2 px-3`. It cannot be clicked or expanded — it's purely informational.

---

## 11. Week / Month Overview

### 11.1 View Switcher

In the Date Header [A], add a segmented control to switch between views:

```
[日] [周] [月]
```

| Component | Spec |
|---|---|
| **Implementation** | HeroUI `Tabs variant="underlined" size="sm"` with three tabs: 日 (Day), 周 (Week), 月 (Month). |
| **Default** | "日" (Day) is default and shows the Journal Day View. |
| **Persistence** | View preference stored in `useState`. Does not persist across sessions. |

### 11.2 Week Overview Layout

```
┌─ Main Content ──────────────────────────────────────────┐
│                                                          │
│  [日] [周] [月]       ◀ 第29周 (7/14 — 7/20) ▶          │
│                                                          │
│  ┌─ Activity Heatmap ────────────────────────────────┐  │
│  │  一    二    三    四    五    六    日              │  │
│  │  ██    ██    ██    ░░    ██    ░░    ░░             │  │
│  │  12    8     15    2     9     0     0              │  │
│  │  ↑ activity count per day (tile intensity)         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Week Summary ────────────────────────────────────┐  │
│  │  🤖 AI 周总结              v1 · 周日 23:00 生成    │  │
│  │  本周主要推进了编译器和API两个项目…                 │  │
│  │  [重新生成]  [查看来源]                             │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Daily Summaries ─────────────────────────────────┐  │
│  │  周一 7/14 ── 12 项活动 ──────────── ●  has note  │  │
│  │    解析器重构项目: 创建方案, 修复词法器…            │  │
│  │                                                    │  │
│  │  周二 7/15 ── 8 项活动 ───────────── ●  has note  │  │
│  │    继续阅读 Crafting Interpreters, 完成3项任务…    │  │
│  │                                                    │  │
│  │  周三 7/16 ── 15 项活动 ──────────── ○  no note   │  │
│  │    主要在 API 设计文档上工作…                       │  │
│  │    ...                                              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Insights This Week ──────────────────────────────┐  │
│  │  🎯 专注模式  │  📊 输入与输出  │  ⚠️ 项目分散    │  │
│  │  (cards)      │  (cards)        │  (cards)         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Section | Spec |
|---|---|
| **Activity Heatmap** | 7-column grid. Each cell is a square tile with background opacity proportional to activity count (0% = `bg-surface-secondary`, 100% = `bg-accent`). Count number below each tile. Click a tile to jump to that Day View. |
| **Week Summary** | Same structure as Day Summary Card (§7.2). |
| **Daily Summaries** | Compact list of each day. One line per day: date, activity count, dot indicator (has note / no note), 1-line preview of summary or top action log. Click to navigate to full Day View. |
| **Weekly Insights** | Horizontal row of Insight Cards. These are the same cards from §8 but scoped to the week's data. |

### 11.3 Month Overview Layout

Similar to Week but at month scale:

| Section | Spec |
|---|---|
| **Calendar Heatmap** | Full month calendar grid (same as right-panel calendar but larger, filling the main content width). Each cell colored by activity intensity. |
| **Month Summary** | Month summary card (§7.3). |
| **Week Rows** | 4-5 rows, one per week. Each shows: week number, total activity, 1-line summary preview. Click to navigate to Week Overview. |
| **Monthly Insights** | Aggregated insight cards. May show trend indicators: "专注模式 ↑ 从上月" if the pattern strengthened. |

---

## 12. Empty States

### 12.1 First Journal Day (No Data At All)

When the user navigates to Journal for the very first time:

```
┌────────────────────────────────────────────────────┐
│                                                     │
│                    📓                               │
│                                                     │
│            欢迎来到你的日志                          │
│                                                     │
│   日志会自动记录你在 Orbit 中的活动：               │
│   阅读、写作、研究、任务完成……                      │
│                                                     │
│   你也可以随时写下自己的想法。                       │
│                                                     │
│   ┌─────────────────────────────────────────┐       │
│   │  记录今天的想法…                (editor) │       │
│   └─────────────────────────────────────────┘       │
│                                                     │
│   活动时间线会在你开始工作后自动出现。               │
│                                                     │
└────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Icon** | `BookOpen` at 48px, `text-subtle` |
| **Heading** | `text-xl font-semibold text-foreground` |
| **Description** | `text-sm text-secondary max-w-sm mx-auto text-center` |
| **Editor** | Still functional — the Day Note editor is shown with placeholder, ready for first input. |

### 12.2 Past Day with No Activity

```
┌────────────────────────────────────────┐
│  周一 · 2025年7月7日                    │
│                                        │
│  📝 今日笔记                            │
│  (empty editor placeholder)            │
│                                        │
│  ⏱ 活动时间线                           │
│       📭                                │
│    这一天没有记录到活动                  │
│                                        │
│  🤖 无法生成总结 — 活动数据不足          │
│                                        │
│  💡 暂无行为洞察                        │
│                                        │
└────────────────────────────────────────┘
```

Each section still renders its header but with a one-line empty message in `text-subtle`.

### 12.3 No Insights Yet (< Minimum Data Days)

```
┌─────────────────────────────────────────────┐
│  💡 行为洞察                                 │
│                                              │
│  需要至少 7 天的活动数据才能生成洞察。        │
│  继续使用 Orbit，洞察会自动出现。            │
│                                              │
│  ████████░░░░░░░░░░░░  3/7 天               │
│                                              │
└─────────────────────────────────────────────┘
```

A progress bar shows days of data collected vs. minimum required (`minimumDataDays`). `ProgressBar` (HeroUI) with `color="accent"`.

### 12.4 Summary Not Yet Generated

```
┌─────────────────────────────────────────────┐
│  🤖 AI 日总结                                │
│                                              │
│  今天的总结尚未生成。                         │
│                                              │
│  [生成日总结]    (需要至少 3 条活动记录)       │
│                                              │
└─────────────────────────────────────────────┘
```

The "生成日总结" button is `Button variant="secondary" isDisabled={totalCount < 3}`. Disabled state shows tooltip: "需要至少 3 条活动记录".

---

## 13. Mobile Adaptation

> Note: Currently Orbit targets Desktop and Web. This section is forward-looking guidance for responsive behavior.

### 13.1 Breakpoint Strategy

| Breakpoint | Layout |
|---|---|
| `≥ 1280px` (xl) | Full 3-panel layout as designed |
| `1024–1279px` (lg) | Left sidebar collapses to icon-only (w-16). Right panel becomes a bottom sheet or hidden. |
| `768–1023px` (md) | Single-panel. Sidebar as overlay/drawer. Right panel content moves to inline tabs within main view. |
| `< 768px` (sm) | Full single-column. Bottom tab bar for navigation. |

### 13.2 Mobile Journal Layout (< 768px)

```
┌──────────────────────────┐
│  ◀  周三 7/16  今天  ▶   │   ← compact date header
│  [日] [周] [月]          │   ← view switcher tabs
├──────────────────────────┤
│                          │
│  📝 今日笔记              │   ← Day Note (full width)
│  ┌──────────────────┐    │
│  │  (editor)        │    │
│  └──────────────────┘    │
│                          │
│  ⏱ 活动时间线             │   ← Timeline (full width)
│  09:00 ── 3 项 ▸         │
│  10:00 ── 5 项 ▸         │   ← all collapsed by default
│  14:00 ── 4 项 ▸         │
│                          │
│  🤖 AI 总结 ▸             │   ← collapsed section
│  💡 洞察 (2) ▸            │   ← collapsed section
│                          │
├──────────────────────────┤
│  📅  📓  🎯  📁  ☑️      │   ← bottom tab bar
└──────────────────────────┘
```

| Adaptation | Detail |
|---|---|
| **Calendar** | Accessible via tapping the date in header → full-screen calendar overlay. |
| **Timeline groups** | All collapsed by default to save vertical space. |
| **Summary & Insights** | Rendered as collapsible accordion sections rather than always-visible cards. |
| **Day Note editor** | Reduced min-height (80px). |
| **Right panel widgets** | Calendar, Quick Stats, Privacy Mode all move inline: Calendar into the date header popover, Stats into a horizontal chip row below the date, Privacy Mode into a top-right icon button. |

---

## 14. Component Inventory

### 14.1 New Components Required

| Component | Type | Description |
|---|---|---|
| `JournalDayPage` | Page | Orchestrates the 5 regions of the day view. Consumes `JournalPage` from viewmodel. |
| `JournalDateHeader` | Region | Date display + navigation arrows + today badge + view switcher + privacy indicator. |
| `DayNoteCard` | Region | Card wrapping the `editor-dom` instance for the day note. Handles auto-save. |
| `TimelineSection` | Region | Renders `TimelineGroup[]` with hour groups and action log rows. |
| `TimelineHourGroup` | Sub-component | A single hour group with collapse/expand. |
| `ActionLogRow` | Sub-component | A single action log entry row with icon, title, metadata, importance dot. |
| `SummaryCard` | Shared Card | Displays a `JournalSummary` (day/week/month) with generate/regenerate actions. |
| `InsightCard` | Shared Card | Displays a `BehaviorInsight` with confidence bar, evidence, pin/dismiss. |
| `MiniCalendar` | Widget | Month calendar grid for the right panel. |
| `WeekStrip` | Widget | Horizontal 7-day strip for quick day switching. |
| `PrivacyChip` | Micro-component | Renders the appropriate privacy indicator for a given `PrivacyLevel`. |
| `ProtectedModeBanner` | Banner | Full-width warning banner shown during protected sessions. |
| `ProtectedModeWidget` | Widget | Right-panel widget showing current recording mode with toggle. |
| `SealedAccessModal` | Modal | Access request dialog for sealed content. |
| `JournalWeekPage` | Page | Week overview with heatmap, week summary, daily rows, and insights. |
| `JournalMonthPage` | Page | Month overview with calendar heatmap, month summary, and weekly rows. |
| `ActivityHeatmap` | Visualization | Color-intensity grid showing activity density per time unit. |
| `JournalEmptyState` | Shared | Configurable empty state for different scenarios (first visit, no activity, etc.). |

### 14.2 Reused Existing Components

| Component | Source | Usage in Journal |
|---|---|---|
| `Card` | `@heroui/react` | Day Note card, Summary card, Insight card containers |
| `Chip` | `@heroui/react` | Privacy labels, AI badges, count badges, today indicator |
| `Button` | `@heroui/react` | Navigation arrows, generate, pin, dismiss, protected mode toggle |
| `Tabs` | `@heroui/react` | Day/Week/Month view switcher |
| `Separator` | `@heroui/react` | Between regions, inside timeline |
| `Modal` | `@heroui/react` | Sealed access request, protected mode confirmation |
| `Input` | `@heroui/react` | Reason fields in modals |
| `ProgressBar` | `@heroui/react` | Confidence bars in insight cards, data collection progress |
| `editor-dom` | `@orbit/editor-dom` | Day Note block editor |

### 14.3 Lucide Icons Required

```
BookOpen, ChevronLeft, ChevronRight, ChevronDown, ChevronRight,
Calendar, Clock, Shield, Lock, Unlock, ShieldCheck, ShieldOff,
Crosshair, ArrowRightLeft, Shuffle, AlertTriangle,
FileEdit, BookOpen, Microscope, ClipboardList, Package, Link,
Pin, X, RefreshCw, Sparkles, Bot, MoreHorizontal,
Pause, Play, Eye, EyeOff
```

---

## 15. Interaction Map

### 15.1 Primary User Flows

```
┌─────────────┐     click        ┌──────────────────┐
│  Sidebar     │ ──────────────► │  Journal Day View │
│  "日志"      │                  │  (today)          │
└─────────────┘                  └────────┬─────────┘
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                   ┌──────────┐   ┌──────────┐   ┌──────────┐
                   │ Write     │   │ Browse    │   │ Generate │
                   │ Day Note  │   │ Timeline  │   │ Summary  │
                   └──────────┘   └──────────┘   └──────────┘
                          │               │               │
                          ▼               ▼               ▼
                   auto-save       click log row    view/regenerate
                   privacy check   → navigate to     → view sources
                                   source object
```

### 15.2 Date Navigation Flow

```
                    ┌─────────────────┐
                    │  Current Day    │
                    │  View           │
                    └───────┬─────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ ◀/▶      │     │ Calendar  │     │ Week     │
   │ Arrows   │     │ Day Cell  │     │ Strip    │
   │ (±1 day) │     │ Click     │     │ Click    │
   └──────────┘     └──────────┘     └──────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                    ┌─────────────────┐
                    │  New Day View   │
                    │  loads          │
                    └─────────────────┘
```

### 15.3 Privacy Flow

```
   ┌──────────────┐
   │ Normal Mode  │──── user clicks "开启保护模式" ───►┌──────────────────┐
   │ 🟢           │                                     │ Confirmation     │
   └──────────────┘◄── user clicks "取消" ──────────────│ Modal            │
                                                        └───────┬──────────┘
                                                                │ confirm
                                                                ▼
   ┌──────────────┐                                     ┌──────────────────┐
   │ Normal Mode  │◄── user clicks "结束保护模式" ──────│ Protected Mode   │
   │ 🟢           │    toast: "已恢复"                   │ 🛡 banner active │
   └──────────────┘                                     │ timeline paused  │
                                                        │ note still works │
                                                        └──────────────────┘
```

### 15.4 Sealed Content Access Flow

```
   ┌──────────────┐
   │ Sealed Item  │──── user clicks redacted content ───►┌──────────────────┐
   │ ██████████   │                                       │ Access Request   │
   └──────────────┘                                       │ Modal            │
                                                          │ (enter reason)   │
                                                          └───────┬──────────┘
                                                                  │ confirm
                                                                  ▼
   ┌──────────────┐                                       ┌──────────────────┐
   │ Re-sealed    │◄── 5 min timer expires ───────────────│ Unsealed (temp)  │
   │ ██████████   │                                       │ 🔓 4:32 remaining│
   └──────────────┘                                       │ content visible  │
                                                          └──────────────────┘
```

---

## Appendix A: Semantic Color Token Usage

| Purpose | Light | Dark | Token |
|---|---|---|---|
| Day Note card bg | white | surface | `bg-background` / `bg-surface` |
| Timeline hour label | gray-400 | gray-500 | `text-subtle` |
| Active day (calendar) | accent filled | accent filled | `bg-accent text-on-accent` |
| Protected mode tint | amber-50 | amber-950/10 | `bg-warning/5` |
| Sealed redaction | gray-300 bars | gray-600 bars | `bg-muted` |
| Insight confidence bar | per-type accent | per-type accent | varies |
| Privacy "sensitive" | warning chip | warning chip | `color="warning"` |
| Privacy "sealed" | danger chip | danger chip | `color="danger"` |

## Appendix B: Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `←` / `→` | Previous / next day (when not focused in editor) |
| `T` | Jump to today |
| `1` / `2` / `3` | Switch to Day / Week / Month view |
| `N` | Focus the Day Note editor |
| `E` | Expand all timeline groups |
| `C` | Collapse all timeline groups |
| `Cmd+Shift+P` | Toggle protected mode |
| `Esc` | Blur editor / close modal |

## Appendix C: Data Retention Visual Summary

| Layer | Retention | Visual Cue |
|---|---|---|
| Day Notes | Permanent | No expiry indicator |
| Action Logs | 7–30 days | Faded appearance after 14 days. "即将过期" chip after 25 days. |
| Summaries | Permanent | No expiry indicator |
| Insights (unpinned) | 30–90 days | Expiry countdown in card footer |
| Insights (pinned) | Permanent | 📌 badge, no countdown |
| Tech Logs | 7–30 days | Not shown in UI (backend only) |

---

*End of Journal UI Design Specification — v0.1*
