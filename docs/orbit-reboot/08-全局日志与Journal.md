# 08. 全局日志与 Journal

## 1. 设计定位

Orbit 的全局日志系统不是埋在底层的“行为埋点”，也不是一个只服务产品分析的 telemetry 管道，而是整个 Agent-first 应用的**事实时间层**：它把用户在 Orbit 内发生的关键动作、对象变化、关系建立、回顾判断与少量受控的外部上下文，持续编织成“今天发生了什么”的可回放时间面。

Journal 则是这套时间层面向用户的主界面。Today 回答“今天做什么”，Project 回答“为什么做”，Research 回答“围绕什么问题思考”，而 Journal 回答的是：**今天实际上发生了什么、它与哪些对象有关、这些事实如何进入回顾与下一轮决策。**

本专题采用五条硬原则：

1. **先存事实，再生解释。** 原始真相是 event，不是 insight。任何总结、标签、行为画像都只能是派生层。
2. **全局记录，但不无限采集。** 记录 Orbit 内“有语义的操作事实”，不记录逐键盘输入、任意屏幕内容、未授权的系统活动。
3. **用户可见优先。** 只要某条记录会被 Agent 用于理解用户，就必须有对应的用户可见层、来源说明、删除与导出路径。
4. **隐私分级先于智能利用。** Journal、Agent、同步、导出读取的不是同一份无限明文，而是受隐私级别、场景权限、用户模式约束的不同视图。
5. **日志服务闭环，不服务审计感。** Orbit 用日志支撑回顾、上下文恢复、对象关联和温和建议，明确拒绝“人格评分”“愿景对齐率”“行为考核板”。

因此，08 的核心不是做一条漂亮时间轴，而是定义一套可执行的分层：**event → action log → day note → journal summary → behavior insight**，并把 retention、export、privacy control、Agent 读取权限一起落到 schema 与能力边界上。

## 2. 关键用户场景

### 2.1 用户想回看“今天到底做了什么”

用户一天里可能读了 6 篇文章、做了 14 条高亮、推进了 2 个任务、开启了 1 次研究会话、写了半篇文档、和 Agent 进行了 3 次关键讨论。Journal 不能把这些动作都摊平成噪音明细，也不能只给一句空洞总结；它需要在同一天视角下同时给出：

- 用户手写的日记/手记；
- 关键行动的时间线；
- 涉及的项目、研究、文档、阅读对象；
- 自动生成但可追溯的日摘要；
- 值得进入周回顾的变化信号。

### 2.2 用户在多模块间工作，希望系统保留工作链

用户上午在 04 阅读里转写播客、午后在 05 研究里生成对比矩阵、晚上在 07 写作里把一条研究结论写成段落。日志系统需要把这些跨模块动作压成一条可回放工作链，而不是三个互相不通的模块历史。用户打开 Journal 时，应能顺着时间看见：输入如何变成思考、思考如何变成行动、行动如何变成输出。

### 2.3 Agent 需要逐渐理解用户，但不能越界观察

用户长期使用后，Agent 应该知道：哪些项目最近持续推进、哪些输入常被转成行动、哪些时段适合深度工作、哪些研究主题反复出现。但这种理解必须建立在**Orbit 内部已经发生且用户能看见的事实**之上，而不是偷偷读取键盘、系统剪贴板、任意 App 内容或生成隐蔽人格档案。用户必须能回答：Agent 为什么知道这点、依据了哪些记录、如何关闭或清除。

### 2.4 用户开启隐私模式，仍希望保留最小回顾能力

有时用户在 Journal 写私人内容，或在某个项目下处理敏感主题。此时系统要允许三种不同级别的降噪：

- 完全不记录内容，只保留“发生过一次受保护会话”；
- 记录对象和时长，但不记录标题、正文、选中文本；
- 记录完整事实，但禁止 Agent 与云端读取。

这样 Journal 既不会因为隐私模式而彻底失明，也不会为了回顾便利牺牲数据边界。

### 2.5 用户要求导出、删除或纠正系统对自己的理解

用户可以导出某一天/某周的 Journal、原始事件、行动日志、摘要与洞察；也可以删除一段时间的行为记录、清空某个敏感会话、撤销某条 behavior insight，或把“这不是我的长期偏好”标记为不再使用。日志系统因此必须同时支持：原始事实导出、用户可读导出、派生洞察导出，以及红线级的删除与失效传播机制。

