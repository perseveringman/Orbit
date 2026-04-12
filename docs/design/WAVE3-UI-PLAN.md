# Wave 3 UI 总体规划

> 本文件汇总四份独立 UI 设计文档，给出全局导航结构、共享设计语言与实施路线。
> 详细视图规格请查阅 `docs/design/` 下的模块设计文档。

---

## 一、设计文档索引

| 模块 | 文档 | 行数 | 核心视图 |
|------|------|------|---------|
| W3-A 愿景写入 | [`design-vision-writing-ui.md`](./design-vision-writing-ui.md) | 1311 | Onboarding 向导、Vision 编辑器、版本时间线、Directive 面板 |
| W3-B 全源阅读 | [`design-fullsource-reader.md`](./design-fullsource-reader.md) | 1264 | 文章库、统一 Reader、翻译/转写、订阅管理 |
| W3-C Journal | [`journal-ui-design.md`](./journal-ui-design.md) | 1006 | 五层日视图、时间线、AI 摘要、行为洞察 |
| W3-D 任务管理 | [`task-management-core-ui.md`](./task-management-core-ui.md) | 1431 | Today 计划、Focus 模式、Review 三层、项目/里程碑 |

---

## 二、全局导航结构

现有侧边栏需要扩展为分组结构：

```
┌──────────────────────────┐
│  🔭  Orbit               │
├──────────────────────────┤
│  ── 方向 ──               │
│  🧭  愿景    Vision       │  ← W3-A (新增)
│                          │
│  ── 输入 ──               │
│  📖  阅读    Library      │  ← W3-B (新增)
│  📓  日志    Journal      │  ← W3-C (新增)
│                          │
│  ── 执行 ──               │
│  📅  今天    Today        │  ← W3-D (增强)
│  🎯  专注    Focus        │  ← W3-D (增强)
│  📊  复盘    Review       │  ← W3-D (增强)
│  📁  项目    Projects     │  ← W3-D (增强)
│  ✅  任务    Tasks        │  ← W3-D (增强)
│                          │
│  ── 系统 ──               │
│  ⚙️  设置    Settings     │
└──────────────────────────┘
```

**设计原则**：
- 分组用小标题（`text-xs text-muted uppercase tracking-wider`）
- 每个条目：Lucide 图标 + 标签 + 可选 Badge（未读数/今日数）
- 活跃项高亮：`bg-surface-secondary` + `text-foreground` + 左侧 2px accent 条

### 图标映射

| 导航项 | Lucide 图标 | 说明 |
|-------|------------|------|
| 愿景 | `Compass` | 方向与愿景 |
| 阅读 | `BookOpen` | 阅读库 |
| 日志 | `BookText` | 每日日志 |
| 今天 | `Calendar` | 今日计划 |
| 专注 | `Crosshair` | 深度专注 |
| 复盘 | `BarChart3` | 回顾反思 |
| 项目 | `FolderOpen` | 项目管理 |
| 任务 | `ClipboardList` | 任务列表 |

---

## 三、三面板布局适配

所有 Wave 3 视图复用现有 3-panel 架构：

```
┌─────────┬──────────────────────┬─────────────┐
│ Sidebar │    Main Content      │ Right Panel  │
│  w-60   │    flex-1            │   w-72       │
│         │                      │              │
│ 导航    │  视图主体             │ 上下文/详情   │
│ 分组    │  max-w-3xl mx-auto   │ 属性/关联    │
│         │  overflow-y-auto     │ Agent 助手   │
└─────────┴──────────────────────┴─────────────┘
```

### 各模块面板使用

| 模块 | Main Panel | Right Panel |
|------|-----------|-------------|
| 愿景 | Vision 列表 / 编辑器 / Onboarding 向导 | 版本历史 / Directive / Agent 助手 |
| 阅读 | 文章库列表 / Reader 正文 | 文章预览 / 批注 / 大纲 / 相关内容 |
| 日志 | Journal 日视图（5层） | 日历导航 / 周月概览 / 隐私控制 |
| 任务 | Today 计划 / 任务列表 / 项目详情 | 任务详情 / 材料链接 / 事件历史 |
| 专注 | 单任务沉浸视图（sidebar 折叠） | 目标/里程碑 / 材料 / 输出目标 |
| 复盘 | 日/周/项目 Review 表单 | Agent 引导问答 / 洞察 |

---

## 四、共享设计语言

### 4.1 状态色彩系统

| 语义 | Chip variant | 用途 |
|------|-------------|------|
| `success` | `color="success"` | done, active, ready, extracted |
| `warning` | `color="warning"` | blocked, paused, clarifying, fetching |
| `danger` | `color="danger"` | dropped, error, failed, expired |
| `accent` | `color="accent"` | focused, scheduled, reading |
| `default` | `color="default"` | captured, draft, discovered, archived |

### 4.2 隐私等级指示

| 级别 | 图标 | 颜色 | 行为 |
|------|------|------|------|
| `normal` | 无 | — | 默认，不显示标记 |
| `sensitive` | `Shield` | `text-warning` | 黄色盾牌，Agent 仅可见摘要 |
| `sealed` | `Lock` | `text-danger` | 红色锁，内容模糊化，需逐次授权 |

### 4.3 Agent 交互模式

