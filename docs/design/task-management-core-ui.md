# 任务管理核心 — UI 设计文档

> **Task Management Core — UI Design Specification**
> Version 0.1 · 2025-07

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Global Layout Recap](#2-global-layout-recap)
3. [Cross-cutting: Status Chips & Color System](#3-cross-cutting-status-chips--color-system)
4. [A — Tasks Section (任务)](#a--tasks-section-任务)
5. [B — Projects Section (项目)](#b--projects-section-项目)
6. [C — Today Section (今日)](#c--today-section-今日)
7. [D — Focus Section (聚焦)](#d--focus-section-聚焦)
8. [E — Review Section (回顾)](#e--review-section-回顾)
9. [F — Cross-cutting Patterns](#f--cross-cutting-patterns)
10. [Empty & Error States](#10-empty--error-states)
11. [Accessibility & i18n Notes](#11-accessibility--i18n-notes)

---

## 1. Design Principles

| Principle | Description |
|---|---|
| **Agent-first, human-confirmed** | The agent proposes; the user approves. Every AI suggestion has a visible reasoning trail and a one-click override. |
| **Progressive disclosure** | Default views are radically simple. Detail expands on demand (click-to-expand, right-panel drill-in). |
| **Single active context** | At any moment the user should see exactly one primary thing to do. Alternatives are visible but visually recessed. |
| **Status as narrative** | The 8-state lifecycle is a story arc (`captured → … → done`). The UI treats it as a horizontal progress trail, not an arbitrary badge. |
| **Bilingual-ready** | All labels via `i18n` keys (`zh-CN` primary). Layouts tolerate 30 % longer English strings. |

---

## 2. Global Layout Recap

```
┌──────────┬─────────────────────────────┬────────────┐
│ Sidebar  │       Main Content          │ Right Panel│
│  60 / w  │       flex-1                │   72 / w   │
│          │                             │            │
│ Today    │  (changes per section)      │  (detail / │
│ Focus    │                             │   context) │
│ Review   │                             │            │
│ Projects │                             │            │
│ Tasks    │                             │            │
└──────────┴─────────────────────────────┴────────────┘
```

- **Sidebar** — Already implemented. Icons + labels + counts. `activeSection` drives main content.
- **Main Content** — The primary canvas. Each section fills this area with its own layout.
- **Right Panel** — Contextual detail. Appears when a specific entity (task, project, review) is selected. When nothing is selected, shows a summary dashboard or remains collapsed.

All sizing uses Tailwind spacing tokens. The right panel slides in with a `transition-all duration-200`.

---

## 3. Cross-cutting: Status Chips & Color System

### 3.1 Task Status Chips

Every `TaskStatus` maps to a HeroUI `<Chip>` with a semantic variant and a Lucide icon.

| Status | Chinese | Color | Variant | Lucide Icon | Description |
|---|---|---|---|---|---|
| `captured` | 已捕获 | `default` (gray) | `flat` | `Inbox` | Raw input, not yet processed |
| `clarifying` | 厘清中 | `secondary` (purple) | `flat` | `MessageCircleQuestion` | Agent is asking follow-up questions |
| `ready` | 就绪 | `primary` (blue) | `flat` | `CircleCheckBig` | Actionable, waiting to be scheduled |
| `scheduled` | 已排期 | `warning` (amber) | `flat` | `CalendarClock` | Assigned to a day/time |
| `focused` | 聚焦中 | `success` (green) | `dot` | `Crosshair` | Currently being worked on |
| `done` | 已完成 | `success` (green) | `flat` | `CheckCircle2` | Finished |
| `blocked` | 已阻塞 | `danger` (red) | `flat` | `ShieldAlert` | Cannot proceed |
| `dropped` | 已放弃 | `default` (gray) | `bordered` | `CircleOff` | Intentionally abandoned |

**Chip spec:**

```
<Chip variant={variant} color={color} startContent={<Icon size={14} />} size="sm">
  {label}
</Chip>
```

### 3.2 Project Status Chips

| Status | Chinese | Color |
|---|---|---|
| `active` | 进行中 | `primary` |
| `paused` | 已暂停 | `warning` |
| `done` | 已完成 | `success` |
| `archived` | 已归档 | `default` |

### 3.3 Milestone Status Chips

| Status | Chinese | Color |
|---|---|---|
| `planned` | 规划中 | `default` |
| `active` | 进行中 | `primary` |
| `done` | 已完成 | `success` |
| `dropped` | 已放弃 | `default` (bordered) |

### 3.4 Status Lifecycle Trail

For task detail view, render a horizontal step indicator showing the lifecycle path:

```
captured ─── clarifying ─── ready ─── scheduled ─── focused ─── done
                                          └─── blocked
                                          └─── dropped
```

Implementation: a `flex gap-1` row of small circles/dots, filled up to the current status. Branching statuses (`blocked`, `dropped`) shown as a diverging short line below.

---

## A — Tasks Section (任务)

The Tasks section is the **master task list** — all tasks across all projects, or unassigned.

### A.1 Task List View (Main Content Area)

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ Header ─────────────────────────────────────────────────┐│
│ │  任务                                 [+ 快速捕获] [≡ ▦] ││
│ │  [Status Filter Tabs]   [Search]   [Sort ▼] [Group ▼]   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Quick Capture Bar (expandable) ─────────────────────────┐│
│ │  💡 "描述你想做的事情…"              [Enter to capture]   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Grouped Task List ──────────────────────────────────────┐│
│ │                                                          ││
│ │  ▸ 聚焦中 (1)                                           ││
│ │    ┌──────────────────────────────────────────────┐      ││
│ │    │ ● Write API documentation    [Orbit Core] ⏱  │      ││
│ │    └──────────────────────────────────────────────┘      ││
│ │                                                          ││
│ │  ▸ 已排期 (3)                                           ││
│ │    ┌──────────────────────────────────────────────┐      ││
│ │    │ ○ Design auth flow           [Auth v2]       │      ││
│ │    │ ○ Update CI pipeline         —               │      ││
│ │    │ ○ Review PR #342             [Orbit Core]    │      ││
│ │    └──────────────────────────────────────────────┘      ││
│ │                                                          ││
│ │  ▸ 就绪 (5)                                             ││
│ │    ...                                                   ││
│ │                                                          ││
│ │  ▸ 厘清中 (2)                                           ││
│ │  ▸ 已捕获 (4)                                           ││
│ │  ▸ 已阻塞 (1)                                           ││
│ │                                                          ││
│ │  ─── 已完成 / 已放弃 (collapsed by default) ───          ││
│ │  ▹ 已完成 (12)                                          ││
│ │  ▹ 已放弃 (3)                                           ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Component Spec

**Header bar:**
- Title: `<h2>` with `text-xl font-semibold`
- Quick-capture button: `<Button size="sm" variant="flat" startContent={<Plus />}>快速捕获</Button>`
- View toggle: List `≡` / Board `▦` — `<Tabs size="sm">` with two icon-only tabs
- Filter tabs (below title): `<Tabs variant="underlined" size="sm">` with items: `全部`, `进行中` (ready+scheduled+focused), `已阻塞`, `已完成`
- Search: `<Input size="sm" placeholder="搜索任务…" startContent={<Search />} />`
- Sort dropdown: `<Dropdown>` — options: 创建时间, 更新时间, 状态, 项目
- Group dropdown: `<Dropdown>` — options: 状态 (default), 项目, 无分组

**Grouped list (default: grouped by status):**
- Groups rendered in lifecycle order: `focused → scheduled → ready → clarifying → captured → blocked`, then `done → dropped` collapsed
- Group header: `<div class="flex items-center gap-2 py-2 text-sm text-foreground-500">` with collapse chevron `<ChevronDown />`, status chip, count badge
- Collapsible via `useState` per group. `done` and `dropped` groups default to collapsed.

**Task row:**
- Component: `<Card isPressable shadow="none" className="border border-divider">` or a custom `<div>` with hover highlight
- Layout: `flex items-center gap-3 px-3 py-2`

```
┌─────────────────────────────────────────────────────────────────┐
│ [StatusDot] [Title ........................] [ProjectChip] [▸]  │
│             [subtitle: subtask count · due date · carry fwd]    │
└─────────────────────────────────────────────────────────────────┘
```

- **Status dot**: Clickable circle matching status color. Click opens a status-transition dropdown (only valid transitions shown).
- **Title**: `text-sm font-medium`, truncated with `truncate`. Bold if `isToday`.
- **Project chip**: `<Chip size="sm" variant="flat" color="default">{projectTitle}</Chip>` — only if `projectId` is set.
- **Indicators** (trailing icons, muted):
  - `☀` sun icon if `isToday === true`
  - `↩` if `isCarryForward === true`
  - `⏰` clock if `dueAt` is set and within 48h
  - `🔗` paperclip if has support links
- **Subtitle line** (optional, `text-xs text-foreground-400`): shows subtask progress (e.g., "2/5 subtasks"), relative due date, carry-forward note.
- **Click** → selects task, loads detail in Right Panel.
- **Right-click** → context menu: 开始聚焦, 排期到今日, 标记完成, 阻塞, 放弃, 删除.

**Alternate: Board View (Kanban)**

When toggle is set to `▦`, render a horizontal scrollable board:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ 已捕获   │ 厘清中    │ 就绪     │ 已排期    │ 聚焦中   │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │
│ │ task │ │ │ task │ │ │ task │ │ │ task │ │ │ task │ │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │
│ ┌──────┐ │          │ ┌──────┐ │ ┌──────┐ │          │
│ │ task │ │          │ │ task │ │ │ task │ │          │
│ └──────┘ │          │ └──────┘ │ └──────┘ │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

- Columns for active statuses only: `captured`, `clarifying`, `ready`, `scheduled`, `focused`. Terminal states (`done`, `blocked`, `dropped`) excluded from board by default (toggle to show).
- Drag-and-drop between columns triggers `transitionTask()`. If the transition is invalid, snap back with a toast: "无法从 {from} 转换到 {to}".
- Column width: `min-w-[220px]`, scrollable horizontally.
- Cards inside columns: compact variant of the task row (title + project chip only).

### A.2 Quick Capture

The Quick Capture bar is always visible at the top of the Tasks list (below filters). It is the primary entry point for new tasks.

#### Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Raw Input                                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💡 "帮Orbit写一个API文档，需要先调研RESTful规范"        │ │
│  │                                        [⏎ 解析]       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Step 2: Agent Parse (200ms shimmer animation)              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ✨ Agent 解析结果                    置信度: 87%       │ │
│  │                                                        │ │
│  │  标题:  编写 Orbit API 文档                             │ │
│  │  项目:  Orbit Core  (matched)                          │ │
│  │  子任务:                                                │ │
│  │    □ 调研 RESTful 规范                                  │ │
│  │    □ 编写 API 文档初稿                                  │ │
│  │                                                        │ │
│  │  [✓ 确认创建]  [✎ 编辑]  [✕ 取消]                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Step 3: (if Edit clicked) Inline edit form                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  标题:  [editable input ............................] │ │
│  │  项目:  [Dropdown: Orbit Core ▼]                      │ │
│  │  里程碑: [Dropdown: v2.0 ▼]                            │ │
│  │  子任务:                                                │ │
│  │    [x] 调研 RESTful 规范  [🗑]                         │ │
│  │    [x] 编写 API 文档初稿  [🗑]                         │ │
│  │    [+ 添加子任务]                                       │ │
│  │                                                        │ │
│  │  [✓ 创建]  [✕ 取消]                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Components

- **Input**: `<Input fullWidth variant="bordered" placeholder="描述你想做的事情…" startContent={<Sparkles size={16} />} />` — triggers `parseUserIntent()` on Enter or on a 500ms debounce.
- **Parse result card**: `<Card shadow="sm" className="border-primary/20 bg-primary/5">` — shows the `ParsedIntent` fields. Confidence shown as a small progress bar or percentage badge.
- **Confirm**: `<Button color="primary" size="sm">确认创建</Button>` → creates task with status `captured`, optionally with subtasks.
- **Edit**: expands an inline form with `<Input>` for title, `<Select>` for project/milestone, editable subtask list.
- **Cancel**: collapses back to raw input.

#### Low-Confidence Flow (confidence < 0.5)

If `ParsedIntent.confidence < 0.5`, the parse-result card shows a warning styling:

```
┌────────────────────────────────────────────────────────────┐
│  ⚠ Agent 不太确定你的意思                  置信度: 32%     │
│                                                            │
│  建议标题: [suggestion]                                     │
│  需要更多信息。Agent 建议转入「厘清」状态后对话完善。          │
│                                                            │
│  [创建为草稿 (captured)]  [开始对话厘清 (clarifying)]       │
└────────────────────────────────────────────────────────────┘
```

- "开始对话厘清" creates the task as `clarifying` and opens the Agent conversation panel in the Right Panel, pre-seeded with context.

### A.3 Task Detail (Right Panel)

When a task row is clicked, the Right Panel (72w) loads the full task detail.

#### Layout

```
┌───────────────────────────────────────────────────┐
│ ┌─ Header ───────────────────────────────────────┐│
│ │  [← Back]                         [⋯ More]    ││
│ │                                                ││
│ │  编写 Orbit API 文档                            ││
│ │  [就绪 chip]  [Orbit Core chip]                ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│ ┌─ Status Lifecycle Trail ───────────────────────┐│
│ │  ● ── ● ── ◉ ── ○ ── ○ ── ○                   ││
│ │  捕获  厘清  就绪  排期  聚焦  完成              ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│ ┌─ Action Bar ───────────────────────────────────┐│
│ │  [▶ 开始聚焦] [☀ 加入今日] [⏸ 阻塞] [▼ 更多]  ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│ ┌─ Tabs ─────────────────────────────────────────┐│
│ │  [详情] [子任务] [素材] [历史]                   ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│ ┌─ Tab: 详情 ────────────────────────────────────┐│
│ │  完成定义                                       ││
│ │  "当API文档通过团队review时视为完成"              ││
│ │                                                ││
│ │  正文                                          ││
│ │  [Block editor area — editor-dom]              ││
│ │                                                ││
│ │  元数据                                        ││
│ │  项目: Orbit Core                              ││
│ │  里程碑: v2.0                                   ││
│ │  截止日期: 2025-07-20                           ││
│ │  创建时间: 2025-07-01                           ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│ ┌─ Tab: 子任务 ──────────────────────────────────┐│
│ │  进度: ████░░ 2/5                              ││
│ │                                                ││
│ │  ✓ 调研 RESTful 规范          [done]           ││
│ │  ✓ 编写初稿                    [done]           ││
│ │  ○ 内部评审                    [ready]          ││
│ │  ○ 修改反馈                    [captured]       ││
│ │  ○ 最终发布                    [captured]       ││
│ │                                                ││
│ │  [+ 添加子任务]                                 ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│ ┌─ Tab: 素材 (Support Links) ────────────────────┐│
│ │  📖 阅读素材 (2)                                ││
│ │    · RESTful API Design Guide     [Open]       ││
│ │    · OpenAPI Specification 3.0    [Open]       ││
│ │                                                ││
│ │  🔬 研究参考 (1)                                ││
│ │    · Competitor API comparison    [Open]       ││
│ │                                                ││
│ │  ✏️ 写作输出 (1)                                ││
│ │    · API Docs Draft v1            [Open]       ││
│ │                                                ││
│ │  [+ 关联素材]                                   ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│ ┌─ Tab: 历史 (Event Timeline) ───────────────────┐│
│ │  ○ 2025-07-10 09:30  状态变更                   ││
│ │    clarifying → ready  (user)                  ││
│ │  │                                             ││
│ │  ○ 2025-07-08 14:00  状态变更                   ││
│ │    captured → clarifying  (agent)              ││
│ │  │                                             ││
│ │  ○ 2025-07-08 13:55  创建                      ││
│ │    由用户通过快速捕获创建                         ││
│ └────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────┘
```

#### Component Spec

**Header:**
- Back: `<Button isIconOnly variant="light"><ArrowLeft /></Button>`
- More menu: `<Dropdown>` with: 删除, 升级为项目, 复制链接
- Title: `<h3 className="text-lg font-semibold">`
- Chips: Status chip + Project chip inline

**Status Lifecycle Trail:**
- Custom component: `<StatusTrail currentStatus={status} />`
- Row of 6 circles connected by lines. Filled (solid) up to current status. Current status has a pulsing ring animation.
- Below each circle: `text-[10px]` label.
- If status is `blocked` or `dropped`, show a branching indicator from the last active state.

**Action Bar:**
- Buttons derived from `getValidNextStatuses(currentStatus)`.
- Primary action (leftmost, `color="primary"`): the most likely next status.
  - `ready` → "▶ 开始聚焦" (transitions to `focused` via `scheduled`)
  - `scheduled` → "▶ 开始聚焦"
  - `focused` → "✓ 标记完成"
  - `captured` → "✨ 开始厘清"
  - `blocked` → "↩ 恢复就绪"
- Secondary actions: `variant="flat"` buttons for other valid transitions.
- "更多" dropdown for destructive/rare transitions (`dropped`, `delete`).

**Tabs:**
- `<Tabs variant="underlined" size="sm">`
- Four tab panels: 详情, 子任务, 素材, 历史

**详情 (Detail) Tab:**
- Completion definition: `<Card className="bg-content2 p-3">` with `text-sm` — editable on click.
- Body: embedded `editor-dom` block editor instance, rendered in a `min-h-[200px]` container.
- Metadata: `<div className="grid grid-cols-2 gap-2 text-sm">` key-value pairs. Project and milestone are clickable links.

**子任务 (Subtasks) Tab:**
- Progress bar: `<Progress value={completedCount/totalCount*100} size="sm" color="success" />`
- Subtask list: each subtask is a mini task-row with its own status dot and title. Clicking opens the subtask in the same right panel (breadcrumb navigation: Parent > Subtask).
- "添加子任务": `<Button size="sm" variant="flat" startContent={<Plus />}>` → inline input.
- Subtasks rendered as an indented list. No deeper nesting (max 1 level of subtasks).

**素材 (Support Links) Tab:**
- Grouped by `SupportLinkKind`:
  - `reading_material` → 📖 阅读素材
  - `research_reference` → 🔬 研究参考
  - `writing_output` → ✏️ 写作输出
  - `discussion_thread` → 💬 讨论线索
- Each link: `<div className="flex items-center justify-between py-1.5">` with title and `<Button size="sm" variant="light">打开</Button>`.
- "关联素材": opens a search modal to link existing objects (notes, articles, etc.) to this task.

**历史 (Event Timeline) Tab:**
- Vertical timeline using a left-border line with circle markers.
- Each `TaskEvent`: timestamp, event type description, status transition (old → new), actor badge (`user` / `agent` / `system`).
- Actor badge: `<Chip size="sm" variant="flat" color={actorType === 'agent' ? 'secondary' : 'default'}>{actorLabel}</Chip>`
- Most recent events at top. Lazy-loaded, max 20 initially with "加载更多" button.

### A.4 Subtask Display

- **In Task List**: parent tasks show a small subtask counter: `2/5` next to the title.
- **In Task Detail > 子任务 tab**: flat list (not tree). Each subtask has the same row format as the main task list but indented.
- **Navigation**: clicking a subtask replaces the right panel content with the subtask's detail. A breadcrumb trail appears at the top: `Parent Task > Subtask Title`.
- **Subtask creation**: inline input at the bottom of the subtask list. Created with status `captured` by default.
- **Subtask completion**: checking the status dot toggles status to `done` with a single click (shortcut bypasses full lifecycle for subtasks).

---

## B — Projects Section (项目)

### B.1 Project List (Main Content Area)

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ Header ─────────────────────────────────────────────────┐│
│ │  项目                              [+ 创建项目] [Filter] ││
│ │  [Active ▼ filter tabs: 全部 | 进行中 | 已暂停 | 已完成] ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Project Cards Grid ─────────────────────────────────────┐│
│ │                                                          ││
│ │  ┌──────────────────────┐  ┌──────────────────────┐      ││
│ │  │  Orbit Core          │  │  Auth v2             │      ││
│ │  │  [进行中]  aligned   │  │  [进行中]  maint.    │      ││
│ │  │                      │  │                      │      ││
│ │  │  ████████░░ 72%      │  │  ███░░░░░░ 30%       │      ││
│ │  │  18 tasks · 5 today  │  │  8 tasks · 2 today   │      ││
│ │  │                      │  │                      │      ││
│ │  │  📅 上次回顾: 3天前   │  │  ⚠ 需要回顾          │      ││
│ │  └──────────────────────┘  └──────────────────────┘      ││
│ │                                                          ││
│ │  ┌──────────────────────┐  ┌──────────────────────┐      ││
│ │  │  Mobile Redesign     │  │  Infrastructure      │      ││
│ │  │  [已暂停]  opportun. │  │  [进行中]  maint.    │      ││
│ │  │  ...                 │  │  ...                 │      ││
│ │  └──────────────────────┘  └──────────────────────┘      ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Component Spec

**Grid**: `grid grid-cols-2 gap-4` (2 columns in main content area). On narrow screens, collapses to single column.

**Project Card:**
- `<Card isPressable shadow="sm" className="p-4">`
- **Title row**: `<h4 className="text-base font-semibold">` + `<Chip>` for status + alignment badge
- **Alignment badge**: small text label
  - `aligned_to_vision` → "🎯 愿景对齐"
  - `maintenance` → "🔧 维护"
  - `opportunistic` → "✨ 机会性"
- **Progress bar**: `<Progress value={percentComplete} size="sm" color="primary" className="mt-3" />` with percentage label to the right
- **Stats line**: `text-xs text-foreground-400` — "{taskCount} 个任务 · {todayCount} 个今日"
- **Review indicator**:
  - If `needsReview === true`: `<Chip size="sm" color="warning" variant="flat">需要回顾</Chip>`
  - Else: `text-xs text-foreground-400` "上次回顾: {relative time}"
- **Click** → loads project detail in Main Content (replaces project list, with breadcrumb).

**Create Project:**
- `<Button color="primary" size="sm" startContent={<FolderPlus />}>创建项目</Button>`
- Opens a modal: `<Modal>` with form fields:
  - 标题 (required): `<Input />`
  - 对齐方式: `<Select>` with alignment options
  - 关联愿景: `<Select>` (optional, from existing visions)
  - 决策模式: `<RadioGroup>` — user_written, agent_suggested, user_confirmed
- On submit → `createProject()` → navigates to the new project detail.

### B.2 Project Detail (Main Content Area, replaces list)

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ Breadcrumb ─────────────────────────────────────────────┐│
│ │  项目 / Orbit Core                      [⚙ 设置] [⋯]   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Project Header Card ────────────────────────────────────┐│
│ │                                                          ││
│ │  Orbit Core                                              ││
│ │  [进行中]  [🎯 愿景对齐]                                 ││
│ │                                                          ││
│ │  整体进度  ████████████░░░░ 72%                          ││
│ │  里程碑 3/5 · 任务 13/18 · 今日 5                        ││
│ │                                                          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Tabs ───────────────────────────────────────────────────┐│
│ │  [里程碑] [任务] [回顾历史]                               ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Tab: 里程碑 (Milestones) ──────────────────────────────┐│
│ │                                                          ││
│ │  ┌─ Milestone 1 ──────────────────────────────────────┐  ││
│ │  │  v1.0 Core API            [已完成 ✓]    截止: 6/1 │  ││
│ │  │  ████████████████ 100%    3/3 tasks done          │  ││
│ │  └────────────────────────────────────────────────────┘  ││
│ │                                                          ││
│ │  ┌─ Milestone 2 ──────────────────────────────────────┐  ││
│ │  │  v1.5 Auth Module         [进行中 ●]    截止: 7/15│  ││
│ │  │  ██████████░░░░░░ 60%     3/5 tasks done          │  ││
│ │  │                                                    │  ││
│ │  │  Tasks:                                            │  ││
│ │  │   ✓ Design schema         ✓ Implement JWT          │  ││
│ │  │   ✓ Add middleware         ○ Write tests            │  ││
│ │  │   ○ Security audit                                 │  ││
│ │  └────────────────────────────────────────────────────┘  ││
│ │                                                          ││
│ │  ┌─ Milestone 3 (upcoming) ───────────────────────────┐  ││
│ │  │  v2.0 Public API          [规划中 ○]    截止: 8/30 │  ││
│ │  │  ░░░░░░░░░░░░░░░░ 0%     0/4 tasks done          │  ││
│ │  └────────────────────────────────────────────────────┘  ││
│ │                                                          ││
│ │  ┌─ Unassigned Tasks ─────────────────────────────────┐  ││
│ │  │  未分配到里程碑 (2)                                 │  ││
│ │  │   ○ Refactor config loader                         │  ││
│ │  │   ○ Update README                                  │  ││
│ │  └────────────────────────────────────────────────────┘  ││
│ │                                                          ││
│ │  [+ 添加里程碑]                                          ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Component Spec

**Project Header Card:**
- `<Card shadow="none" className="bg-content2 p-5">`
- Title + status chip + alignment chip
- Progress: `<Progress size="md" />` spanning full width, label on right
- Summary stats: `text-sm text-foreground-500`

**Milestone List (vertical timeline style):**
- Each milestone is a `<Card shadow="sm" className="p-4 mb-3">` with:
  - Title row: milestone title + status chip + due date
  - Progress bar: `<Progress size="sm" />`
  - Task summary: compact count ("3/5 tasks done")
  - Expanded tasks (when clicked): mini task list inside the milestone card, same row format as A.1
- Milestones are ordered by `sortOrder` field.
- Completed milestones are visually muted (`opacity-60`).
- **Unassigned tasks**: a separate section at the bottom for tasks that belong to the project but no milestone.
- "添加里程碑": `<Button variant="flat" size="sm">` → inline form (title, description, due date).

**Tab: 任务 (Tasks):**
- Same grouped-by-status task list as Section A.1, but filtered to this project's tasks only.

**Tab: 回顾历史 (Review History):**
- Chronological list of past project reviews.
- Each review: `<Card>` with review date, cycle type (`day` / `week` / `project`), summary excerpt. Click to expand full review.

### B.3 Milestone UI

Milestones use a **vertical checklist** model (not Gantt), since the app is time-block oriented rather than resource-scheduled.

**Milestone card states:**

| State | Visual |
|---|---|
| `planned` | Gray left border, muted text, progress at 0% |
| `active` | Blue left border, normal text, progress bar colored |
| `done` | Green left border, strikethrough title, full progress bar |
| `dropped` | Dashed gray left border, `opacity-50` |

Each milestone card has a `border-l-4` with the appropriate color, creating a visual timeline running down the left edge.

---

## C — Today Section (今日)

The Today section is the **daily command center** — what should I work on today?

### C.1 Today Plan View (Main Content Area)

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ Header ─────────────────────────────────────────────────┐│
│ │  今日计划                           2025年7月15日 周二    ││
│ │                                                          ││
│ │  Energy:  [🔋高] [🔋中] [🔋低]      [🔄 重新规划]        ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ "Next Thing" Hero Card ─────────────────────────────────┐│
│ │                                                          ││
│ │  🎯 推荐下一步                                           ││
│ │  ┌────────────────────────────────────────────────────┐  ││
│ │  │                                                    │  ││
│ │  │  编写 Orbit API 文档                                │  ││
│ │  │  [就绪] [Orbit Core]                               │  ││
│ │  │                                                    │  ││
│ │  │  "这个任务截止日期临近，且与你当前的聚焦上下文匹配。   │  ││
│ │  │   完成它可以解锁 v2.0 里程碑的下一步。"               │  ││
│ │  │                                                    │  ││
│ │  │  [▶ 开始聚焦]         [☀ 稍后再说]                  │  ││
│ │  │                                                    │  ││
│ │  └────────────────────────────────────────────────────┘  ││
│ │                                                          ││
│ │  备选方案                                                ││
│ │  ┌──────────────────┐  ┌──────────────────┐             ││
│ │  │ Review PR #342   │  │ Update CI pipe   │             ││
│ │  │ [Orbit Core]     │  │ [—]              │             ││
│ │  │ "PR review有     │  │ "CI阻塞了其他    │             ││
│ │  │  时效性要求"      │  │  开发者的工作"    │             ││
│ │  │ [选择此项]       │  │ [选择此项]       │             ││
│ │  └──────────────────┘  └──────────────────┘             ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Today's Scheduled Blocks ───────────────────────────────┐│
│ │                                                          ││
│ │  09:00 ┌────────────────────────┐                        ││
│ │        │ 编写 Orbit API 文档     │  2h                   ││
│ │  11:00 └────────────────────────┘                        ││
│ │  11:00 ┌────────────────────────┐                        ││
│ │        │ Review PR #342         │  1h                    ││
│ │  12:00 └────────────────────────┘                        ││
│ │  12:00 ── 午休 ──                                        ││
│ │  14:00 ┌────────────────────────┐                        ││
│ │        │ Update CI pipeline     │  1.5h                  ││
│ │  15:30 └────────────────────────┘                        ││
│ │  15:30 ┌────────────────────────┐                        ││
│ │        │ ✨ 自由时间 / 缓冲      │                       ││
│ │  17:00 └────────────────────────┘                        ││
│ │                                                          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Carry-Forward Tasks ────────────────────────────────────┐│
│ │  ↩ 昨日延续 (2)                                          ││
│ │  ○ Fix login bug             [Auth v2] [已排期]          ││
│ │  ○ Write unit tests          [—]       [就绪]            ││
│ │                                                          ││
│ │  [全部加入今日]  [逐个决定]                               ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ All Today Tasks (flat list) ────────────────────────────┐│
│ │  ☀ 今日任务 (5)                                          ││
│ │  (standard task rows, ordered by focusRank)              ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Component Spec

**Header:**
- Date display: `<span className="text-foreground-400 text-sm">` with `YYYY年M月D日 周X` format.
- Energy selector: `<Tabs variant="bordered" size="sm">` with three items, each with a battery icon. Maps to `EnergyLevel` type. Changing energy triggers `generateTodayPlan()` re-run.
- Replan button: `<Button variant="flat" size="sm" startContent={<RefreshCw />}>重新规划</Button>` — calls `generateTodayPlan()` with current constraints.

**"Next Thing" Hero Card:**
- `<Card shadow="md" className="border-2 border-primary bg-primary/5 p-6">`
- This is the most prominent element on the page.
- Shows `NextThingResult.primary`: task title, status chip, project chip.
- Reasoning text: `<p className="text-sm text-foreground-500 italic">` — the agent's explanation for why this task is recommended.
- Primary CTA: `<Button color="primary" size="md">▶ 开始聚焦</Button>` — transitions task to `focused` and navigates to Focus section.
- Secondary: `<Button variant="flat" size="md">稍后再说</Button>` — dismisses recommendation, keeps task in today list.

**Alternatives:**
- Two `<Card isPressable shadow="sm" className="p-3">` side by side below the hero card.
- Each shows: task title, project chip, reasoning excerpt (1-2 lines, truncated).
- "选择此项" button → promotes this to the primary recommendation.

**Scheduled Blocks:**
- Vertical timeline visualization.
- Time labels on the left (09:00, 10:00, etc.) in a fixed-width column.
- Each `ScheduledBlock` is a colored bar/card: `<div className="bg-primary/10 border-l-4 border-primary rounded-r-md px-3 py-2">`. Height proportional to duration.
- Clicking a block selects the associated task in the right panel.
- Free time / buffer slots shown in a neutral dashed style.

**Carry-Forward Section:**
- Only visible if there are `isCarryForward === true` tasks.
- `<Card shadow="none" className="bg-warning/5 border border-warning/20 p-4">`
- Each carry-forward task shown as a standard task row with a `↩` badge.
- "全部加入今日": batch-sets `todayOn` for all carry-forwards.
- "逐个决定": expands each task with accept/dismiss buttons.

**All Today Tasks:**
- Simple flat list of all tasks where `isToday === true`, ordered by `focusRank`.
- Same row component as A.1 task rows.

### C.2 "Next Thing" Recommendation — Interaction Flow

```
User opens Today section
  → System calls computeNextThing() with:
      candidateTasks = today tasks
      constraints = { energyLevel, availableMinutes (from scheduled blocks) }
  → Result rendered in Hero Card

User changes Energy Level
  → Re-triggers computeNextThing()
  → Hero Card updates with smooth transition (fade out/in)

User clicks "开始聚焦"
  → transitionTask(taskId, 'focused')
  → startFocusSession(taskId, goal, materials)
  → activeSection changes to 'focus'

User clicks alternative
  → Swap primary and selected alternative
  → Hero Card updates

User clicks "重新规划"
  → generateTodayPlan() with current constraints
  → Entire Today view refreshes with new plan
```

---

## D — Focus Section (聚焦)

### D.1 Focus Mode View (Main Content Area — Immersive)

When Focus section is active, the layout changes to maximize concentration:

- **Left sidebar**: collapses to icon-only (sidebar width reduces to `w-14` with just icons, no labels).
- **Right panel**: becomes the Focus Materials panel.
- **Main content**: dedicated to the single focused task.

#### Layout

```
┌────┬──────────────────────────────────────┬──────────────────┐
│ 📌 │                                      │  Focus Materials │
│ 📋 │  ┌─ Focus Header ──────────────────┐ │                  │
│ ☀  │  │  🎯 聚焦模式                    │ │  ┌─ Context ───┐ │
│ 🔍 │  │  编写 Orbit API 文档             │ │  │ Project:    │ │
│ ⭐ │  │  Orbit Core → v2.0 Public API   │ │  │ Orbit Core  │ │
│    │  │                                  │ │  │             │ │
│    │  │  目标: 完成API文档初稿           │ │  │ Milestone:  │ │
│    │  │                                  │ │  │ v2.0 Public │ │
│    │  │  ⏱ 01:23:45     [⏸ 暂停]       │ │  │ API         │ │
│    │  └──────────────────────────────────┘ │  └─────────────┘ │
│    │                                       │                  │
│    │  ┌─ Editor ─────────────────────────┐ │  ┌─ Materials ─┐ │
│    │  │                                  │ │  │             │ │
│    │  │  (editor-dom block editor)       │ │  │ 📖 阅读素材 │ │
│    │  │                                  │ │  │  · REST     │ │
│    │  │  This is where the user writes   │ │  │    Guide    │ │
│    │  │  their output. The block editor  │ │  │  · OpenAPI  │ │
│    │  │  is embedded with full markdown  │ │  │    Spec     │ │
│    │  │  support.                        │ │  │             │ │
│    │  │                                  │ │  │ 🔬 研究参考 │ │
│    │  │                                  │ │  │  · API      │ │
│    │  │                                  │ │  │    Compare  │ │
│    │  │                                  │ │  │             │ │
│    │  │                                  │ │  │ [+ 添加]    │ │
│    │  │                                  │ │  └─────────────┘ │
│    │  │                                  │ │                  │
│    │  │                                  │ │  ┌─ Subtasks ──┐ │
│    │  │                                  │ │  │ ✓ 调研规范  │ │
│    │  │                                  │ │  │ ○ 写初稿    │ │
│    │  │                                  │ │  │ ○ 内部评审  │ │
│    │  │                                  │ │  └─────────────┘ │
│    │  └──────────────────────────────────┘ │                  │
│    │                                       │                  │
│    │  ┌─ Quick Actions ──────────────────┐ │  ┌─ Agent ─────┐ │
│    │  │ [✓ 完成] [⏸ 暂停] [🚫 阻塞]    │ │  │ 💬 需要帮助?│ │
│    │  │ [⏱ 休息5分钟]                    │ │  │ [打开对话]  │ │
│    │  └──────────────────────────────────┘ │  └─────────────┘ │
└────┴──────────────────────────────────────┴──────────────────┘
```

#### Component Spec

**Focus Header:**
- Title: `<h2 className="text-xl font-bold">` with a `Crosshair` icon.
- Breadcrumb: "Project → Milestone" in `text-sm text-foreground-400`.
- Goal: `<Card className="bg-content2 px-3 py-2 text-sm">` showing `FocusSession.goalDescription`.
- Timer: elapsed session time since `FocusSession.startedAt`. Displayed as `HH:MM:SS` in a `font-mono text-2xl` style. Uses `setInterval` to tick every second.
- Pause button: `<Button variant="flat" size="sm">⏸ 暂停</Button>` — pauses the timer (does not end the session).

**Editor Area:**
- Embedded `editor-dom` block editor, filling the remaining vertical space (`flex-1 overflow-y-auto`).
- If `FocusSession.outputTarget` is set, this editor opens that specific document. Otherwise, opens the task's body.

**Right Panel — Focus Materials:**
- **Context section**: Project and Milestone info from `FocusContext`, read-only.
- **Materials section**: Support links from `FocusMaterial[]`, grouped by kind (same as A.3 素材 tab). Each material is clickable to open in a reader/viewer.
- **Subtasks section**: compact checklist from `FocusContext.task` subtasks. Checking a subtask completes it instantly.
- **Agent section**: a small `<Card>` with a CTA to open the Agent conversation in a slide-over panel. Pre-seeded with focus context.

**Quick Actions Bar (bottom of main content):**
- Sticky to the bottom of the main content area.
- `<div className="flex gap-2 items-center border-t border-divider px-4 py-3 bg-background">`
- Buttons:
  - 完成: `<Button color="success">✓ 完成</Button>` → triggers focus session end flow with outcome `completed`.
  - 暂停: `<Button variant="flat">⏸ 暂停</Button>` → outcome `paused`, returns task to `scheduled`.
  - 阻塞: `<Button color="danger" variant="flat">🚫 阻塞</Button>` → outcome `blocked`.
  - 休息: `<Button variant="light">⏱ 休息5分钟</Button>` → starts a 5-minute countdown overlay (does not end session).

### D.2 Focus Session End

When the user ends a focus session (via any of the quick action buttons), a modal appears:

#### Layout

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  聚焦结束                                          │
│                                                    │
│  任务: 编写 Orbit API 文档                          │
│  时长: 1小时23分钟                                  │
│                                                    │
│  ─────────────────────────────────────────────     │
│                                                    │
│  结果                                              │
│  ○ ✅ 已完成 — 任务达成目标                          │
│  ● ⏸ 已暂停 — 未完成，稍后继续                      │
│  ○ 🚫 已阻塞 — 遇到障碍无法继续                     │
│  ○ ❌ 已放弃 — 不再需要这个任务                      │
│                                                    │
│  ─────────────────────────────────────────────     │
│                                                    │
│  快速笔记 (可选)                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ placeholder: "这次聚焦有什么收获或问题？"      │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ─────────────────────────────────────────────     │
│                                                    │
│  下一步                                            │
│  Agent建议: "根据你的完成情况,建议接下来做           │
│  Review PR #342"                                   │
│                                                    │
│  [确认结束]                    [继续聚焦]           │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### Component Spec

- `<Modal size="lg" isOpen={showEndFocus}>` from HeroUI.
- **Outcome selection**: `<RadioGroup>` with `<Radio>` items for each `FocusOutcome`: `completed`, `paused`, `blocked`, `abandoned`.
- **Quick note**: `<Textarea variant="bordered" minRows={2} placeholder="这次聚焦有什么收获或问题？" />` — optional. Saved as a `TaskEvent` with metadata.
- **Next suggestion**: Agent uses `computeNextThing()` to suggest what to do next. Shown as a `text-sm` italic recommendation. Clicking "确认结束" applies the outcome and optionally navigates to the suggested next task.
- **Continue**: "继续聚焦" dismisses the modal and returns to focus mode.
- **On confirm**:
  - Calls `endFocusSession(taskId, outcome)`.
  - If `completed`: transitions task to `done`.
  - If `paused`: transitions task back to `scheduled`.
  - If `blocked`: transitions task to `blocked`.
  - If `abandoned`: transitions task to `dropped`.
  - Records `TaskEvent` with the outcome and optional note.
  - Navigates back to Today section (or to the suggested next task's focus).

### D.3 No Active Focus — Empty State

When the user navigates to Focus section without an active `FocusSession`:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🎯                                       │
│                                                             │
│            当前没有聚焦任务                                   │
│                                                             │
│    从「今日」选择一个任务开始聚焦，                            │
│    或者让Agent为你推荐下一步。                                │
│                                                             │
│    [去今日计划]     [让Agent推荐]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- "去今日计划" → switches to Today section.
- "让Agent推荐" → calls `computeNextThing()` and auto-starts focus on the primary result.

---

## E — Review Section (回顾)

### E.1 Review Section — Main Content

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ Header ─────────────────────────────────────────────────┐│
│ │  回顾                                                    ││
│ │  [日回顾] [周回顾] [项目回顾]                              ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│  (Tab content changes per review type)                      │
└─────────────────────────────────────────────────────────────┘
```

- Top-level tabs: `<Tabs variant="solid" size="md">` with three review cycle tabs.

### E.2 Day Review (日回顾)

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  日回顾 — 2025年7月15日                                      │
│                                                             │
│ ┌─ Summary Stats ──────────────────────────────────────────┐│
│ │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         ││
│ │  │  5     │  │  3     │  │  2     │  │  1     │         ││
│ │  │  已完成 │  │  进行中 │  │  延续   │  │  阻塞   │         ││
│ │  └────────┘  └────────┘  └────────┘  └────────┘         ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Completed Today ────────────────────────────────────────┐│
│ │  ✅ 今日完成 (5)                                          ││
│ │                                                          ││
│ │  ✓ Write API documentation       [Orbit Core]  1h23m    ││
│ │  ✓ Review PR #342                [Orbit Core]  0h45m    ││
│ │  ✓ Fix login redirect bug        [Auth v2]     0h30m    ││
│ │  ✓ Update error messages         [Auth v2]     0h15m    ││
│ │  ✓ Reply to team feedback        [—]           0h20m    ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Carry-Forward ──────────────────────────────────────────┐│
│ │  ↩ 需要延续 (2)                                          ││
│ │                                                          ││
│ │  ○ Update CI pipeline            [—]       [就绪]        ││
│ │    原因: 等待团队确认方案                                  ││
│ │  ○ Security audit prep           [Auth v2] [已排期]      ││
│ │    原因: 时间不足，明日继续                                ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Decisions & Reflections ────────────────────────────────┐│
│ │  📝 今日决策与反思                                        ││
│ │                                                          ││
│ │  Agent 提示问题:                                          ││
│ │  · "今天最有价值的工作是什么？"                             ││
│ │  · "有什么阻碍了你的效率？"                                ││
│ │  · "明天最重要的一件事是什么？"                             ││
│ │                                                          ││
│ │  ┌──────────────────────────────────────────────────┐    ││
│ │  │  (Block editor for free-form journal note)       │    ││
│ │  │                                                  │    ││
│ │  └──────────────────────────────────────────────────┘    ││
│ │                                                          ││
│ │  [保存回顾]                                              ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Component Spec

**Summary Stats:**
- 4 stat cards in a `flex gap-3` row. Each card: `<Card className="text-center p-3 flex-1">` with a large number and label.
- Colors: Completed (green), In-progress (blue), Carry-forward (amber), Blocked (red).

**Completed Today:**
- Each completed task: standard task row with a checkmark, project chip, and **focus duration** shown on the right (computed from `FocusSession` start/end times).

**Carry-Forward:**
- Tasks where `isCarryForward === true`.
- Each task has an editable "原因" field: `<Input size="sm" placeholder="为什么延续？" />` — this feeds into the carry-forward reasoning.

**Decisions & Reflections:**
- Agent-generated prompt questions from `DAY_REVIEW_TEMPLATE.promptQuestions`.
- Questions rendered as `<ul className="list-disc pl-4 text-sm text-foreground-500">`.
- Below: an embedded `editor-dom` instance for free-form journaling.
- "保存回顾": `<Button color="primary">保存回顾</Button>` → calls `createReview({ cycle: 'day', ... })`.
- Saves a `Review` object with `status: 'draft'`. User can later confirm it.

### E.3 Week Review (周回顾)

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  周回顾 — 第29周 (7/14 – 7/20)                              │
│                                                             │
│ ┌─ Week Summary ───────────────────────────────────────────┐│
│ │  完成: 23 任务  ·  新建: 8 任务  ·  阻塞: 2 任务          ││
│ │  聚焦总时长: 18小时32分钟                                  ││
│ │                                                          ││
│ │  ┌─ Daily Sparkline ──────────────────────────────────┐  ││
│ │  │  Mon  Tue  Wed  Thu  Fri  Sat  Sun                 │  ││
│ │  │  ▃▃   ██   ▅▅   ██   ▃▃   ▁▁   ▁▁                 │  ││
│ │  │  3    5    4    6    3    1    1                    │  ││
│ │  └────────────────────────────────────────────────────┘  ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Project Progress This Week ─────────────────────────────┐│
│ │                                                          ││
│ │  Orbit Core      ██████░░░░ 60% → 72%  (+12%)           ││
│ │  Auth v2         ███░░░░░░░ 25% → 30%  (+5%)            ││
│ │  Infrastructure  ████████░░ 80% → 80%  (+0%) ⚠          ││
│ │                                                          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Insights ───────────────────────────────────────────────┐│
│ │  💡 洞察                                                  ││
│ │                                                          ││
│ │  Agent 分析:                                              ││
│ │  · "Infrastructure项目本周没有进展，是否需要调整优先级？"   ││
│ │  · "你在Orbit Core上的效率最高 (平均2.3h/task)"           ││
│ │  · "周四的聚焦时间最长 (4h12m)，考虑保持这个节奏"          ││
│ │                                                          ││
│ │  Agent 提示问题:                                          ││
│ │  · "这周最大的收获是什么？"                                ││
│ │  · "哪些项目需要更多关注？"                                ││
│ │  · "下周的首要目标是什么？"                                ││
│ │                                                          ││
│ │  ┌──────────────────────────────────────────────────┐    ││
│ │  │  (Block editor for weekly reflection)            │    ││
│ │  └──────────────────────────────────────────────────┘    ││
│ │                                                          ││
│ │  [保存周回顾]                                             ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Component Spec

**Week Summary:**
- Aggregate stats: `text-sm` inline counts.
- **Daily sparkline**: a simple bar chart showing tasks completed per day. Each bar is a `<div>` with `h-{n}` proportional to count. No external chart library — pure CSS.
  - Uses `flex items-end gap-1` container. Each bar: `w-8 bg-primary rounded-t` with computed height.

**Project Progress:**
- Each project row: project name, `<Progress>` bar showing previous → current progress, delta percentage.
- Delta shown as green `(+N%)` if positive, red if zero or negative. A `⚠` icon if no progress.

**Insights:**
- Agent observations from `ReviewOutput.observations` rendered as a bulleted list.
- Prompt questions from `WEEK_REVIEW_TEMPLATE.promptQuestions`.
- Editor instance for free-form weekly reflection.

### E.4 Project Review (项目回顾)

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  项目回顾                                                    │
│                                                             │
│ ┌─ Project Selector ───────────────────────────────────────┐│
│ │  需要回顾的项目:                                          ││
│ │  ┌──────────────────┐  ┌──────────────────┐              ││
│ │  │ ⚠ Auth v2       │  │ ⚠ Infrastructure │              ││
│ │  │ 上次: 14天前     │  │ 上次: 21天前      │              ││
│ │  └──────────────────┘  └──────────────────┘              ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Selected Project Review ────────────────────────────────┐│
│ │                                                          ││
│ │  Auth v2 — 项目回顾                                      ││
│ │  状态: 进行中 · 对齐: 维护                                ││
│ │  整体进度: ███░░░░░░░ 30%                                ││
│ │                                                          ││
│ │  里程碑状态:                                              ││
│ │  ✓ v1.0 基础认证     [已完成]                             ││
│ │  ● v1.5 OAuth集成     [进行中] — 60%                     ││
│ │  ○ v2.0 权限系统      [规划中]                            ││
│ │                                                          ││
│ │  阻塞项:                                                  ││
│ │  🚫 "等待第三方OAuth provider审批"                        ││
│ │                                                          ││
│ │  待决策:                                                  ││
│ │  · "是否要支持SAML? 需要额外2周开发"                       ││
│ │  · "v2.0 的权限模型是RBAC还是ABAC?"                       ││
│ │                                                          ││
│ │  Agent 提示问题:                                          ││
│ │  · "这个项目的愿景是否还清晰？"                            ││
│ │  · "当前最大的风险是什么？"                                ││
│ │  · "有哪些可以简化或删除的范围？"                           ││
│ │                                                          ││
│ │  ┌──────────────────────────────────────────────────┐    ││
│ │  │  (Block editor for project review notes)         │    ││
│ │  └──────────────────────────────────────────────────┘    ││
│ │                                                          ││
│ │  [保存项目回顾]                                           ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Component Spec

**Project Selector:**
- Shows projects where `needsReview === true` (from `isDueForReview()`).
- Each as an `<Card isPressable>` with warning styling and "上次回顾" timestamp.
- Clicking a project card loads its review below.

**Project Review Detail:**
- Milestone status: vertical list with status chips and progress bars (same as B.2 milestone list, but read-only summary).
- **Blocked items**: `<Card className="border-danger/20 bg-danger/5 p-3">` with blocked task/reason list.
- **Pending decisions**: `<Card className="border-warning/20 bg-warning/5 p-3">` with decision items. Each has an action button to resolve the decision.
- Prompt questions from `PROJECT_REVIEW_TEMPLATE.promptQuestions`.
- Editor for review notes.
- "保存项目回顾" → `createReview({ cycle: 'project', ... })` with `status: 'draft'`.

---

## F — Cross-cutting Patterns

### F.1 Confirmation Dialogs (确认门控)

The 7 `ConfirmationAction` types trigger a standardized confirmation modal.

#### Modal Design

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  ⚠ 需要确认                                       │
│                                                    │
│  操作: 升级为项目                                   │
│                                                    │
│  描述:                                             │
│  "Agent建议将任务「构建权限系统」升级为独立项目,     │
│   因为它包含多个里程碑和长期交付计划。"               │
│                                                    │
│  受影响对象:                                        │
│  · 任务「构建权限系统」                              │
│  · 3个子任务将成为项目任务                           │
│                                                    │
│  建议来源: Agent                                    │
│  推理:                                             │
│  "该任务的复杂度和子任务数量超出了单一任务的          │
│   管理范围。升级为项目可以更好地追踪进度。"           │
│                                                    │
│  ─────────────────────────────────────────────     │
│                                                    │
│  [✓ 批准]  [✎ 修改后批准]  [✕ 拒绝]               │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### Per-Action Styling

| Action | Chinese Label | Severity | Icon |
|---|---|---|---|
| `upgrade_to_project` | 升级为项目 | `warning` | `FolderUp` |
| `rewrite_vision` | 重写愿景 | `danger` | `PenLine` |
| `modify_directive` | 修改指令 | `danger` | `FileEdit` |
| `cross_project_reorder` | 跨项目重排 | `warning` | `ArrowLeftRight` |
| `milestone_change` | 变更里程碑 | `warning` | `Milestone` |
| `delete_permanent` | 永久删除 | `danger` | `Trash2` |
| `external_publish` | 外部发布 | `danger` | `ExternalLink` |

#### Component Spec

- `<Modal size="md">` with `<ModalHeader>`, `<ModalBody>`, `<ModalFooter>`.
- Severity drives the header icon color and confirm button color.
- `danger` actions: confirm button is `<Button color="danger">`.
- `warning` actions: confirm button is `<Button color="warning">`.
- "修改后批准": opens an inline edit form for the affected payload, then confirms with modifications. Maps to `GateDecision: 'modified'`.
- "拒绝": maps to `GateDecision: 'rejected'`. Closes modal, no action taken.

### F.2 Agent Attribution

Throughout the UI, actions taken by the agent vs. user are distinguished:

- **Agent badge**: `<Chip size="sm" variant="flat" color="secondary" startContent={<Bot size={12} />}>Agent</Chip>`
- **User badge**: `<Chip size="sm" variant="flat" color="default" startContent={<User size={12} />}>用户</Chip>`
- **System badge**: `<Chip size="sm" variant="flat" color="default" startContent={<Settings size={12} />}>系统</Chip>`

Used in: event timeline, confirmation gates, review insights, today plan reasoning.

### F.3 Reasoning Disclosure

Agent reasoning appears in multiple places (Next Thing, Today Plan, Confirmation Gates, Review Insights). Standard pattern:

```
┌──────────────────────────────────────────┐
│  💭 Agent 推理                           │
│  ▸ "这个任务截止日期临近..."   [展开 ▾]   │
│                                          │
│  (expanded state):                       │
│  ▾ "这个任务截止日期临近，且与你当前的     │
│     聚焦上下文匹配。完成它可以解锁         │
│     v2.0 里程碑的下一步。                 │
│     紧迫度: 8/10                         │
│     重要度: 7/10                         │
│     上下文匹配: 9/10"                    │
│                                          │
└──────────────────────────────────────────┘
```

- Default: collapsed to 1 line with ellipsis + "展开" toggle.
- Expanded: full reasoning text with score details if applicable (`TaskScoreDetail` fields).
- Container: `<Card className="bg-secondary/5 border border-secondary/20 p-3">`

### F.4 Status Transition Dropdown

Used when clicking the status dot on any task row:

```
┌─────────────────────┐
│  当前: 就绪          │
│  ─────────────────  │
│  → 已排期            │
│  → 已阻塞            │
│  → 已放弃            │
│  ─────────────────  │
│  ✕ 无效: 已捕获      │
│  ✕ 无效: 厘清中      │
└─────────────────────┘
```

- `<Dropdown>` triggered by clicking the status dot.
- Valid transitions (from `VALID_TRANSITIONS`) shown as clickable items.
- Invalid transitions shown grayed-out at the bottom (optional, for learning).
- Clicking a valid transition calls `transitionTask(taskId, newStatus)` and records a `TaskEvent`.
- If the transition requires confirmation (rare), the Confirmation Gate modal opens instead.

### F.5 Support Links Panel (in Task Detail)

See A.3 素材 tab. Additionally, the "关联素材" action opens a search modal:

```
┌────────────────────────────────────────────────────┐
│  关联素材到任务                                     │
│                                                    │
│  搜索: [____________________________]              │
│                                                    │
│  类型: [全部 ▼]                                    │
│                                                    │
│  结果:                                             │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📄 RESTful API Design Guide    [📖 阅读素材] │  │
│  │ 📄 OpenAPI Spec 3.0            [🔬 研究参考] │  │
│  │ 📝 API Docs Draft v1           [✏️ 写作输出] │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  相关性备注: [可选 ____________________]           │
│                                                    │
│  [关联]  [取消]                                    │
└────────────────────────────────────────────────────┘
```

- Modal with search input, type filter (`<Select>` with SupportLinkKind options), results list.
- Each result row has a kind badge and a clickable title.
- "相关性备注" maps to `SupportLink.relevanceNote`.
- "关联" calls `createSupportLink()`.

---

## 10. Empty & Error States

### Empty States (per section)

| Section | Illustration | Message | CTA |
|---|---|---|---|
| Tasks (no tasks) | `ClipboardList` icon, muted | "还没有任务" / "捕获你的第一个想法" | "快速捕获" button |
| Tasks (filter no results) | `SearchX` icon | "没有匹配的任务" | "清除筛选" link |
| Projects (no projects) | `FolderOpen` icon, muted | "还没有项目" / "创建一个项目来组织任务" | "创建项目" button |
| Today (no plan) | `Calendar` icon | "今日计划为空" / "添加任务到今日，或让Agent规划" | "生成今日计划" button |
| Focus (no session) | `Crosshair` icon | "当前没有聚焦任务" | "去今日计划" / "让Agent推荐" buttons |
| Review (nothing to review) | `BarChart3` icon | "暂无待回顾内容" / "完成一些任务后，这里会出现回顾" | — (informational only) |

**Visual pattern**: centered vertically in the main content area. Icon at 48px, muted color. Title in `text-lg font-medium`. Subtitle in `text-sm text-foreground-400`. CTA button below with `mt-4`.

### Error States

- **Network/data load error**: `<Card className="border-danger/20 bg-danger/5 p-4">` with `AlertTriangle` icon, error message, and "重试" button.
- **Invalid transition error**: toast notification (`<Toast>` / custom toast) appearing bottom-right: "无法执行此操作: {reason}". Auto-dismiss after 4 seconds.
- **Agent parse failure**: in Quick Capture, show inline warning: "Agent 无法解析输入，请尝试更详细地描述" with a retry button.

---

## 11. Accessibility & i18n Notes

### Accessibility

- All interactive elements have `aria-label` attributes (especially icon-only buttons).
- Status chips include `role="status"` and descriptive `aria-label` (e.g., "任务状态：就绪").
- Focus mode: `Escape` key opens the end-session modal (not silently exits).
- Keyboard shortcuts:
  - `Ctrl+N` / `⌘+N`: Quick capture
  - `Ctrl+Enter`: Confirm/submit in modals and capture
  - `Escape`: Close modals, exit expanded views
- Tab order follows visual flow: header → content → actions → sidebar.
- Color is never the sole indicator; all status chips include text labels.

### i18n Keys to Add

```typescript
// Task statuses
'task.status.captured': '已捕获',
'task.status.clarifying': '厘清中',
'task.status.ready': '就绪',
'task.status.scheduled': '已排期',
'task.status.focused': '聚焦中',
'task.status.done': '已完成',
'task.status.blocked': '已阻塞',
'task.status.dropped': '已放弃',

// Task actions
'task.action.startFocus': '开始聚焦',
'task.action.addToToday': '加入今日',
'task.action.markDone': '标记完成',
'task.action.markBlocked': '标记阻塞',
'task.action.drop': '放弃',
'task.action.quickCapture': '快速捕获',
'task.action.startClarify': '开始厘清',

// Today section
'today.title': '今日计划',
'today.energy.high': '高能量',
'today.energy.medium': '中能量',
'today.energy.low': '低能量',
'today.nextThing': '推荐下一步',
'today.alternatives': '备选方案',
'today.carryForward': '昨日延续',
'today.replan': '重新规划',
'today.addAllToday': '全部加入今日',

// Focus section
'focus.title': '聚焦模式',
'focus.goal': '目标',
'focus.end': '结束聚焦',
'focus.pause': '暂停',
'focus.outcome.completed': '已完成',
'focus.outcome.paused': '已暂停',
'focus.outcome.blocked': '已阻塞',
'focus.outcome.abandoned': '已放弃',
'focus.quickNote': '快速笔记',
'focus.empty': '当前没有聚焦任务',

// Review section
'review.day': '日回顾',
'review.week': '周回顾',
'review.project': '项目回顾',
'review.completedToday': '今日完成',
'review.carryForward': '需要延续',
'review.decisions': '待决策',
'review.insights': '洞察',
'review.save': '保存回顾',

// Confirmation gates
'gate.title': '需要确认',
'gate.approve': '批准',
'gate.reject': '拒绝',
'gate.modifyApprove': '修改后批准',
'gate.action.upgrade_to_project': '升级为项目',
'gate.action.rewrite_vision': '重写愿景',
'gate.action.modify_directive': '修改指令',
'gate.action.cross_project_reorder': '跨项目重排',
'gate.action.milestone_change': '变更里程碑',
'gate.action.delete_permanent': '永久删除',
'gate.action.external_publish': '外部发布',

// Support links
'supportLink.reading_material': '阅读素材',
'supportLink.research_reference': '研究参考',
'supportLink.writing_output': '写作输出',
'supportLink.discussion_thread': '讨论线索',
'supportLink.add': '关联素材',

// Agent
'agent.reasoning': 'Agent 推理',
'agent.suggestion': 'Agent 建议',
'agent.confidence': '置信度',
'agent.expand': '展开',
'agent.collapse': '收起',

// Project
'project.create': '创建项目',
'project.alignment.aligned_to_vision': '愿景对齐',
'project.alignment.maintenance': '维护',
'project.alignment.opportunistic': '机会性',
'project.needsReview': '需要回顾',
'project.lastReviewed': '上次回顾',
'project.addMilestone': '添加里程碑',

// Milestone
'milestone.status.planned': '规划中',
'milestone.status.active': '进行中',
'milestone.status.done': '已完成',
'milestone.status.dropped': '已放弃',

// Common
'common.empty.noTasks': '还没有任务',
'common.empty.noProjects': '还没有项目',
'common.empty.noResults': '没有匹配的结果',
'common.retry': '重试',
'common.clearFilter': '清除筛选',
'common.loadMore': '加载更多',
```

---

## Appendix: HeroUI Component Usage Summary

| Component | Usage |
|---|---|
| `<Button>` | All CTAs, action bars, icon buttons |
| `<Card>` | Task rows, project cards, stat cards, milestone cards, hero card |
| `<Chip>` | Status chips, project badges, actor badges, kind badges |
| `<Tabs>` | Section sub-navigation (list/board, detail tabs, review cycle tabs) |
| `<Input>` | Quick capture, search, inline edits |
| `<Textarea>` | Focus end note, review journal |
| `<Select>` | Project picker, milestone picker, sort/group dropdowns |
| `<Dropdown>` | Status transition, context menus, more-actions |
| `<Modal>` | Confirmation gates, create project, link materials, focus end |
| `<Progress>` | Project progress, milestone progress, subtask progress |
| `<RadioGroup>` | Focus outcome selection, decision mode |
| `<Separator>` | Section dividers |
| `<Tooltip>` | Icon button labels, truncated text expansion |

---

*End of design document.*