## 3. 核心设计

### 3.1 五层日志模型：event / action log / day note / journal summary / behavior insight

Orbit 的日志体系按“事实密度”和“解释密度”分为五层：

| 层级 | 对象 | 角色 | 是否事实真相 | 谁可写 | 典型保留策略 |
|---|---|---|---|---|---|
| L1 | `event` | 最小不可约事实 | 是 | user / agent / system | 默认长期保留，本地可删、同步传播删除 |
| L2 | `action_log` | 面向 Journal 的可读操作块 | 由 L1 物化 | system | 可重建，默认长期保留 |
| L3 | `day_note` | 用户对当天的手写记录 | 是（用户内容） | user | 默认长期保留 |
| L4 | `journal_summary` | 某天/某周/某月的回顾摘要 | 否，属于派生快照 | agent / system / user_edit | 可重生成，默认保留，允许清空重算 |
| L5 | `behavior_insight` | 有证据的模式洞察 | 否，属于可过期解释 | agent / user_confirm | 短中期保留，默认过期 |

五层的关系如下：

- `event` 回答“发生了什么”；
- `action_log` 回答“Journal 应该怎么展示今天的动作块”；
- `day_note` 回答“用户自己怎么描述这一天”；
- `journal_summary` 回答“这一天/这段时间可以如何压缩理解”；
- `behavior_insight` 回答“从一段时间内可见事实中，暂时能得到什么模式假说”。

设计裁决：**只有 L1/L3 是事实层；L2/L4/L5 都必须可回链到来源，且允许删除、重建、失效。** 这延续了《第一性原理：Agent 任务管理的本质与最小数据结构》的结论——系统长期保存原始事实，解释只作为受控快照，不作为不可推翻真相。

### 3.2 应用级操作日志：几乎所有动作如何记录，但不记录什么

Orbit 需要记录“几乎所有有语义的应用内动作”，但不是“所有像素级交互”。具体边界如下：

#### 必须记录的应用内动作

1. **对象生命周期**：创建、编辑、完成、归档、删除、恢复。  
   例：创建 task、保存 note、完成 project milestone、归档 research artifact。
2. **关系变化**：建立、接受、拒绝、移除链接。  
   例：文章关联到项目、AI 建议链接被拒绝。
3. **阅读与输入动作**：保存内容、打开阅读、完成转写/翻译、创建高亮、生成摘录、路由到研究/任务/写作。  
4. **研究与写作动作**：创建 research session、生成 artifact、接受大纲、生成章节草稿、发布导出。  
5. **执行与回顾动作**：进入 Focus、完成任务、调整 Today、确认 review、接受/拒绝 Agent 建议。  
6. **Journal 动作**：写 day note、确认 summary、隐藏条目、切换隐私模式、删除某天记录。  
7. **受控外部上下文**：仅在用户开启相关能力时，记录外部网页/应用的最小工作上下文，例如域名、标题、时长、与哪个 Orbit 对象相关。

#### 明确不记录的内容

- 逐键盘输入与每次光标移动；
- 未保存的正文草稿原文快照；
- 任意系统 App 的全量屏幕内容；
- 剪贴板历史、密码、恢复短语、密钥材料；
- 未经用户授权的外部网页正文、聊天记录或文件内容；
- “推测性心理标签”“情绪诊断”“人格评分”等没有明确事实依据的隐式画像。

因此，“几乎所有动作都记录”在 Orbit 的准确定义是：**记录所有会改变对象、关系、状态、工作链或回顾价值的语义动作；不记录纯机械交互噪音与越界私域内容。**

### 3.3 日志分级：用户日志、敏感日志、技术诊断日志分离

为避免把 Journal、Agent 记忆和工程遥测混成一团，日志分为三条平行管线：

| 管线 | 作用 | 是否进入 Journal | 是否可给 Agent | 是否可出云 |
|---|---|---|---|---|
| **用户行为日志** | event / action_log / day_note / summary / insight | 是 | 受权限控制 | 默认仅同步到用户工作区 |
| **安全审计日志** | 权限变更、导出、删除、设备配对、外部出境 | 部分可见 | 仅在安全/合规 Agent 场景 | 可同步但必须脱敏 |
| **技术诊断日志** | 崩溃、耗时、错误码、队列状态 | 否 | 否 | 可选上传、绝不含正文 |

