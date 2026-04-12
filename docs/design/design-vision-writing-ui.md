# 愿景写入 (Vision Writing) — UI Design Specification

> **Module**: `@orbit/feature-vision`
> **Status**: Design proposal
> **Locale**: zh-CN primary, English fallback
> **Target platforms**: Desktop (Electron), Web

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Navigation Entry Point](#2-navigation-entry-point)
3. [Onboarding Flow UI](#3-onboarding-flow-ui)
4. [Vision Dashboard (List View)](#4-vision-dashboard-list-view)
5. [Vision Editor View](#5-vision-editor-view)
6. [Version History UI](#6-version-history-ui)
7. [Directive Panel](#7-directive-panel)
8. [Reminder Overlay](#8-reminder-overlay)
9. [Privacy Controls](#9-privacy-controls)
10. [Agent Interaction](#10-agent-interaction)
11. [Mobile Considerations](#11-mobile-considerations)
12. [Component Inventory](#12-component-inventory)

---

## 1. Design Principles

| Principle | Rationale |
|-----------|-----------|
| **User-authored, agent-assisted** | The vision is always the user's words. Agent suggests; user confirms. |
| **Gentle, never intrusive** | Reminders use soft language and dismissable overlays — never block workflow. |
| **Privacy by default** | `local_only` is the default. Every sync/agent-access is opt-in with clear labels. |
| **Progressive disclosure** | Onboarding reveals complexity gradually. Dashboard → Editor → Versions → Directives. |
| **Consistent with Orbit** | Reuses the existing 3-panel layout, HeroUI components, semantic tokens, Lucide icons. |

---

## 2. Navigation Entry Point

### 2.1 Sidebar Placement

The "愿景" section is added to the sidebar **above** the existing "Projects" section, creating a new top-level category that visually separates direction-setting (愿景) from execution (Projects, Tasks).

```
┌─────────────────────────────┐
│  🌀 Orbit                   │
│  [+ 新建对象]               │  ← Button variant="primary" fullWidth
│                             │
│  ─── 方向 ──────────────── │  ← Section header, text-xs text-muted uppercase
│  ◎  愿景          2        │  ← NEW: Vision nav item
│                             │
│  ─── 执行 ──────────────── │  ← Section header
│  📅 今天           5        │
│  ◎  专注           1        │
│  📊 回顾           ·        │
│  📂 项目           3        │
│  📋 任务          12        │
│                             │
│  ─── ─── ─── ─── ─── ──── │
│  ⚙  🌙  🤖  🔬  👤        │  ← Bottom controls
└─────────────────────────────┘
```

### 2.2 Specification

| Property | Value |
|----------|-------|
| **Label** | `愿景` |
| **Icon** | `Compass` from Lucide React — represents direction-finding, not yet a destination |
| **Badge** | Count of `active` visions (from `VisionRepository.list`) |
| **Active style** | `bg-accent-soft text-accent font-medium` (matches existing nav pattern) |
| **Inactive style** | `text-muted hover:bg-surface-secondary` |
| **Section header** | New `方向` (Direction) section header above, `执行` (Execution) header above Today |

### 2.3 First-Time Entry

When the user has **zero visions** and clicks `愿景` for the first time:

- The main panel shows the **Onboarding Flow** (Section 3) instead of the Dashboard
- After onboarding completes, subsequent clicks go directly to the Dashboard (Section 4)
- A small `Chip` badge `新` (New) appears on the sidebar item until first visit

---

## 3. Onboarding Flow UI

### 3.1 Layout Strategy

The onboarding uses a **full main-panel takeover** — it fills `flex-1` (the main content area), while the sidebar and right panel remain visible but dimmed (opacity-50, pointer-events-none). This preserves spatial context while focusing attention.

```
┌──────────┬──────────────────────────────────────┬────────────┐
│          │                                      │            │
│ Sidebar  │         ONBOARDING CONTENT           │  Right     │
│ (dimmed) │         (main panel flex-1)           │  (dimmed)  │
│          │                                      │            │
│          │  ┌──────────────────────────────┐    │            │
│          │  │     Step indicator (top)      │    │            │
│          │  ├──────────────────────────────┤    │            │
│          │  │                              │    │            │
│          │  │     Step content (center)     │    │            │
│          │  │                              │    │            │
│          │  ├──────────────────────────────┤    │            │
│          │  │     Navigation (bottom)       │    │            │
│          │  └──────────────────────────────┘    │            │
│          │                                      │            │
└──────────┴──────────────────────────────────────┴────────────┘
```

### 3.2 Step Indicator

A minimal horizontal progress bar at the top of the onboarding area. Not numbered — uses dots to avoid overwhelming the user.

```
     ●───●───○───○───○───○
     1   2   3   4   5   6
```

- **Completed**: `●` filled circle, `bg-accent`
- **Current**: `●` filled circle, `bg-accent` with pulse animation
- **Upcoming**: `○` outline circle, `border-border`
- **Connector**: 2px line, `bg-accent` for completed segments, `bg-border` for upcoming

**Component**: Custom `<StepIndicator steps={6} current={currentIndex} />`

### 3.3 Step Details

Each step occupies the center of the main panel with `max-w-2xl mx-auto` to create a comfortable reading width.

---

#### Step 1: `positioning_intro` — 欢迎 & 定位

**Purpose**: Introduce the vision concept with warmth. Zero input required.

```
┌──────────────────────────────────────────────┐
│              ●───○───○───○───○───○            │
│                                              │
│                  🧭                          │  ← Compass icon, size={48}
│                                              │
│           你想过自己真正要去哪里吗？           │  ← text-2xl font-semibold
│                                              │
│     在 Orbit 中，「愿景」是你写给未来自己     │
│     的一封信——它不需要完美，只需要真实。      │  ← text-base text-muted, max-w-md
│                                              │
│     接下来，我们会用几分钟帮你写下它。        │
│     Agent 会在一旁辅助，但最终每个字          │
│     都由你决定。                              │
│                                              │
│              [ 开始写我的愿景 ]               │  ← Button variant="primary" size="lg"
│                                              │
│          稍后再说                              │  ← text link, text-muted text-sm
└──────────────────────────────────────────────┘
```

**Interactions**:
- `开始写我的愿景` → `advanceStep(session, { acknowledged: true })` → go to Step 2
- `稍后再说` → close onboarding, return to empty Dashboard with a "继续引导" card

**Components**: `Button` (primary, lg), plain text link

---

#### Step 2: `vision_writing` — 写下你的愿景

**Purpose**: Free-form vision authoring using the block editor.

```
┌──────────────────────────────────────────────┐
│          ●───●───○───○───○───○                │
│                                              │
│  写下你的愿景                                 │  ← text-xl font-semibold
│  不用在意格式——想到什么就写什么。              │  ← text-sm text-muted
│                                              │
│  ┌─ 愿景标题 ─────────────────────────────┐  │
│  │  我的人生愿景                           │  │  ← Input placeholder="给愿景起个名字"
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─ 范围 ────────────────────────────────┐  │
│  │  ○ 人生 (life)                        │  │
│  │  ○ 事业 (career)                      │  │  ← Radio group, 3 options
│  │  ○ 主题 (theme)                       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  # 我想成为什么样的人                   │  │
│  │                                        │  │
│  │  我希望做一个对世界有正面影响的人。      │  │  ← Block editor (EditorDomModule)
│  │  在技术领域持续深耕，同时保持对        │  │     mode: 'vision'
│  │  生活的热爱。                           │  │     placeholder: "从这里开始写..."
│  │                                        │  │     Slash menu available
│  │  / ← 输入 "/" 唤起命令菜单             │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ← 上一步          [ 让 Agent 帮我润色 → ]   │
└──────────────────────────────────────────────┘
```

**Layout details**:
- Title input: `Input` from HeroUI, `variant="bordered"` with label floating
- Scope selector: Three `Chip` components acting as radio buttons — one selected (variant="solid" color="accent"), others (variant="bordered")
- Editor: Embedded `EditorDomModule` in a `rounded-xl border border-border` container, min-height 200px, max-height 60vh with scroll
- Editor supports: `paragraph`, `heading`, `list`, `quote`, `callout` blocks
- Slash menu items relevant to vision: heading, list, quote, callout, divider

**Interactions**:
- Title input updates `createVision()` title field
- Scope chips toggle `VisionScope`
- Editor content is serialized to markdown via `markdown-serializer`
- `让 Agent 帮我润色 →` requires title + at least 1 paragraph → `advanceStep(session, { title, scope, bodyMarkdown })`
- `← 上一步` returns to Step 1

**Validation**:
- Title is required (min 2 characters)
- Body is required (min 20 characters)
- Show inline validation with `text-danger text-xs` below field

**Empty state**: Editor shows placeholder text: `"从这里开始写……\n\n可以用 / 打开命令菜单添加标题、列表等格式。"`

---

#### Step 3: `agent_refinement` — Agent 润色

**Purpose**: Agent suggests structural and wording improvements. User keeps full control.

```
┌──────────────────────────────────────────────┐
│          ●───●───●───○───○───○                │
│                                              │
│  Agent 正在为你的愿景提供建议                  │  ← text-xl font-semibold
│                                              │
│  ┌─ 你的原稿 ─────────┬─ Agent 建议 ────────┐│
│  │                    │                      ││
│  │  # 我想成为什么样   │  # 我想成为什么样的人 ││
│  │  的人               │                      ││
│  │                    │  我希望做一个对世界   ││
│  │  我希望做一个对世  │  有 **正面影响** 的   ││
│  │  界有正面影响的人。│  人——在技术领域持续   ││
│  │  在技术领域持续深  │  深耕，同时守护对    ││  ← Side-by-side diff
│  │  耕，同时保持对生  │  生活的热爱。        ││     Left: read-only, bg-surface
│  │  活的热爱。        │                      ││     Right: editable, bg-background
│  │                    │  > 💡 Agent 建议:     ││
│  │                    │  > 加入具体的时间     ││
│  │                    │  > 维度和可衡量的     ││
│  │                    │  > 方向。             ││
│  │                    │                      ││
│  └────────────────────┴──────────────────────┘│
│                                              │
│  ┌─ Agent 说明 ──────────────────────────────┐│
│  │ 💬 我做了以下调整:                         ││
│  │  · 加强了"正面影响"的语气                  ││  ← Card, bg-accent-soft
│  │  · 合并了两个短句让语流更自然              ││     assistant-text style
│  │  · 建议补充具体方向                        ││
│  └────────────────────────────────────────────┘│
│                                              │
│  ← 用我的原稿    [ 采纳修改 ]  重新生成 ↻    │
└──────────────────────────────────────────────┘
```

**Layout details**:
- **Split pane**: Two columns inside a `border border-border rounded-xl overflow-hidden`
  - Left column (50%): User's original, `bg-surface`, read-only, with syntax highlighting for diff (removed lines get `bg-danger/10`)
  - Right column (50%): Agent's suggestion, `bg-background`, editable (full block editor), added lines get `bg-success/10`
- **Agent explanation card**: Below the split pane, uses `Card` with `bg-accent-soft` background, shows bullet list of changes
- **Diff highlighting**: Uses `diffVersions()` output — `added` lines shown in green bg, `removed` in red bg, `unchanged` in normal bg

**Interactions**:
- `采纳修改` → saves agent version, `authoredBy: 'user-confirmed-agent-draft'`, calls `advanceStep()`
- `用我的原稿` → keeps original, `authoredBy: 'user'`, calls `advanceStep()`
- `重新生成 ↻` → re-runs agent refinement with same input, updates right column
- User can freely edit the right column before adopting
- Right column changes are tracked — if user edits agent suggestion, `authoredBy` stays `'user-confirmed-agent-draft'`

**Loading state**: While agent is processing, right column shows:
```
┌────────────────────────────┐
│                            │
│     ◌  Agent 正在思考...   │  ← Spinner size="sm" + text-muted
│                            │
│     ████████░░░ 生成中     │  ← Subtle progress indication
│                            │
└────────────────────────────┘
```

**Error state**: If agent fails:
```
┌────────────────────────────┐
│  ⚠ Agent 暂时无法连接      │  ← text-warning
│  你可以直接使用原稿继续     │
│  [ 重试 ]  [ 用我的原稿 → ]│
└────────────────────────────┘
```

---

#### Step 4: `confirmation` — 确认你的愿景

**Purpose**: Final review before committing. A calm, focused reading experience.

```
┌──────────────────────────────────────────────┐
│          ●───●───●───●───○───○                │
│                                              │
│             确认你的愿景                       │  ← text-xl font-semibold
│     仔细阅读一遍——这将成为你的方向指南。       │  ← text-sm text-muted
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │        ✧  我的人生愿景  ✧              │  │  ← title, text-lg font-semibold
│  │           life · v1                    │  │  ← Chip scope + version
│  │                                        │  │
│  │  ──────────────────────────────────    │  │  ← Separator
│  │                                        │  │
│  │  # 我想成为什么样的人                   │  │
│  │                                        │  │
│  │  我希望做一个对世界有正面影响的人       │  │  ← Rendered markdown, read-only
│  │  ——在技术领域持续深耕，同时守护        │  │     bg-surface, rounded-xl
│  │  对生活的热爱。                         │  │     py-8 px-10 (generous padding)
│  │                                        │  │
│  │  > 💡 加入具体的时间维度和可衡量的     │  │
│  │  > 方向。                              │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ← 返回修改             [ 确认并保存 ✓ ]     │
└──────────────────────────────────────────────┘
```

**Layout details**:
- Vision displayed in a centered `Card` with extra padding (`py-8 px-10`) for a "letter" feel
- Markdown rendered with `heading`, `paragraph`, `quote`, `callout` styles
- Scope shown as `Chip variant="soft" color="accent"` — e.g., `人生` / `事业` / `主题`
- Version shown as `Chip variant="soft" color="default"` — `v1`

**Interactions**:
- `确认并保存 ✓` → calls `createVision()` + `appendVersion()` + `advanceStep()`
- `← 返回修改` → goes back to Step 2 (vision_writing) with data preserved

---

#### Step 5: `reminder_posture` — 选择提醒方式

**Purpose**: Let user choose how the agent references their vision in daily use.

```
┌──────────────────────────────────────────────┐
│          ●───●───●───●───●───○                │
│                                              │
│           Agent 什么时候提醒你？               │  ← text-xl font-semibold
│     选择一个适合你的提醒频率。                 │
│     之后随时可以在设置中更改。                 │  ← text-sm text-muted
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ◉  决策时刻                           │  │  ← Selected: border-accent bg-accent-soft
│  │     当你做重要选择时，Agent 会轻声      │  │     VisionReminderMode: 'decision_points'
│  │     提醒你回顾愿景。                    │  │
│  │     推荐                                │  │  ← Chip "推荐" color="accent" size="sm"
│  ├────────────────────────────────────────┤  │
│  │  ○  仅在回顾时                         │  │  ← VisionReminderMode: 'review_only'
│  │     只在每日/每周回顾环节出现。          │  │
│  ├────────────────────────────────────────┤  │
│  │  ○  我主动问时                         │  │  ← VisionReminderMode: 'on_request'
│  │     只有当你明确要求时才会提及。         │  │
│  ├────────────────────────────────────────┤  │
│  │  ○  完全静默                           │  │  ← VisionReminderMode: 'silent'
│  │     Agent 不会主动提及你的愿景。         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ← 上一步                     [ 继续 → ]     │
└──────────────────────────────────────────────┘
```

**Layout details**:
- Four radio-style cards in a vertical stack
- Each card: `border border-border rounded-lg px-4 py-3 cursor-pointer transition-all`
- Selected card: `border-accent bg-accent-soft`
- Unselected: `hover:bg-surface-secondary`
- "推荐" badge on `decision_points` option

**Interactions**:
- Click a card → select that reminder mode
- `继续 →` → `advanceStep(session, { reminderMode })` → updates `Vision.reminderMode`
- Default selection: `decision_points` (recommended)

---

#### Step 6: `landing_handoff` — 完成 🎉

**Purpose**: Celebrate completion and hand off to normal usage.

```
┌──────────────────────────────────────────────┐
│          ●───●───●───●───●───●                │
│                                              │
│                  ✨                           │
│                                              │
│           你的愿景已经就位！                   │  ← text-2xl font-semibold
│                                              │
│     从现在起，Orbit 会在合适的时刻             │
│     帮你回顾它。你可以随时在「愿景」           │
│     页面查看和编辑。                           │  ← text-base text-muted
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ◎ 愿景      →  查看你的愿景列表        │  │
│  │  📊 回顾      →  在回顾时看到愿景提醒    │  │  ← Quick links
│  │  🤖 Agent    →  在对话中引用你的愿景     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│              [ 进入愿景页面 ]                 │  ← Button variant="primary"
│                                              │
└──────────────────────────────────────────────┘
```

**Interactions**:
- `进入愿景页面` → `completeOnboarding(session)` → navigate to Vision Dashboard
- Quick links navigate to respective sections
- Confetti/sparkle animation on mount (CSS keyframe, subtle — 1 second duration)

---

## 4. Vision Dashboard (List View)

### 4.1 Layout

Occupies the **main content panel** (`flex-1`). The right panel shows contextual detail for the selected vision.

```
┌──────────┬──────────────────────────────────────┬────────────────────┐
│          │  愿景                    [+ 新建愿景] │                    │
│ Sidebar  │                                      │   Right Panel      │
│          │  ┌─ Tabs ──────────────────────────┐ │   (Vision Detail)  │
│  ◎ 愿景  │  │  活跃 (2)  │  已归档 (1)        │ │                    │
│  ← active│  └──────────────────────────────────┘ │                    │
│          │                                      │                    │
│          │  ┌── Vision Card ──────────────────┐ │                    │
│          │  │  🧭 我的人生愿景                 │ │                    │
│          │  │  人生 · v3 · 3天前更新           │ │                    │
│          │  │  "我希望做一个对世界有正面..."    │ │                    │
│          │  │  ● 决策时刻提醒  🔒 仅本地       │ │                    │
│          │  └──────────────────────────────────┘ │                    │
│          │                                      │                    │
│          │  ┌── Vision Card ──────────────────┐ │                    │
│          │  │  🧭 技术精进之路                 │ │                    │
│          │  │  事业 · v1 · 1周前创建           │ │                    │
│          │  │  "成为一名有影响力的技术..."      │ │                    │
│          │  │  ● 仅回顾时  ☁ 仅同步摘要       │ │                    │
│          │  └──────────────────────────────────┘ │                    │
│          │                                      │                    │
└──────────┴──────────────────────────────────────┴────────────────────┘
```

### 4.2 Header

```
愿景                                              [+ 新建愿景]
```

- Title: `text-lg font-semibold`
- Button: `Button variant="primary" size="sm"` with `Plus` icon

### 4.3 Tab Bar

```
┌──────────────────────────────────────┐
│  活跃 (2)  │  已归档 (1)             │
└──────────────────────────────────────┘
```

- `Tabs` + `Tabs.List` + `Tabs.Tab`
- Tab 1: `活跃` — `status === 'active'`
- Tab 2: `已归档` — `status === 'archived'`
- Count badge inline with tab label

### 4.4 Vision Card

Each vision is rendered as a `Card` with the following anatomy:

```
┌──────────────────────────────────────────────┐
│  🧭  我的人生愿景                   ··· ▾    │  ← Card.Header: icon + title + actions menu
│  ──────────────────────────────────────────  │  ← Separator
│  人生 · v3 · 3天前更新                       │  ← metadata row: Chips
│                                              │
│  "我希望做一个对世界有正面影响的人——在        │  ← body preview: 2 lines, text-sm text-muted
│  技术领域持续深耕，同时守护对生活的热爱。"    │     truncated with text-ellipsis
│                                              │
│  ● 决策时刻提醒     🔒 仅本地               │  ← footer: reminder mode + privacy
└──────────────────────────────────────────────┘
```

**Component mapping**:

| Element | Component | Styling |
|---------|-----------|---------|
| Container | `Card` | `hover:border-accent/50 cursor-pointer transition-all` |
| Icon | `Compass` (Lucide) | `size={18} className="text-accent"` |
| Title | `Card.Title` | `text-base font-medium` |
| Actions | `Button isIconOnly variant="ghost"` | `MoreHorizontal` icon → dropdown |
| Scope chip | `Chip variant="soft" color="accent" size="sm"` | `人生` / `事业` / `主题` |
| Version chip | `Chip variant="soft" color="default" size="sm"` | `v3` |
| Timestamp | Plain text | `text-xs text-muted` |
| Body preview | `Card.Content` | `text-sm text-muted line-clamp-2` |
| Reminder indicator | `Chip variant="soft" size="sm"` | Color by mode |
| Privacy indicator | `Chip variant="soft" size="sm"` | `Lock` / `Cloud` / `CloudOff` icon |

**Reminder mode indicators**:

| Mode | Label | Chip color |
|------|-------|------------|
| `decision_points` | `● 决策时刻` | `accent` |
| `review_only` | `● 仅回顾时` | `success` |
| `on_request` | `● 主动询问` | `default` |
| `silent` | `○ 静默` | `default` (dimmed) |

**Privacy indicators**:

| Visibility | Label | Icon |
|------------|-------|------|
| `local_only` | `🔒 仅本地` | `Lock` |
| `cloud_summary` | `☁ 仅同步摘要` | `CloudUpload` |
| `cloud_full` | `☁ 完整同步` | `Cloud` |

**Actions dropdown** (on `···` click):
- `编辑` (Edit) — navigate to Vision Editor
- `查看历史` (View History) — navigate to Version History
- `归档` (Archive) — calls `VisionRepository.archive()`
- `管理指令` (Manage Directives) — open Directive panel
- `隐私设置` (Privacy Settings) — open Privacy controls

### 4.5 Empty States

**No visions at all (post-onboarding skip)**:
```
┌──────────────────────────────────────────────┐
│                                              │
│                    🧭                        │  ← Compass icon, size={36}
│                                              │
│             还没有写下愿景                    │  ← text-base text-muted
│     愿景帮助你明确方向，让 Agent              │
│     更好地辅助你的日常决策。                  │
│                                              │
│           [ 开始引导流程 ]                    │  ← Button variant="primary"
│                                              │
└──────────────────────────────────────────────┘
```

**Archived tab empty**:
```
┌──────────────────────────────────────────────┐
│             没有已归档的愿景                   │  ← text-sm text-muted, py-8
└──────────────────────────────────────────────┘
```

### 4.6 Card Click Behavior

Clicking a Vision Card:
1. The card gets a `border-accent` left border (similar to focus task highlighting: `border-l-3 border-accent`)
2. The **right panel** updates to show the **Vision Quick View** (see Section 4.7)
3. Double-click or pressing Enter opens the **Vision Editor** (Section 5)

### 4.7 Right Panel — Vision Quick View

When a vision is selected in the Dashboard, the right panel (w-72) shows a condensed read-only preview:

```
┌────────────────────────────┐
│  我的人生愿景               │  ← text-sm font-semibold
│  人生 · v3                 │  ← Chips
│                            │
│  ────────────────────────  │  ← Separator
│                            │
│  # 我想成为什么样的人       │
│                            │  ← Rendered markdown body
│  我希望做一个对世界有正面   │     text-sm, full text
│  影响的人——在技术领域持续   │     overflow-y-auto
│  深耕，同时守护对生活的    │
│  热爱。                    │
│                            │
│  ────────────────────────  │
│                            │
│  提醒方式  决策时刻         │  ← Key-value pairs
│  隐私级别  仅本地           │
│  上次确认  3天前            │
│  版本数    3               │
│                            │
│  ────────────────────────  │
│                            │
│  活跃指令 (2)              │  ← Directive summary
│  · Q2 技术深耕计划          │
│  · 保持运动习惯            │
│                            │
│  ────────────────────────  │
│                            │
│  [ 编辑 ]  [ 查看历史 ]    │  ← Action buttons
└────────────────────────────┘
```

**Components**:
- Tabs removed from right panel header (replaced by vision context)
- Key-value pairs: `text-xs text-muted` for keys, `text-xs text-foreground` for values
- Directive list: clickable items that expand the Directive Panel

---

## 5. Vision Editor View

### 5.1 Layout

The editor takes over the **main content panel**. The right panel becomes the **Agent Assistant** (Section 10).

```
┌──────────┬──────────────────────────────────────┬────────────────────┐
│          │  ← 返回愿景列表        ···  🔒  ▾   │                    │
│ Sidebar  │                                      │  Agent Assistant   │
│          │  ┌─ Title ────────────────────────┐  │  (right panel)     │
│          │  │  我的人生愿景                    │  │                    │
│          │  └────────────────────────────────┘  │  ┌──────────────┐  │
│          │                                      │  │ 💬 有什么需   │  │
│          │  人生 · v3 · 上次编辑: 2天前         │  │ 要帮助的？   │  │
│          │                                      │  │              │  │
│          │  ┌── Editor ──────────────────────┐  │  │  建议:       │  │
│          │  │                                │  │  │  · 加入时间  │  │
│          │  │  # 我想成为什么样的人           │  │  │    维度      │  │
│          │  │                                │  │  │  · 补充衡量  │  │
│          │  │  我希望做一个对世界有正面影响   │  │  │    标准      │  │
│          │  │  的人——在技术领域持续深耕，    │  │  │              │  │
│          │  │  同时守护对生活的热爱。         │  │  │ [发送]       │  │
│          │  │                                │  │  └──────────────┘  │
│          │  │  > 💡 未来一年，我希望...       │  │                    │
│          │  │                                │  │                    │
│          │  │  ## 具体方向                    │  │                    │
│          │  │  - 深度学习系统设计             │  │                    │
│          │  │  - 每周运动 3 次                │  │                    │
│          │  │  - 每月读 2 本书                │  │                    │
│          │  │                                │  │                    │
│          │  └────────────────────────────────┘  │                    │
│          │                                      │                    │
│          │  自动保存 ✓             [ 保存新版本 ]│                    │
└──────────┴──────────────────────────────────────┴────────────────────┘
```

### 5.2 Header Bar

```
← 返回愿景列表                     🔒 仅本地  ···  ▾
```

- Back button: `Button variant="ghost" size="sm"` with `ChevronLeft` icon + label
- Privacy badge: clickable `Chip` that opens Privacy Controls (Section 9)
- Actions menu (`···`): Archive, Duplicate, Export markdown, Delete

### 5.3 Metadata Row

```
人生 · v3 · 上次编辑: 2天前 · Agent 辅助草稿
```

- Scope: `Chip variant="soft" color="accent" size="sm"`
- Version: plain text `text-xs text-muted`
- Last edited: relative time, `text-xs text-muted`
- Author badge: `Chip size="sm"` — `"用户"` or `"Agent 辅助草稿"` based on `authoredBy`

### 5.4 Editor Area

- Uses `EditorDomModule` with a new mode: `'vision'`
- Block types enabled: `paragraph`, `heading`, `list`, `list-item`, `quote`, `callout`, `divider`
- Block types disabled for vision: `code`, `table`, `image`, `embed`, `reference`, `snapshot` (vision is prose-focused)
- Slash menu filtered to vision-relevant items
- `min-h-[400px]` container, `max-w-3xl mx-auto` for comfortable line length
- `bg-background` (not `bg-surface`) to distinguish from cards

### 5.5 Footer

```
自动保存 ✓                                    [ 保存新版本 ]
```

- Auto-save indicator: `text-xs text-muted` with `Check` icon (green flash on save)
- Auto-save triggers on debounced content change (2s delay), updates current version in-place
- `保存新版本`: `Button variant="secondary" size="sm"` — creates a new `VisionVersion` via `appendVersion()`
- Clicking `保存新版本` opens a small inline form:

```
┌──────────────────────────────────────────────┐
│  这次修改了什么？                              │
│  ┌────────────────────────────────────────┐  │
│  │  加入了具体方向和时间维度               │  │  ← Input for changeNote
│  └────────────────────────────────────────┘  │
│  [ 取消 ]                   [ 保存 v4 ]     │
└──────────────────────────────────────────────┘
```

### 5.6 Error States

**Save failure**:
```
┌──────────────────────────────────────────────┐
│  ⚠ 保存失败 — 请检查网络连接                  │  ← inline bar, bg-danger/10
│  [ 重试 ]                                    │
└──────────────────────────────────────────────┘
```
Shown as a slim bar above the footer, `bg-danger/10 text-danger text-sm px-4 py-2 rounded-lg`.

---

## 6. Version History UI

### 6.1 Entry Point

Accessible from:
- Vision Card actions dropdown → `查看历史`
- Vision Editor header → `···` → `版本历史`
- Right panel quick view → `查看历史` button

### 6.2 Layout

Takes over the **main content panel** with a two-zone layout:

```
┌──────────┬───────────────┬───────────────────────┬────────────┐
│          │  版本历史      │                       │            │
│ Sidebar  │  我的人生愿景  │                       │  Diff      │
│          │               │                       │  Detail    │
│          │  ┌─ Timeline ┐│   Selected Version    │  (right    │
│          │  │           ││                       │   panel)   │
│          │  │  v3 ● 今天 ││   # 我想成为什么样   │            │
│          │  │  加入了具体 ││   的人               │  v2 → v3   │
│          │  │  方向      ││                       │            │
│          │  │           ││   我希望做一个对世界   │  + 加入具   │
│          │  │  v2 ● 3天前││   有正面影响的人...   │  体方向     │
│          │  │  Agent 润色 ││                       │  + 每周运   │
│          │  │           ││   ## 具体方向          │  动 3 次    │
│          │  │  v1 ● 1周前││   - 深度学习系统设计   │  - (旧内容  │
│          │  │  初始版本   ││   - 每周运动 3 次     │    被替换)  │
│          │  │           ││   ...                 │            │
│          │  └───────────┘│                       │            │
│          │               │                       │            │
│          │  [ ← 返回编辑 ]│                       │            │
└──────────┴───────────────┴───────────────────────┴────────────┘
```

### 6.3 Timeline Column

A vertical timeline on the left side of the main panel (width: ~200px).

```
  v3 ●──── 今天 14:30
  │        加入了具体方向和时间维度
  │        👤 用户
  │
  v2 ○──── 3天前
  │        Agent 润色通过
  │        🤖 Agent 辅助草稿
  │
  v1 ○──── 1周前
           初始版本
           👤 用户
```

**Component details**:
- Each node: circle (`w-3 h-3 rounded-full`) + horizontal line to content
- Selected version: `bg-accent` filled circle
- Other versions: `border-2 border-border bg-background` hollow circle
- Connector: `w-0.5 bg-border` vertical line
- Version number: `text-sm font-medium`
- Timestamp: `text-xs text-muted`
- Change note: `text-xs text-muted`, 1-line truncated
- Author icon: `👤` for user, `🤖` for agent draft

### 6.4 Version Content (Center)

Full rendered markdown of the selected version:
- `max-w-2xl` for reading comfort
- Read-only rendered blocks
- `bg-background` with generous padding

### 6.5 Diff Panel (Right Panel)

When a version other than v1 is selected, the right panel (w-72) shows the diff from the previous version:

```
┌────────────────────────────┐
│  v2 → v3 的变更             │  ← text-sm font-medium
│                            │
│  ────────────────────────  │
│                            │
│  + 加入了具体方向和时间维度  │  ← added lines: text-success bg-success/10
│  + ## 具体方向              │
│  + - 深度学习系统设计       │
│  + - 每周运动 3 次          │
│  + - 每月读 2 本书          │
│                            │
│  − 同时保持对生活的热爱。   │  ← removed lines: text-danger bg-danger/10
│                            │
│  ────────────────────────  │
│                            │
│  3 行新增 · 1 行删除       │  ← summary stats
│                            │
│  ────────────────────────  │
│                            │
│  [ 恢复此版本 ]            │  ← Button variant="secondary" size="sm"
└────────────────────────────┘
```

**Interactions**:
- Click a version in timeline → update center content + right panel diff
- `恢复此版本` → creates a new version (v_n+1) with the old version's body, changeNote: `"恢复至 v{n}"`
- For v1, right panel shows "这是最初版本" with no diff

---

## 7. Directive Panel

### 7.1 Concept

Directives are actionable commitments derived from a vision. They bridge the gap between aspiration (vision) and execution (tasks/projects).

### 7.2 Entry Point

- Vision Quick View (right panel) → `活跃指令 (N)` section → click to expand
- Vision Card actions → `管理指令`
- Vision Editor → right panel Agent Assistant → agent suggests directives inline

### 7.3 Layout — Directive Section in Right Panel

Directives appear as a collapsible section within the right panel when viewing a vision:

```
┌────────────────────────────┐
│  指令                  [+] │  ← Section header + add button
│                            │
│  ┌──────────────────────┐  │
│  │ ● Q2 技术深耕计划     │  │  ← active: left border accent
│  │   季度 · 活跃         │  │     Chip: scope + status
│  │   "深度学习系统设计,  │  │     body preview
│  │    每月输出 1 篇..."  │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │ ● 保持运动习惯       │  │
│  │   月度 · 活跃         │  │
│  │   "每周运动 3 次,     │  │
│  │    记录运动数据"      │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │ ○ 阅读计划 (草稿)    │  │  ← draft: dashed border, dimmed
│  │   月度 · 草稿         │  │
│  └──────────────────────┘  │
│                            │
└────────────────────────────┘
```

### 7.4 Agent Directive Suggestion

When the agent has a directive suggestion (via `suggestDirective()`), it appears as a special card:

```
┌────────────────────────────┐
│  🤖 Agent 建议新指令        │  ← bg-accent-soft rounded-lg
│                            │
│  "保持技术写作习惯"         │  ← proposedTitle, font-medium
│  每两周输出一篇技术博客，   │  ← proposedBody, text-sm
│  记录学习和实践心得。       │
│                            │
│  💡 reasoning:             │  ← text-xs text-muted, collapsible
│  基于你的"技术深耕"愿景... │
│                            │
│  置信度: ████████░░ 78%    │  ← confidence bar
│                            │
│  [ 采纳 ]  [ 编辑后采纳 ]  │
│  [ 忽略 ]                  │
└────────────────────────────┘
```

**Interactions**:
- `采纳` → `createDirectiveFromVision()` with `status: 'active'`
- `编辑后采纳` → opens inline editor to modify title/body before saving
- `忽略` → dismiss suggestion (with animation: slide up + fade out)

### 7.5 Directive Status Colors

| Status | Border | Chip color | Icon |
|--------|--------|------------|------|
| `active` | `border-l-3 border-accent` | `accent` | `●` filled |
| `draft` | `border-dashed border-border` | `default` | `○` hollow |
| `paused` | `border-l-3 border-warning` | `warning` | `⏸` |
| `archived` | none (dimmed) | `default` | `—` |

### 7.6 Empty State

```
┌────────────────────────────┐
│                            │
│  还没有指令                 │
│  指令帮助你把愿景拆解为    │
│  可执行的承诺。             │
│                            │
│  [ + 新建指令 ]            │
│  让 Agent 建议              │  ← text link
└────────────────────────────┘
```

---

## 8. Reminder Overlay

### 8.1 Design Philosophy

Reminders are **gentle, non-blocking, and contextual**. They appear within the user's current workflow, not as disruptive modals.

### 8.2 Reminder Card (Inline)

The primary reminder format is an **inline card** that slides into the current view from the top of the main content area:

```
┌──────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐  │
│  │  🧭 轻声提醒                      ✕   │  │  ← bg-accent-soft/50
│  │                                        │  │     border-l-3 border-accent
│  │  你的愿景"我的人生愿景"也许和这个      │  │     rounded-lg
│  │  决定相关。花一秒钟想想：这个选择      │  │     slide-down animation
│  │  是否与你的方向一致？                  │  │
│  │                                        │  │
│  │  [ 查看愿景 ]          稍后提醒        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ─── 正常内容继续 ─────────────────────────  │
```

**Trigger-specific messages**:

| Trigger | Title | Typical context |
|---------|-------|-----------------|
| `before_choice` | `🧭 做决定前想一想` | Creating/archiving a project |
| `on_create` | `🧭 新的开始` | Creating a new project or task |
| `on_review` | `🧭 回顾时刻` | Entering the Review section |
| `on_help` | `🧭 来自愿景的指引` | Asking agent for advice |

### 8.3 Behavior

- **Duration**: Auto-dismiss after 8 seconds unless user interacts
- **Animation**: `slideDown` 300ms ease-out on appear, `slideUp` 200ms ease-in on dismiss
- **Stacking**: Maximum 1 reminder visible at a time. New reminders queue.
- **Frequency cap**: Same trigger type won't fire again within 30 minutes
- **Dismiss**: Click `✕` or `稍后提醒`

### 8.4 Review Section Integration

During the Review view (`回顾`), the reminder appears as a **persistent section** (not auto-dismissing):

```
┌──────────────────────────────────────────────┐
│  📊 回顾                                     │
│                                              │
│  ┌─ 愿景回顾 ────────────────────────────┐  │
│  │  🧭 我的人生愿景 · 人生                │  │  ← Always visible in review
│  │                                        │  │
│  │  "我希望做一个对世界有正面影响的人——   │  │  ← summaryForAgent text
│  │  在技术领域持续深耕..."                │  │
│  │                                        │  │
│  │  上次确认: 3天前                       │  │
│  │                                        │  │
│  │  [ 仍然认同 ✓ ]    [ 需要修改 ]       │  │  ← Reaffirm actions
│  └────────────────────────────────────────┘  │
│                                              │
│  ─── 已完成任务 ──────────────────────────   │
│  ✓ 完成系统设计文档                          │
│  ✓ 代码审查 3 个 PR                          │
│  ...                                         │
└──────────────────────────────────────────────┘
```

**Interactions**:
- `仍然认同 ✓` → updates `Vision.lastReaffirmedAt` to now. Card shows `✓ 已确认` for 2 seconds, then collapses.
- `需要修改` → navigates to Vision Editor

### 8.5 Agent Chat Integration

When `on_help` trigger fires during an agent conversation, the reminder appears as a **system message** in the conversation stream:

```
┌─────────────────────────────────────────────┐
│  ┃  🧭 你的愿景"我的人生愿景"或许能帮到你。 │  ← SystemMessage style
│  ┃  "我希望做一个对世界有正面影响的人..."    │     border-l-2 border-accent
│  ┃                        [ 展开完整愿景 ]  │     (instead of border-default-300)
└─────────────────────────────────────────────┘
```

---

## 9. Privacy Controls

### 9.1 Entry Point

- Vision Editor header → privacy `Chip` (clickable)
- Vision Card actions → `隐私设置`
- Settings (global) → 愿景隐私默认值

### 9.2 Per-Vision Privacy Panel

Opens as an **inline popover** anchored to the privacy chip in the editor header:

```
                                   ┌──────────────────────────┐
                                   │  隐私设置                │
        🔒 仅本地 ▾ ──────────────→│                          │
                                   │  数据存储                │
                                   │  ┌──────────────────┐    │
                                   │  │ ● 仅本地         │    │  ← local_only
                                   │  │ ○ 同步摘要到云端  │    │  ← cloud_summary
                                   │  │ ○ 完整同步到云端  │    │  ← cloud_full
                                   │  └──────────────────┘    │
                                   │                          │
                                   │  Agent 访问权限          │
                                   │  ┌──────────────────┐    │
                                   │  │ ○ 不允许访问      │    │  ← none
                                   │  │ ● 仅摘要         │    │  ← summary_only
                                   │  │ ○ 完整内容       │    │  ← full
                                   │  └──────────────────┘    │
                                   │                          │
                                   │  ⓘ 当前设置:            │
                                   │  愿景内容仅存储在本机。  │
                                   │  Agent 可以看到摘要，    │  ← Dynamic description
                                   │  但看不到完整内容。      │     text-xs text-muted
                                   │                          │
                                   └──────────────────────────┘
```

### 9.3 Component Details

| Element | Component | Behavior |
|---------|-----------|----------|
| Container | Popover (custom) | `bg-surface border border-border rounded-xl shadow-lg p-4 w-64` |
| Section title | `text-xs font-medium text-muted uppercase` | `数据存储`, `Agent 访问权限` |
| Radio items | Custom radio cards | `px-3 py-2 rounded-lg border cursor-pointer` |
| Selected | `border-accent bg-accent-soft text-foreground` | Solid left border |
| Unselected | `border-border hover:bg-surface-secondary` | Standard border |
| Description | `text-xs text-muted` | Updates dynamically based on combination |

### 9.4 Privacy Descriptions (Dynamic)

| Visibility | Agent Access | Description |
|------------|-------------|-------------|
| `local_only` | `none` | 愿景完全保留在本机，Agent 无法访问。 |
| `local_only` | `summary_only` | 愿景存储在本机。Agent 仅能看到摘要。 |
| `local_only` | `full` | 愿景存储在本机。Agent 可以看到完整内容。 |
| `cloud_summary` | `summary_only` | 摘要同步到云端。Agent 仅能看到摘要。 |
| `cloud_full` | `full` | 完整内容同步到云端。Agent 可以看到所有内容。 |

### 9.5 Privacy Validation

Some combinations are illogical and should be blocked with a warning:

- `cloud_full` + `none` agent access → Warning: "完整同步到云端但 Agent 无法访问？建议至少允许摘要访问。"
- `local_only` + `full` cloud sync → Impossible; UI should disable `cloud_full` sync if `local_only` visibility is set

Warnings use `text-warning text-xs` inline text with `AlertTriangle` icon.

---

## 10. Agent Interaction

### 10.1 Strategy

Agent assistance for vision writing follows a **sidebar chat** pattern in the right panel, reusing `conversation-ui` components. This keeps the agent co-present but non-intrusive.

### 10.2 Right Panel — Agent Assistant

When in the Vision Editor, the right panel (w-72) transforms into a focused agent assistant:

```
┌────────────────────────────┐
│  🤖 愿景助手          [···]│  ← Header with context menu
│                            │
│  ────────────────────────  │
│                            │
│  ┃  我已经读取了你的愿景。 │  ← AssistantTextMessage (compact)
│  ┃  有什么需要帮助的？    │
│                            │
│  ────── 快捷操作 ────────  │  ← Section divider
│                            │
│  [ 帮我润色 ]              │  ← Button variant="secondary" size="sm"
│  [ 给我建议 ]              │     fullWidth, stacked
│  [ 建议一个指令 ]          │
│  [ 翻译成英文 ]            │
│                            │
│  ────────────────────────  │
│                            │
│      💬 你好，我想...      │  ← User message (right-aligned, compact)
│                            │
│  ┃  根据你的愿景，我建议   │  ← Assistant response
│  ┃  可以考虑以下几点：     │
│  ┃  1. 明确时间维度        │
│  ┃  2. 加入可衡量的目标    │
│  ┃  ...                   │
│  ┃                        │
│  ┃  [ 应用到愿景 ↗ ]      │  ← Action: insert into editor
│                            │
│  ┌────────────────────┐    │
│  │ 问问 Agent...      │ ↑  │  ← PromptInput (compact)
│  └────────────────────┘    │
└────────────────────────────┘
```

### 10.3 Agent Context

The agent receives vision context via `buildAgentVisionContext()`:
- **System prompt**: `systemPromptPrinciples` — guides agent behavior
- **Memory context**: `memoryContextSummary` — current version summary
- **Full history**: `reviewFullText` — available on demand

### 10.4 Quick Actions

Pre-built prompts that the user can trigger with one click:

| Action | Agent Prompt (internal) | UI Label |
|--------|------------------------|----------|
| Polish | "请润色并改善这段愿景文本的表达，保持原意。" | `帮我润色` |
| Suggest | "基于当前愿景，给出 3 个改进建议。" | `给我建议` |
| Directive | Calls `suggestDirective()` | `建议一个指令` |
| Translate | "将此愿景翻译成英文，保持语气。" | `翻译成英文` |

### 10.5 "Apply to Vision" Flow

When agent generates a suggestion, a special `[ 应用到愿景 ↗ ]` button appears:

1. User clicks `应用到愿景`
2. Editor receives the agent's suggested text
3. A **diff preview** appears inline in the editor (similar to Step 3 of onboarding):
   - Removed text highlighted in `bg-danger/10`
   - Added text highlighted in `bg-success/10`
4. Two floating buttons appear at bottom of editor: `[ 接受 ✓ ]` `[ 撤销 ✕ ]`
5. `接受` commits the change; `撤销` restores original text

### 10.6 Agent in Other Contexts

Outside the Vision Editor, the agent references the vision through:
- **System prompt injection** — always present if vision is active and `agentAccessLevel !== 'none'`
- **Reminder messages** — triggered by `shouldRemind()` (Section 8)
- **Agent Hub chat** — user can say "看看我的愿景" and agent responds with `memoryContextSummary`

---

## 11. Mobile Considerations

### 11.1 Layout Adaptation

On screens < 768px, the 3-panel layout collapses:

```
DESKTOP (≥1024px)              TABLET (768-1023px)           MOBILE (<768px)
┌────┬──────────┬────┐        ┌────┬──────────────┐         ┌──────────────┐
│ SB │  Main    │ RP │        │ SB │    Main      │         │    Main      │
│ 60 │  flex-1  │ 72 │        │ 48 │    flex-1    │         │    100%      │
└────┴──────────┴────┘        └────┴──────────────┘         └──────────────┘
                               Right panel → bottom sheet    Sidebar → hamburger menu
                                                             Right panel → bottom sheet
```

### 11.2 Mobile-Specific Patterns

| Component | Mobile behavior |
|-----------|----------------|
| **Sidebar** | Hidden behind hamburger menu (top-left). Slides in as overlay (`fixed inset-y-0 left-0 w-60 z-50 bg-surface`). |
| **Right panel** | Converts to a **bottom sheet** that slides up from below (`fixed bottom-0 left-0 right-0 max-h-[70vh] rounded-t-xl`). Has a drag handle for resize. |
| **Vision Dashboard** | Cards stack vertically, full width. No right panel preview — tap card to navigate. |
| **Vision Editor** | Full-screen editor. Agent assistant accessible via floating `🤖` button (bottom-right) that opens bottom sheet. |
| **Onboarding** | Same centered layout, `max-w-full px-4`. Step indicator shrinks to dots only. |
| **Privacy popover** | Converts to bottom sheet instead of popover. |
| **Reminder card** | Slides down from top as before, full width with `mx-4` margin. |
| **Version History** | Timeline becomes horizontal scroll at top; content below full width; diff in bottom sheet. |

### 11.3 Touch Considerations

- All tap targets ≥ 44px height (iOS HIG / Material 3)
- Swipe gestures: swipe left on Vision Card → archive action
- Long press on Vision Card → context menu (same as `···` dropdown)
- Editor has larger touch targets for block selection

---

## 12. Component Inventory

### 12.1 New Components to Build

| Component | Type | Location | Description |
|-----------|------|----------|-------------|
| `VisionNav` | Sidebar item | `feature-vision-ui` | Sidebar navigation entry with badge |
| `OnboardingOverlay` | Full-panel | `feature-vision-ui` | 6-step wizard container |
| `StepIndicator` | Progress | `feature-vision-ui` | Horizontal dot progress bar |
| `OnboardingStep` | Step content | `feature-vision-ui` | Per-step content renderer (6 variants) |
| `VisionDashboard` | Page | `feature-vision-ui` | Main panel list view |
| `VisionCard` | Card | `feature-vision-ui` | Vision list item |
| `VisionQuickView` | Right panel | `feature-vision-ui` | Condensed vision preview |
| `VisionEditor` | Page | `feature-vision-ui` | Full editor view |
| `VersionTimeline` | Timeline | `feature-vision-ui` | Version history sidebar |
| `VersionDiffView` | Diff | `feature-vision-ui` | Side-by-side or inline diff |
| `DirectiveSection` | Panel section | `feature-vision-ui` | Directive list in right panel |
| `DirectiveSuggestionCard` | Card | `feature-vision-ui` | Agent-suggested directive |
| `ReminderCard` | Overlay | `feature-vision-ui` | Inline reminder notification |
| `ReviewVisionBlock` | Card | `feature-vision-ui` | Vision section in Review view |
| `PrivacyPopover` | Popover | `feature-vision-ui` | Per-vision privacy settings |
| `VisionAgentAssistant` | Right panel | `feature-vision-ui` | Agent chat sidebar for vision |
| `ScopeSelector` | Chip group | `feature-vision-ui` | Life/Career/Theme radio chips |
| `ReminderModeSelector` | Radio group | `feature-vision-ui` | 4-option reminder mode picker |
| `ChangeNoteInput` | Inline form | `feature-vision-ui` | Version save note input |

### 12.2 Reused HeroUI Components

| Component | Usage in Vision |
|-----------|----------------|
| `Button` | All CTAs (primary, secondary, ghost variants) |
| `Card` | Vision cards, directive cards, reminder cards, agent suggestion |
| `Chip` | Scope, version, status, privacy, reminder mode badges |
| `Tabs` | Dashboard (活跃/已归档), right panel context switching |
| `Separator` | Section dividers throughout |
| `Input` | Vision title, change note, search |
| `Switch` | (reserved for future settings toggles) |
| `Spinner` | Agent loading states |

### 12.3 Reused Lucide Icons

| Icon | Usage |
|------|-------|
| `Compass` | Vision nav item, reminder card header |
| `Plus` | Create vision, create directive |
| `ChevronLeft` | Back navigation |
| `MoreHorizontal` | Actions dropdown |
| `Lock` | Privacy: local_only |
| `Cloud` | Privacy: cloud_full |
| `CloudUpload` | Privacy: cloud_summary |
| `Eye` / `EyeOff` | Agent access level |
| `AlertTriangle` | Validation warnings |
| `Check` | Auto-save indicator, confirmation |
| `Sparkles` | Onboarding completion |
| `History` | Version history |
| `Bot` | Agent assistant header |
| `ArrowUpRight` | "Apply to vision" action |
| `RefreshCw` | Regenerate agent suggestion |

### 12.4 Reused Packages

| Package | Usage |
|---------|-------|
| `@orbit/editor-dom` | Block editor for vision writing (Step 2, Editor view) |
| `@orbit/conversation-ui` | Agent assistant in right panel (MessageRow, PromptInput) |
| `@orbit/ui-tokens` | All semantic color tokens |
| `@orbit/ui-dom` | Theme management |
| `@orbit/feature-vision` | All business logic (onboarding, repository, versions, privacy, reminders, directives) |

---

## Appendix A: State Flow Diagram

```
                    ┌─────────────────┐
                    │  First visit?   │
                    └────────┬────────┘
                       yes   │   no
                    ┌────────┴────────┐
                    ▼                 ▼
            ┌───────────┐     ┌─────────────┐
            │ Onboarding│     │  Dashboard  │
            │  (6 steps)│     │  (list)     │
            └─────┬─────┘     └──────┬──────┘
                  │                  │
                  │  complete         │  click card
                  ▼                  ▼
            ┌─────────────┐   ┌─────────────┐
            │  Dashboard  │◄──│  Quick View  │  (right panel)
            │  (list)     │   │  (preview)   │
            └──────┬──────┘   └──────────────┘
                   │
          ┌────────┼──────────┐
          │        │          │
          ▼        ▼          ▼
    ┌──────────┐ ┌────────┐ ┌───────────┐
    │  Editor  │ │ Version│ │ Directive │
    │  (write) │ │ History│ │  Panel    │
    └────┬─────┘ └────────┘ └───────────┘
         │
         │  (right panel)
         ▼
    ┌──────────┐
    │  Agent   │
    │ Assistant│
    └──────────┘
```

## Appendix B: Data Dependencies per View

| View | Repository calls | Feature functions |
|------|-----------------|-------------------|
| **Sidebar badge** | `VisionRepository.list(userId)` → count active | — |
| **Dashboard** | `VisionRepository.list(userId)` | — |
| **Quick View** | `VisionRepository.getById(id)`, `VisionVersionRepository.getLatest(id)`, `DirectiveService.listByVision(id)` | `getEffectivePrivacy()` |
| **Editor** | `VisionRepository.getById(id)`, `VisionVersionRepository.getLatest(id)` | `filterForAgent()`, `buildAgentVisionContext()` |
| **Version History** | `VisionVersionRepository.getByVisionId(id)` | `getVersionHistory()`, `diffVersions()` |
| **Directive Panel** | `DirectiveService.listByVision(id)`, `DirectiveService.listActive(userId)` | `suggestDirective()`, `createDirectiveFromVision()` |
| **Reminder** | `VisionRepository.getById(id)` | `shouldRemind()`, `generateReminder()` |
| **Privacy** | `VisionRepository.getById(id)` | `getEffectivePrivacy()`, `filterForSync()`, `filterForAgent()` |
| **Onboarding** | — (creates on completion) | `createOnboardingSession()`, `advanceStep()`, `canAdvance()`, `completeOnboarding()` |
| **Agent Assistant** | `VisionVersionRepository.getByVisionId(id)` | `buildAgentVisionContext()` |

---

*End of design specification.*