所有模块中 Agent 交互采用统一模式：
1. **右面板 Agent 助手**：使用 `conversation-ui` 组件，上下文感知
2. **内联建议卡**：Agent 建议以 Card 形式出现在主内容中，带"采纳/拒绝"按钮
3. **温和提醒**：slide-down 通知卡（8秒自动消失），不打断工作流
4. **确认门**：Modal dialog，明确展示影响范围和 Agent 推理过程

### 4.4 空状态设计

每个视图提供引导性空状态：
- 插图 + 标题 + 一句说明 + 主操作按钮
- 例：阅读库空状态 → "还没有订阅源" + "添加第一个 RSS 源" 按钮

### 4.5 移动端适配

- `< 768px`：sidebar 折叠为 hamburger，三面板变单列
- `768px - 1024px`：右面板变为底部抽屉 (bottom sheet)
- `> 1024px`：完整三面板布局

---

## 五、新增组件清单

### 5.1 共享组件（跨模块复用）

| 组件 | 用途 | 基于 |
|------|------|------|
| `SectionHeader` | 侧边栏分组标题 | Tailwind text |
| `NavItem` | 侧边栏导航条目 | Button ghost + Badge |
| `PrivacyChip` | 隐私等级指示器 | Chip + Lucide Lock/Shield |
| `AgentSuggestionCard` | Agent 建议卡（采纳/拒绝） | Card + Button |
| `ReminderBanner` | 温和提醒条 | Card + auto-dismiss |
| `ConfirmationModal` | 确认门对话框 | Modal + danger/warning variant |
| `EmptyState` | 通用空状态 | flex-col + icon + text + Button |
| `StatusChip` | 通用状态标签 | Chip + color mapping |
| `TimelineItem` | 时间线条目 | flex + icon + content |

### 5.2 各模块专属组件

**愿景 (19 组件)**: OnboardingWizard, VisionCard, VisionEditor, VersionTimeline, VersionDiff, DirectivePanel, DirectiveSuggestionCard, ReminderSlideDown, PrivacyPopover, AgentVisionChat...

**阅读 (15+ 组件)**: LibraryList, LibraryFilterBar, SubscriptionDialog, ReaderView, HighlightFloatingMenu, AnnotationForm, BilingualParagraph, TranscriptTimeline, PipelineStatusChip, ReadingExitMenu...

**日志 (17 组件)**: JournalDayView, DateHeader, DayNoteEditor, TimelineGroup, TimelineRow, SummaryCard, InsightCard, CalendarMini, WeekStrip, ProtectedSessionBanner, SealedAccessDialog...

**任务 (20+ 组件)**: TaskListGrouped, TaskKanbanBoard, QuickCaptureInput, IntentParsePreview, TaskDetailPanel, StatusTransitionDropdown, TodayPlanCard, NextThingHero, FocusSessionView, FocusEndModal, ReviewForm, MilestoneTimeline, ProjectProgressBar, SupportLinksPanel...

---

## 六、数据流架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  feature-*      │     │  app-viewmodels   │     │  React UI   │
│  (业务逻辑)      │────▶│  (ViewModel 层)   │────▶│  (组件渲染)  │
│                 │     │                  │     │             │
│ feature-vision  │     │ VisionListVM     │     │ VisionCard  │
│ feature-reader  │     │ ReaderVM         │     │ ReaderView  │
│ feature-journal │     │ JournalDayVM     │     │ DayView     │
│ feature-task    │     │ TodayPlanVM      │     │ TodayCard   │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

**约定**：
- `feature-*` 包提供纯逻辑（无 React 依赖）
- `app-viewmodels` 将逻辑转换为 UI 友好的 ViewModel
- React 组件只负责渲染和事件绑定
- Agent 交互通过 `conversation-ui` + `agent-core` event bus

---

## 七、实施路线建议

### Phase 1：导航骨架 + 空状态
- 扩展侧边栏为分组导航（方向/输入/执行/系统）
- 为每个新增页面创建空状态占位
- 建立共享组件库（StatusChip, PrivacyChip, EmptyState 等）

### Phase 2：任务管理增强（优先级最高）
- Today/Focus/Review 已有入口，接入 feature-task 逻辑
- Quick Capture + Intent Parser
- Task Detail 右面板

### Phase 3：Journal
- Journal 日视图（5层）
- Day Note 编辑器（editor-dom 集成）
- 时间线可视化

### Phase 4：阅读系统
- 文章库 + 订阅管理
- 统一 Reader 视图
- 高亮 + 翻译层

### Phase 5：愿景系统
- Onboarding 向导
- Vision 编辑器 + 版本历史
- Directive 面板 + Agent 助手

### Phase 6：Agent 集成贯通
- 所有模块接入 Agent 右面板助手
- 温和提醒系统
- 确认门统一处理

---

## 八、技术约束

- **UI 框架**: HeroUI v3 + Tailwind CSS v4 + React 19
- **图标**: Lucide React（已全面迁移）
- **编辑器**: @orbit/editor-dom（block editor + markdown）
- **对话**: @orbit/conversation-ui（Agent 消息渲染）
- **主题**: light/dark via `data-theme` + oklch 变量
- **国际化**: zh-CN 为主，预留 i18n key
- **无路由**: 保持 useState 导航（后续可升级 react-router）

---

*生成时间：2026-04-11 | 四份设计文档共 5,012 行*