Journal 只消费第一条；11 中定义的诊断与运营日志不应反向污染用户画像。这样用户看到的“日志”始终是与自己工作相关的事实层，而不是工程系统偷拿来的遥测副产品。

### 3.4 Journal 页面：如何展示“今天发生了什么”

Journal 页面不是单列时间轴，而是一个**日视角事实工作台**，包含五个区域：

1. **日期头部与模式条**  
   展示当前日期、当天记录模式（正常 / 受保护 / 手动记录）、快速导出、快速删除、隐私切换入口。
2. **Day Note 区**  
   当天顶部是一条 `day_note`，本质是 `note_kind='journal'` 的用户对象。它允许自由书写、@对象、插入引用块、反思今天最重要的事。
3. **Action Timeline 区**  
   以 `action_log` 为单位展示可折叠时间块，而不是直接暴露所有 event。一个时间块可由多个 event 聚合而成，例如“阅读 3 篇关于 Agent memory 的文章”“在写作工作台推进《Orbit 架构文》42 分钟”。
4. **Summary & Object Strip 区**  
   展示当天涉及的项目、研究空间、阅读对象、写作产物、任务完成、关系建立，以及一段 `journal_summary`。每个摘要句都可展开“基于哪些 action log 得出”。
5. **Insight & Review Hook 区**  
   只展示低频、高价值的 `behavior_insight`，例如“过去 7 天里，你的研究结论更容易在当天转成写作草稿，而阅读高亮更常在两天后才转成任务”。Insight 必须带证据入口和“不要再用此类判断”的关闭动作。

“今天发生了什么”的答案因此由三层共同构成：

- **今天做了什么**：Action Timeline；
- **今天自己怎么理解**：Day Note；
- **今天系统怎样压缩事实**：Journal Summary；
- **今天可能意味着什么**：Behavior Insight（可选、低频、可关闭）。

### 3.5 Action log 不是 event 列表，而是可解释聚合层

为了避免 Journal 变成事件瀑布流，`action_log` 作为一层稳定物化视图存在。它的聚合规则：

1. **同对象、同语义、短时间内连续发生的 event 自动折叠**；
2. **保留开始/结束时间、主对象、次对象、时长、来源 event_ids**；
3. **标题面向用户语言，而不是数据库事件名**；
4. **敏感内容默认打码，只在用户主动展开且权限允许时显示细节**；
5. **每条 action_log 必须可回答“为什么这样聚合”**。

例如：

- `event: article.opened + highlight.created × 4 + note.created(annotation)`  
  → `action_log: 在《Hermes Agent 架构》里做了 4 条高亮并写了 1 条边注`
- `event: task.focus_started + document.updated + task.completed`  
  → `action_log: 完成了任务「撰写 Journal 架构文档」并产出文档更新`

这保证 Journal 的主视图是“可读工作流”，而真正的原子事实仍保留在 L1。

### 3.6 Behavior insight：让 Agent 理解用户，但不把推断伪装成真相

Behavior insight 是最容易越界的一层，因此必须被严格限制：

1. **只从可见事实中生成**：来源只能是 event / action_log / day_note / summary，不得引入未授权外部数据。
2. **只生成工作相关模式**：时间分配、输入→输出转化、项目推进节奏、研究/写作流动、常见阻塞类型。
3. **不生成心理诊断和价值判断**：禁止“你缺乏自律”“你是拖延型人格”之类标签。
4. **必须带证据和样本门槛**：至少要有时间范围、样本量、来源对象和置信度。
5. **默认可过期**：insight 是“当前最好解释”，不是长期画像主表。
6. **可被用户驳回或静音**：被驳回的 insight 不应短期内原样复活。

Orbit 对“Agent 逐渐理解用户”的定义不是建立一张秘密画像表，而是：**在用户可见、可导出、可删除、可纠错的日志层上，逐渐形成一组工作习惯的受控洞察缓存。**

### 3.7 retention / export / privacy controls 的组合方式

#### Retention（保留策略）

建议默认策略如下：

| 数据层 | 默认保留 | 原因 |
|---|---|---|
| `event`（核心语义事件） | 长期保留，本地优先 | 是工作事实与可回放真相 |
| `event`（高频交互 crumb） | 7-30 天，本地-only | 仅用于近期上下文压缩，不值得永久保存 |
| `action_log` | 长期保留，可重建 | 是 Journal 主视图 |
| `day_note` | 长期保留 | 是用户内容 |
| `journal_summary` | 长期保留但可重算 | 兼具回顾价值与缓存属性 |
| `behavior_insight` | 30-90 天自动过期，重要项可 pin | 防止画像僵化 |
| 技术诊断日志 | 7-30 天，脱敏 | 仅用于排错 |

高频 crumb 指的是如“打开某面板”“切换某标签页”这类不应长期沉淀为个人工作史的微交互。Orbit 只将它们短期用于 session 压缩或 action log 聚合，不将其升级为长期用户画像。

#### Export（导出权）

Journal 相关导出至少支持三档：

1. **用户可读导出**：按日期导出 day note、timeline、summary、对象链接与统计。  
2. **真相层导出**：导出原始 event、action_log、summary 溯源、insight evidence，格式为 JSON/JSONL/SQLite。  
3. **隐私审计导出**：导出哪些日志被记录、哪些模式被启用、哪些外部提供商读取过哪些范围的数据。

导出必须允许选择：

- 时间范围；
- 数据层级；
- 是否包含敏感正文；
- 是否包含 AI 洞察；
- 是否只导出本地事实、不导出云端安全记录。

#### Privacy controls（隐私控制）

Orbit 需要四级用户控制：

1. **全局记录模式**：标准记录 / 手动优先 / 受保护模式。  
2. **对象级可见性**：某个 note、journal、document、research space 可标记为 `normal | sensitive | sealed`。  
3. **Agent 读取策略**：`deny | summary_only | full_local_only`。  
4. **同步与出境策略**：允许本地-only、允许跨端同步、禁止外部模型读取、每次出境前确认。

这四级控制共同决定：某条日志是否被写入、如何展示、能否被 Agent 看见、能否被同步或导出。

## 4. Agent 行为与自动化机制

### 4.1 Agent 的默认读取顺序与权限边界

Agent 不是默认拥有 Journal 明文总览。建议按以下顺序读取：

1. **优先读取 `journal_summary` 与 `action_log`**：用于回答“最近发生了什么”“本周推进如何”。
2. **按需读取 `day_note`**：仅在用户请求回顾、反思、提炼观点，且该 day note 允许 Agent 访问时。
3. **最末才读取 `event`**：仅在需要精确重建链路、调试对象演化、解释某条 summary 来源时。
4. **默认不读取 `sealed` 记录**：受保护会话与密封对象除非用户逐次授权，否则任何 Agent 都不可见。
5. **绝不读取技术诊断日志正文**：技术日志不属于用户理解层。

这使 Agent 的“理解用户”更像读取一层层压缩好的、可控的工作史，而不是全天候窥探原始明细。

### 4.2 Agent 可做什么，不能做什么

#### Agent 可以：

- 自动把 event 物化为 action_log；
- 生成日/周/月 `journal_summary` 草稿；
- 基于多日 action_log 提出低频 `behavior_insight`；
- 在 Review、Today、Project、Research、Writing 页面引用 Journal 事实；
- 对某条 insight 附上证据并接受用户纠正；
- 在用户确认后，把 insight 转成 directive 候选、review 结论或项目提醒。

#### Agent 不可以：

- 静默读取被标记为 `deny` 的 day note / journal 内容；
- 把 behavior insight 当作稳定人格真相长期固化；
- 基于 Journal 自动改写 01 的愿景或 02 的方向；
- 从单日情绪或短样本生成价值判断；
- 在未授权前把 Journal 正文、敏感标题、原始 event 发送给外部 LLM/MCP。

### 4.3 洞察生成流程：先 evidence，再 insight，再 user feedback

建议的流水线：

`event → action_log → journal_summary → candidate behavior_insight → 用户接受/驳回/静音 → （可选）进入 review/directive 候选`

关键护栏：

1. summary 必须引用 source action logs；
2. insight 必须引用 source summaries 或 source action logs；
3. 用户驳回 insight 后，系统记录 suppress rule；
4. insight 只能影响建议排序，不能直接改对象真相；
5. 一切高层建议都必须保留“为什么这样建议”的 Journal 证据入口。

### 4.4 私密模式下的 Agent 行为

当用户开启 `protected_session` 或对象为 `sealed`：

- 仍可记录一个最小占位 event：`protected_session.started/ended`；
- action_log 只显示“进行了一段受保护工作”，不显示标题与正文；
- summary 只允许使用粗粒度统计（时长、对象类型、是否完成）；
- behavior insight 不得引用密封内容；
- 外部模型与 MCP 一律不可见。

这使 Orbit 即使在最严格模式下，也能维持“今天发生过一段工作”的时间连续性，但不暴露具体内容。

## 5. 数据模型 / 接口 / 能力边界

### 5.1 推荐数据模型

```sql
CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  stream_uid TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,              -- user | agent | system
  actor_id TEXT,
  surface TEXT NOT NULL,                 -- reader | research | writing | journal | task | app
  object_uid TEXT,
  related_uids_json TEXT,
  payload_json TEXT,
  capture_mode TEXT NOT NULL,            -- explicit | implicit | imported | derived
  privacy_level TEXT NOT NULL,           -- normal | sensitive | sealed
  agent_access TEXT NOT NULL,            -- deny | summary_only | full_local_only
  retention_class TEXT NOT NULL,         -- core | crumb | audit
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  redacted_at TEXT,
  deleted_at TEXT
);

CREATE TABLE action_logs (
  action_log_id TEXT PRIMARY KEY,
  day_key TEXT NOT NULL,                 -- YYYY-MM-DD
  action_kind TEXT NOT NULL,
  primary_object_uid TEXT,
  related_uids_json TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  detail_json TEXT,
  source_event_ids_json TEXT NOT NULL,
  importance TEXT NOT NULL,              -- hidden | normal | major
  privacy_level TEXT NOT NULL,
  agent_access TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE journal_summaries (
  summary_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,                   -- day | week | month
  scope_key TEXT NOT NULL,               -- 2026-04-08 / 2026-W15 / 2026-04
  source_action_log_ids_json TEXT NOT NULL,
  source_note_ids_json TEXT,
  summary_markdown TEXT NOT NULL,
  generated_by TEXT NOT NULL,            -- system | agent | user_edited
  privacy_level TEXT NOT NULL,
  agent_access TEXT NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  superseded_by TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE behavior_insights (
  insight_id TEXT PRIMARY KEY,
  insight_type TEXT NOT NULL,            -- focus_pattern | input_to_output | project_drift | review_gap ...
  scope_start TEXT NOT NULL,
  scope_end TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  confidence REAL,
  sample_size INTEGER,
  status TEXT NOT NULL,                  -- proposed | active | dismissed | pinned | expired
  visibility TEXT NOT NULL,              -- user_visible | hidden_until_review
  created_by TEXT NOT NULL,              -- agent | user_confirmed
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  dismissed_reason TEXT
);
```

`day_note` 不单独新发明表，而沿用 06 的统一 Note 模型：`notes(note_kind='journal')`，并通过 `links(journal_note --reflects_on--> object)` 与对象网络对齐。

### 5.2 与对象网络的接法

08 不应自建孤立数据岛，而应接入 09 与 12 的统一模型：

- `day_note`、`journal_summary`、`behavior_insight` 都进入 `object_index`；
- `links` 至少支持：`reflects_on`、`reviews`、`mentions`、`derived_from`、`evidenced_by`；
- `events` 作为全局事实层存在，08 只是它的主要消费方之一；
- `action_log` 可以是物化表，也可以是稳定投影视图，但必须可被 Journal、Review、Agent 共享。

### 5.3 关键内部接口

| 接口 | 用途 |
|---|---|
| `event.append` | 记录语义事件 |
| `journal.materialize_day` | 把某天 event 聚合为 action_log 与 stats |
| `journal.get_day` | 读取 day note、timeline、summary、insights |
| `journal.update_day_note` | 更新当天手记 |
| `journal.generate_summary` | 生成/重算某天或某周摘要 |
| `journal.generate_insights` | 生成候选行为洞察 |
| `journal.dismiss_insight` | 驳回并记录 suppress rule |
| `journal.export` | 按范围导出日志层 |
| `journal.delete_range` | 删除/打码某个时间范围的日志 |
| `journal.set_privacy_mode` | 调整全局/对象/会话级隐私策略 |

### 5.4 能力边界

1. **Journal 不是工程 telemetry 面板**：排错日志不进入 Journal。  
2. **Journal 不是审计台**：不提供用户评分、纪律打卡、对齐率。  
3. **Behavior insight 不是长期画像主表**：真正长期稳定的高层背景仍然是 01 的愿景与用户确认的 directive。  
4. **删除优先于洞察连续性**：当用户删除原始日志后，相关 summary/insight 必须失效或重算。  
5. **外部模型只能读取授权视图**：优先摘要层，禁止默认读取密封原文。  

## 6. 与其他专题的依赖关系

| 依赖专题 | 关系说明 |
|---|---|
| **01《愿景写入与长期记忆》** | Journal 只能在回顾与建议中引用愿景版本，不能把日志推导出的短期模式反向固化为愿景真相。`journal_summary` 与 `behavior_insight` 最多生成“是否需要更新 directive/愿景的提示”，不直接改写 01。 |
| **02《人生规划系统》** | 02 需要 Journal 提供日/周/月事实基础，完成 `journal -> review -> planning` 闭环；08 则依赖 02 定义 review、commitment、goal 等规划对象，好让 Journal 能把“今天发生了什么”映射回人生规划语义。 |
| **03《Agent驱动任务管理》** | 03 是 08 最核心的事件来源之一：Captured / Focused / Done / Blocked / Reviewed 等任务事件进入 Journal，Journal 再把真实执行情况反哺 Today、Focus、Review 与下一件事计算。 |
| **04《全源阅读与转译转写》** | 阅读、翻译、转写、保存、打开、路由、高亮等动作必须在 04 定义统一 event 语义与对象引用，否则 Journal 无法回答“今天读了什么、哪些阅读转成了任务/研究/写作”。 |
| **05《研究工作台》** | 研究会话、资料池更新、knowledge gap、artifact 生成与研究到行动的转化都应进入 Journal；08 为 05 提供时间视角和回顾事实，而 05 为 08 提供主题化研究对象。 |
| **09《对象网络与关联能力》** | `day_note`、`journal_summary`、`behavior_insight` 必须成为对象网络中的时间对象；同时 Journal 依赖 09 的 `reflects_on / reviews / evidenced_by` 关系实现“按对象看时间、按时间看对象”的双向穿透。 |
| **11《Local-First 同步与 GDPR》** | 08 的 retention、export、删除权、敏感日志分层、外部出境控制、本地-only 私密模式都要遵守 11 的同步与合规底座；尤其日志删除必须在跨端与云端加密副本中一致传播。 |
| **14《Agent架构》** | 14 负责定义哪些 Agent 能读取哪一层 Journal 数据、如何在 system prompt / memory context 中注入摘要而不是明文、如何让 insight 生成与 suppress rule 成为受控工具链。08 只定义权限语义，不定义运行时实现。 |

## 7. 风险、边界与设计决策

1. **风险：日志变成噪音瀑布。**  
   决策：以 `action_log` 作为 Journal 主展示层，只让 `event` 承担真相与回放职责。

2. **风险：behavior insight 越界成“用户画像黑箱”。**  
   决策：insight 必须可见、可证据追溯、可驳回、可过期，且禁止心理化标签。

3. **风险：为了“全局记录”而过度采集。**  
   决策：只记录 Orbit 内有语义的动作；外部上下文必须显式开启且默认最小化采集。

4. **风险：隐私模式导致回顾断裂。**  
   决策：提供粗粒度 protected session 占位记录，让时间连续但内容不暴露。

5. **风险：删除权与回放需求冲突。**  
   决策：用户删除原始事实后，summary/insight 必须失效或重建；解释层永远不能凌驾于删除权之上。

6. **风险：Agent 为了更聪明而请求过多原始日志。**  
   决策：默认摘要层优先、原始 event 最后读取、密封内容逐次授权；14 中实现强制工具权限与审计。

一句话总结：**08 不是“日记页面”，而是 Orbit 的事实时间层——它以 event 为真相、以 Journal 为界面、以隐私控制为护栏，让 Agent 能逐渐理解用户，却始终不能越过用户可见与可控的边界。**
