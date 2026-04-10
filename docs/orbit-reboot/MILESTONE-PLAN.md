# Orbit Reboot 里程碑计划 — 纯依赖拓扑版

> 不估时间，只看依赖。每一层(Wave)内的任务完全独立、可同时开工；必须等上一层全部完成才能开始下一层。
>
> 更新：2026-04-10

---

## 一、依赖总图

```
Wave 0 ──────────────────────────────────────────────────────────
  [10] Monorepo 骨架        无依赖
  [18] 设计系统 Token        无依赖
  [17] 三语骨架              无依赖
  全部可同时启动，且已部分完成

Wave 1 ──────────────────────────────────────────────────────────
  [12] 对象数据库  ←──┐
  [13] 文件系统架构 ←──┤ 三者高度耦合，视为一个整体
  [09] 对象网络    ←──┘
  依赖 Wave 0（monorepo 包结构必须先定）

Wave 2 ──────────────────────────────────────────────────────────
  [16] Block 编辑器         ← 依赖 [13][09][18]
  [14] Agent 架构           ← 依赖 [09][12][13]
  [15] MCP 能力层           ← 依赖 [09][12][14]
  [11] 同步与加密           ← 依赖 [12][13]
  [19] 服务端               ← 依赖 [11][10]
  ↑ 五者互相无依赖，Wave 1 完成后可全部并行
  ↑ 唯一例外：[15] 需要 [14] 的 Capability Registry 接口定义

Wave 3 ──────────────────────────────────────────────────────────
  [01] 愿景系统             ← 依赖 [12][13][16]
  [04] 阅读系统             ← 依赖 [13][09][17]
  [08] Journal              ← 依赖 [09][12]
  [03] 任务管理(核心)        ← 依赖 [09][12][14]
  ↑ 四者互相无依赖，Wave 2 完成后可全部并行

Wave 4 ──────────────────────────────────────────────────────────
  [06] 笔记与高亮           ← 依赖 [04][09][16]
  [02] 人生规划             ← 依赖 [01][03][08]
  ↑ 两者互相无依赖

Wave 5 ──────────────────────────────────────────────────────────
  [05] 研究工作台           ← 依赖 [04][06][14]
  ↑ 必须等 [06] 完成

Wave 6 ──────────────────────────────────────────────────────────
  [07] 写作工作台           ← 依赖 [05][06][16]
  ↑ 必须等 [05] 完成，是整个系统的末端
```

---

## 二、分 Wave 详细任务拆解

---

### Wave 0：零依赖地基

> 无任何前置条件。三个模块互不依赖，可同时开工。

#### W0-A：Monorepo 骨架 [10]

| # | 任务 | 对应包 | 验收标准 |
|---|------|--------|---------|
| 1 | pnpm workspace + Turborepo 配置 | 根目录 | `turbo run lint typecheck test build` 全通过 |
| 2 | TypeScript project references | tsconfig.base.json / packages/tooling | 包间类型引用正确 |
| 3 | Electron 空壳 | apps/desktop | 可启动空窗口 |
| 4 | Web 空壳 | apps/web | localhost 可访问 |
| 5 | Server 空壳 | apps/server | Hono `/health` 返回 200 |
| 6 | iOS 空壳 | apps/ios | Expo 模拟器可运行 |
| 7 | platform-contracts 接口定义 | packages/platform-contracts | WorkspacePort / DatabasePort / SyncPort / CapabilityHostPort 等接口声明 |
| 8 | CI 管线 | .github/workflows | PR 自动跑全量检查 |

#### W0-B：设计系统 Token [18]

| # | 任务 | 对应包 | 验收标准 |
|---|------|--------|---------|
| 1 | OKLCH 语义色完整导入 | packages/ui-tokens | `--bg-back` 到 `--bg-state-active` 全量 light/dark token |
| 2 | 排版阶梯 | ui-tokens | `--text-xxs` 到 `--text-5xl`、字重、行高 |
| 3 | 间距 / 圆角 / 阴影 | ui-tokens | `--sp-*` / `--r-*` / `--shadow-*` |
| 4 | 对象类型专属色 | ui-tokens | Project/Quote/Note/DailyNote/Page/Tag 恒定色 |
| 5 | 暗色主题切换机制 | ui-tokens | `data-theme="dark"` 可切换全量 token |
| 6 | 基础 DOM 组件骨架 | packages/ui-dom | Button / Card / Modal / NavItem / Badge 基础组件 |

#### W0-C：三语骨架 [17]

| # | 任务 | 对应包 | 验收标准 |
|---|------|--------|---------|
| 1 | Locale 体系定义 | packages/i18n | app_locale / content_locale / agent_output_locale / search_locale 四分离 |
| 2 | i18n runtime + hooks | packages/i18n | `useTranslation()` / `t()` 三端可用 |
| 3 | 资源按 namespace 组织 | packages/i18n/resources | common / reader / search / agent / settings 初始文案 |
| 4 | 术语表骨架 | packages/i18n/termbase | concept_id / preferred_terms / aliases / forbidden_terms 结构 |
| 5 | Fallback 链 | i18n | `zh-TW → en-US`、`zh-CN → en-US`，不做简繁互转 fallback |
| 6 | 日期 / 数字 formatter | i18n | 三端统一 `Intl` 包装 |

---

### Wave 1：数据基座（全局最关键前置）

> 依赖 Wave 0 的包结构。[12][13][09] 三个文档描述的能力高度交织，必须作为一个原子单元交付。
> **这是整个项目的卡点——所有后续模块都直接或间接依赖它。**

| # | 任务 | 对应包 | 验收标准 |
|---|------|--------|---------|
| **领域模型** | | | |
| 1 | 方向对象类型 | packages/domain | vision / direction / theme / goal / commitment / review TS types |
| 2 | 执行对象类型 | domain | project / milestone / task / directive |
| 3 | 输入对象类型 | domain | article / book / highlight / note / asset / source_endpoint / content_item |
| 4 | 研究对象类型 | domain | research_space / question / source_set / claim / gap / artifact |
| 5 | 产出对象类型 | domain | document / draft / post / voice_profile / output_variant |
| 6 | 时间对象类型 | domain | event / action_log / day_note / journal_summary / behavior_insight |
| 7 | Agent 对象类型 | domain | agent_session / agent_run / agent_task / capability_call / approval_request |
| 8 | 统一 object_uid 协议 | domain | `{type}:{ulid}` 格式定义 + 生成/解析工具函数 |
| 9 | 统一 relation vocabulary | domain | 结构/来源/支撑/执行/产出/讨论/反思/聚合 八族关系枚举 |
| **SQLite Schema** | | | |
| 10 | 类型表族 | packages/db-schema | 所有类型 CREATE TABLE + 迁移脚本 |
| 11 | object_index 表 | db-schema | object_uid / object_type / object_id / layer / status / origin / version_token |
| 12 | links 表 | db-schema | source_uid / target_uid / relation_type / origin / status / confidence / why_summary |
| 13 | events 表 | db-schema | event_id / stream_uid / event_type / actor_type / payload_json / occurred_at |
| 14 | FTS 投影表 | db-schema | object_search_fts (FTS5) / object_chunks_fts |
| 15 | link_evidence 表 | db-schema | 可选 AI 解释与证据 |
| **文件系统** | | | |
| 16 | 三层目录创建 | packages/workspace-core | sources/ + wiki/ + .orbit/ 自动创建与校验 |
| 17 | file_index 扫描器 | workspace-core | 文件监听 / mtime / content_hash / frontmatter 提取 |
| 18 | frontmatter 契约 | workspace-core | orbit_id / orbit_type 读写 + 外部编辑容错 |
| 19 | 编译管线 | workspace-core | scan → parse → project → index → link → compile → audit 流水线 |
| 20 | AI 写入边界守卫 | workspace-core | sources/ 只读 / wiki/ AI 可写 / .orbit/ 系统层 |
| **对象图谱** | | | |
| 21 | object_uid hydrate | packages/object-graph | 从 uid 解析到具体类型表记录 |
| 22 | links CRUD | object-graph | create / update / reject / list / backlinks / neighbors |
| 23 | 关系建议引擎骨架 | object-graph | AI 候选 → proposed → active/rejected 状态机 |
| 24 | 跨对象查询 | object-graph | 上下文包 / 工作链 / 孤岛检测 / 证据追溯 / 时间反查 |
| **数据协议** | | | |
| 25 | Repository 接口 | packages/data-protocol | object.query / object.read / object.write / link.write / event.append |
| 26 | Mutation Envelope | data-protocol | mutationId / objectId / actor / baseVersion / payload |
| 27 | Agent 逻辑视图 | data-protocol | agent_items_v / agent_links_v / agent_events_v 投影 |

**Wave 1 验收标准：**
- 可创建任意类型对象并写入 SQLite + 文件系统
- object_index 自动同步
- links 可跨类型建立并查询 backlinks
- events 可追加并按 stream 回放
- FTS 可检索对象标题和正文块
- contract tests 全部通过

---

### Wave 2：核心引擎（五个模块互不依赖，Wave 1 后全部并行）

> Wave 1 完成后，以下五个模块可同时启动，互相没有阻塞关系。
> 唯一微耦合：[15] 需要 [14] 的 Capability 接口定义，但接口定义可在 domain 层先定义。

#### W2-A：Block 编辑器 [16]

依赖：[13] 文件契约、[09] 对象网络、[18] Token

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | TipTap 内核集成 | packages/editor-dom 基础编辑可用 |
| 2 | Block Schema | paragraph / heading / list / callout / quote / code / table / image |
| 3 | Block ID 懒分配 | 笔记模式不强制 ID；被引用/被提问时按需补发 |
| 4 | Markdown ↔ AST | 双向转换；反序列化幂等 |
| 5 | frontmatter 保留 | orbit_id / orbit_type 读写不丢 |
| 6 | `<!-- orbit:block -->` 注释 | 读写 + 外部删除后可恢复 |
| 7 | 三模式配置 | note (lazy) / research (required) / writing (required+provenance) |
| 8 | Slash Menu 四组 | 通用块 / 引用材料 / 研究增强 / 写作增强 |
| 9 | 拖拽组装 | reference / snapshot / embed 三种语义 |
| 10 | Block Provenance | 来源链记录 + verbatim/edited/ai_rewrite/merged/summarized |
| 11 | 外部编辑容错 | block 回附 + detached 标记 |

#### W2-B：Agent 架构 [14]

依赖：[09] 对象图谱、[12] 数据库、[13] 文件索引

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Orchestrator | 意图路由 / 上下文装配 / Agent 分发 / 执行模式选择 / 结果归档 |
| 2 | Domain Agent 接口 | Planner / Reader / Research / Writing / Review / Graph / Ops 七个 Agent 的接口定义 |
| 3 | Capability Registry | 能力注册 + 元数据 (risk/approval/scope/cost/boundary) + 过滤逻辑 |
| 4 | Safety Gate | R0–R3 风险分级 + A0–A3 审批分级 + 上下文安全扫描 |
| 5 | Memory Layers | L0 Turn → L1 Session → L2 Object → L3 User LT → L4 Procedural → L5 Archive |
| 6 | Session Lineage | continues_from / delegated_from / spawned_by_object / blocked_by_approval |
| 7 | Compression 五级 | Turn → Session → Workspace → Lineage → Archive 摘要 |
| 8 | Approval 流程 | 请求 / 暂停 / 恢复 / 审计记录 |
| 9 | 异步任务框架 | async_job 入队 / 重试 / 取消 / 跨端同步 |
| 10 | 学习回路 | 候选提炼 → 用户确认 → 灰度启用 → 审计 |

#### W2-C：MCP 能力层 [15]

依赖：[09][12]、[14] 的 Capability 接口定义

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Capability Interface 完整定义 | id/version/domain/kind/exposure/inputSchema/outputSchema/risk/approval/audit/egress |
| 2 | 八域注册 | Workspace Query / Content Capture / Research / Writing / Planning / Graph / Integration / Sensitive |
| 3 | Local MCP Server | Resource / Tool / Prompt 三分法适配 |
| 4 | External MCP Client | 外部代理层 + 候选层回流 |
| 5 | Policy Engine | scope + 工作区 + 项目 + 数据等级 + 出境 |
| 6 | Audit Sink | 调用链完整审计 |
| 7 | 确认模型 | 静默/会话授权/每次确认/双阶段 四级 |
| 8 | 敏感隔离 | Open / Guarded / Vault 三条执行通道 |

#### W2-D：同步与加密 [11]

依赖：[12] 对象数据库、[13] 文件系统

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | 三通道定义 | 对象 LWW / 长文档 3-way merge / blob 内容寻址 |
| 2 | SyncMeta / SyncChange | objectId / version / updatedAt / checksum / baseVersion |
| 3 | 对象 LWW | version++ → outbox → 加密上传 → 拉取 → 解密 → 冲突策略 |
| 4 | 长文档 3-way merge | diff3(ancestor, local, remote) → 自动合并 / 冲突保留两版 |
| 5 | Blob 内容寻址 | sha256(明文) → 加密 → putIfAbsent → 引用计数 |
| 6 | 加密层 | masterKey = argon2id(passphrase) → AES-256-GCM 加解密 |
| 7 | 恢复短语 | 12-24 词确定性派生 |
| 8 | outbox 离线写入 | UI 不等网络 → 恢复联网后批量上传 |
| 9 | 不同步项定义 | FTS / vector / thumbnail / cache → 本地重建 |

#### W2-E：服务端 [19]

依赖：[11] 同步协议、[10] Monorepo 骨架

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Auth API | 注册/登录/JWT/刷新/密码重置/账号删除 |
| 2 | Device API | 注册/配对/撤权/设备列表 |
| 3 | Sync Push/Pull API | 加密变更上传/游标拉取/通知触发 |
| 4 | Blob API | PUT/GET/HEAD/DELETE 加密 blob |
| 5 | Notification | WebSocket + SSE + APNs 注册 |
| 6 | GDPR API | 导出工单/删除工单(7天冷静期)/进度查询 |
| 7 | PostgreSQL Schema | accounts / devices / sync_changes / cursors / pairing / gdpr / audit |
| 8 | S3/R2 对象存储 | {account}/{channel}/{changeId}.enc 布局 |
| 9 | API Types 共享 | packages/api-types — Client ↔ Server 共享 DTO/ErrorCode/Event |
| 10 | 速率限制 | 注册5/h、登录10/m、push100/m、pull200/m、blob50/m |

---

### Wave 3：核心功能第一批（四个模块互不依赖，Wave 2 后全部并行）

> 以下四个功能互相无依赖关系。

#### W3-A：愿景写入 [01]

依赖：[12] 数据库、[13] 文件系统、[16] 编辑器

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Onboarding 6步流程 | 定位说明 → 愿景书写 → Agent整理 → 确认 → 提醒姿态 → 落地承接 |
| 2 | Vision 对象 + 版本 | visions + vision_versions 表 + Markdown 文件 |
| 3 | 追加式版本化 | 新版本不覆盖旧版；旧版可被历史 journal/项目引用 |
| 4 | Agent 三层注入 | system prompt 写原则 / memory context 写摘要 / review 读原文 |
| 5 | 温和提醒策略 | 选择前/创建时/回顾时/求助时 四触发点 |
| 6 | Directive 体系 | directive CRUD + derived_from vision + Agent 可建议用户确认 |
| 7 | 隐私边界 | 默认本地 / 云端仅摘要 / 可见性控制 |

#### W3-B：全源阅读 [04]

依赖：[13] 文件系统、[09] 对象网络、[17] 三语

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | 来源发现 | RSS autodiscovery / site watch / 社交媒体日报 |
| 2 | 订阅管理 | source_subscription CRUD / 抓取频率 / 静音 |
| 3 | 内容抓取与提取 | URL → 原始HTML → 正文提取 → Markdown → 原文件保留 |
| 4 | 四层分离 | raw(原始) / readable(可读表示) / metadata(索引) / derived(AI衍生) |
| 5 | 统一 Reader UI | 标题/来源/正文主区/翻译层/高亮层/右侧上下文 |
| 6 | 多媒介渲染器 | 文章段落 / 章节树 / timecoded segments |
| 7 | 翻译层 | 逐段双语 / 多语并存 / 术语表优先 / 不覆盖原文 |
| 8 | 转写层骨架 | transcript 结构化 + 时间码 + 说话人 |
| 9 | 内容状态机 | discovered → subscribed → fetched → extracted → ready → archived |
| 10 | 阅读到流转出口 | 转高亮 / 转笔记 / 转研究 / 转行动 / 转写作 |

#### W3-C：Journal [08]

依赖：[09] 对象网络、[12] 数据库

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | 五层日志模型 | event → action_log → day_note → journal_summary → behavior_insight |
| 2 | 语义事件记录 | 对象生命周期/关系变化/阅读/研究/写作/执行/Journal 七大类 |
| 3 | 隐私分级 | normal / sensitive / sealed + agent_access (deny/summary_only/full_local) |
| 4 | Action Log 聚合 | 同对象同语义短时间折叠 → 面向用户可读块 |
| 5 | Journal 页面 | 日期头 + Day Note + Timeline + Summary + Insight 五区域 |
| 6 | Day Note | note_kind='journal' 复用 Note 对象模型 |
| 7 | Summary 生成 | Agent 日/周/月摘要 + 来源 action_log 引用 |
| 8 | Behavior Insight | 模式洞察 + 证据 + 30-90天过期 + 用户可驳回 |
| 9 | Retention 策略 | core 长期 / crumb 7-30天 / insight 30-90天 / 技术日志 7-30天 |
| 10 | 隐私模式 | protected_session 占位 + 密封对象逐次授权 |

#### W3-D：任务管理核心 [03]

依赖：[09] 对象网络、[12] 数据库、[14] Agent 架构

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Task 生命周期 | Captured → Clarifying → Ready → Scheduled → Focused → Done/Blocked/Dropped → Reviewed |
| 2 | Project + Milestone | 项目 CRUD + 里程碑 + parent_of/depends_on 关系 |
| 3 | 从意图到结构 | 用户模糊输入 → Agent 自动归类/拆分/补全 |
| 4 | Today 动态生成 | Agent 按 Ready/未阻塞/风险/deadline/精力/上下文 重算 |
| 5 | Focus 模式 | 进入单一行动 + 自动加载目标/里程碑/材料/review/输出去向 |
| 6 | Review 三层 | 日回顾 / 周回顾 / 项目复盘 → 必须产出决策 |
| 7 | "下一件事" 计算 | 筛候选 → 算约束 → 算收益 → 1主+2备选 |
| 8 | Support Links | 阅读/研究/写作材料与 task/project 双向关联 |
| 9 | 用户确认点 | 升级项目/改写愿景/directive/跨项目重排/里程碑变更/删除/对外 = 必须确认 |
| 10 | 事件驱动状态 | 状态列用于展示，真实历史由 events 记录 |

---

### Wave 4：核心功能第二批（两个模块互不依赖）

#### W4-A：笔记与高亮 [06]

依赖：[04] 阅读系统、[09] 对象网络、[16] Block 编辑器

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | SelectionContext | 统一选区运行时对象，覆盖 reader/note/document/research/journal/agent |
| 2 | 浮动菜单 | 高亮 / 边注 / 问Agent / 保存到笔记 / 创建任务 |
| 3 | 高亮锚点四层 | 对象层 + 结构层(paragraph/cfi/page) + 文本指纹 + 状态(active/fuzzy/detached) |
| 4 | 高亮对象 | highlight CRUD + object_index + highlight_kind(highlight/question_seed/evidence/quote) |
| 5 | 统一 Note 对象 | note_kind(fleeting/annotation/research/journal/synthesis) + maturity + origin |
| 6 | 上下文提问 | 选中 → Context Card → Agent → 可保存为 Note/加入研究/创建任务 |
| 7 | Block 溯源 | block_provenance 跨 note/research_artifact/document 通用 |
| 8 | 流转四出口 | → 研究(evidence_for) / → 任务(derived_from) / → 写作(used_in) / → Journal(captures) |
| 9 | 不自动污染 | 提问不自动创建高亮；只有用户显式选择才持久化 |

#### W4-B：人生规划 [02]

依赖：[01] 愿景、[03] 任务、[08] Journal

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Direction 对象 | 年度方向 (2-4条) + Agent 提议 + 用户确认 |
| 2 | Theme 对象 | 季度主题 + focuses_on direction |
| 3 | Goal 对象 | 月/季阶段结果 + implemented_by project/task |
| 4 | Commitment 对象 | 周承诺 (3-5条) + 数量强约束 |
| 5 | Vision→Today 链 | vision → direction → theme → goal → commitment → today_plan 连续收敛 |
| 6 | 规划节奏 | 五年半年校/年初建/季双周检/月初设/周一建/日晨生成 |
| 7 | 回顾闭环 | Journal事实 → review草稿 → 用户判断 → planning重排 |
| 8 | 规划差值触发 | 方向稀释/项目漂移/研究悬空/写作断档/节奏失真/回顾缺席 |
| 9 | Agent 边界 | 愿景/direction=用户独占；theme/goal调整=需确认；today=可自动 |

---

### Wave 5：研究工作台 [05]

依赖：[04] 阅读、[06] 笔记与高亮、[14] Agent

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Research Space | 长期主题容器 (问题区/资料池/会话区/产物区) |
| 2 | 问题树 | research_question 层级 + 假设 + 成功标准 |
| 3 | 资料池 | 批量选源 + 候选/已采纳/待验证/废弃 四层 |
| 4 | Source Grounding | 先内部检索 → grounding bundle → 再识别缺口 → 再外部检索 |
| 5 | 研究会话 | 绑定问题+资料池快照+期望输出类型+执行策略 |
| 6 | 知识缺口 | research_gap (事实/比较/论证/时效/反例) + 状态管理 |
| 7 | 研究产物 | 摘要卡/对比矩阵/综述/结论memo/提纲/PPT大纲/任务建议 |
| 8 | 结果沉淀 | 更新问题状态 / 沉淀证据 / 沉淀结论 / 沉淀后续动作 |
| 9 | 外部 MCP 边界 | 外部返回→候选来源→去重/标注→用户确认→正式 source_item |
| 10 | 研究→行动/写作 | 缺口生成任务 / 结论进入写作材料板 |

---

### Wave 6：写作工作台 [07]

依赖：[05] 研究、[06] 笔记、[16] 编辑器

> **这是功能依赖链的终端节点，所有上游都完成后才能完整实现。**

| # | 任务 | 验收标准 |
|---|------|---------|
| 1 | Writing Workspace | 主题/项目输出容器 + 默认 voice |
| 2 | Output Brief | 受众/目标/输出类型/限制/渠道 |
| 3 | Material Board | 分组/优先级/adopted/consumed/excluded + 引用锚点 |
| 4 | Voice Profile | 语气/句法/修辞/受众适配/禁忌/代表样本/负样本 + 版本化 |
| 5 | 大纲组装 | 2-3版结构 + 材料覆盖度 + 用户确认 → outline_version |
| 6 | 分章节初稿 | 按大纲节点 + 材料 + voice 逐章生成 → 写回 Block 编辑器 |
| 7 | 多轮润色 | 结构收紧 / 论证校正 / 口吻对齐 / 渠道适配 / 风险检查 → revision_pass |
| 8 | 渠道变体 | output_variant: newsletter / 社媒 / 演讲稿 / 脚本 |
| 9 | Citation + Provenance | citation_record(面向读者) + block_provenance(面向系统) + 多源追溯 |
| 10 | 发布与回流 | publish_job → publish_record → 反馈回流 → 新研究问题/voice调整 |
| 11 | Agent 五阶段参与 | grounding → 大纲 → 初稿 → 润色 → 发布 (不是聊天框) |

---

### Wave 7：三端适配 + Agent 深度融合 + 发布准备

> 这一波没有硬依赖顺序，属于全功能完成后的横向完善。所有任务可自由并行。

| 分组 | 任务 | 验收标准 |
|------|------|---------|
| **Web 端** | Browser adapter / OPFS / ServiceWorker | Web 与桌面功能一致 |
| **Web 端** | feature-workbench 复用 | 共享 DOM 工作台直接挂载 |
| **iOS 端** | Today / Journal / Quick Note / Reader / Agent Chat | iOS 核心页面可用 |
| **iOS 端** | Share Extension | 从任意 App 保存内容 |
| **iOS 端** | 同步集成 | 高频优先 / 大资产按需 / Keychain 密钥 |
| **跨端** | 完整同步验证 | Desktop ↔ Server ↔ iOS 数据一致 |
| **跨端** | 设备配对 | 扫码 + 恢复短语 |
| **跨端** | 冲突处理 UI | 冲突列表/版本对比/选择保留 |
| **Agent** | Planner Agent 完整 | 项目页"落成计划" |
| **Agent** | Reader Agent 完整 | 选区解释/翻译/建链 |
| **Agent** | Research Agent 完整 | 证据编译/缺口识别/外部检索 |
| **Agent** | Writing Agent 完整 | 材料推荐/大纲/分章节/润色 |
| **Agent** | Review Agent 完整 | 日/周回顾汇总+下一步 |
| **Agent** | Graph Agent 完整 | 自动建链/去重/归类/召回 |
| **Agent** | Wiki 编译 | sources→wiki 实体/概念/dossier |
| **Agent** | 出境控制面板 | 出境说明卡/授权/历史 |
| **Agent** | 跨会话延续 | lineage+handoff+断点恢复 |
| **质量** | 端到端测试 | Onboarding→愿景→项目→阅读→研究→写作→发布→回顾 |
| **质量** | 安全审计 | 加密/权限/出境/注入 |
| **质量** | GDPR 合规 | 导出/删除/匿名/同意 |

---

## 三、依赖关系一览表

> 行 = 模块，列 = 它依赖谁。`●` = 直接依赖。

| | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **[09]** | — | | | ● | ● | | | | | | | | | | | | | |
| **[11]** | | | — | ● | ● | | | | | | | | | | | | | |
| **[14]** | ● | | ● | ● | ● | — | | | | | | | | | | | | |
| **[15]** | ● | | | ● | | ● | — | | | | | | | | | | | |
| **[16]** | ● | | | | ● | | | — | | ● | | | | | | | | |
| **[19]** | | ● | ● | | | | | | | | | | | | | | | |
| **[01]** | | | | ● | ● | ● | | ● | | | — | | | | | | | |
| **[03]** | ● | | | ● | | ● | ● | | | | ● | | — | | | | | |
| **[04]** | ● | | | | ● | | ● | | ● | | | | | — | | | | |
| **[08]** | ● | | | ● | | | | | | | | | | | | ● | | — |
| **[06]** | ● | | | | | | | ● | | | | | | ● | | — | | |
| **[02]** | ● | | | | | | | | | | ● | — | ● | | | | | ● |
| **[05]** | ● | | | | | ● | ● | | | | | | | ● | — | ● | | |
| **[07]** | ● | | | | | | ● | ● | | | | | | | ● | ● | — | |

---

## 四、关键路径（最长依赖链）

```
[10]+[18]+[17]                    ← Wave 0
  → [12]+[13]+[09]                ← Wave 1 (全局卡点)
    → [16]                        ← Wave 2
      → [04]                      ← Wave 3
        → [06]                    ← Wave 4
          → [05]                  ← Wave 5
            → [07]                ← Wave 6
```

**这条链是不可缩短的：写作依赖研究，研究依赖笔记，笔记依赖阅读，阅读依赖编辑器，编辑器依赖数据基座。**

但在这条主链运行的同时，每个 Wave 中都有大量可并行的旁路：
- Wave 2：Agent/MCP/同步/服务端 与编辑器并行
- Wave 3：愿景/Journal/任务 与阅读并行
- Wave 4：人生规划 与笔记并行

---

## 五、任务总数统计

| Wave | 模块 | 任务数 |
|------|------|--------|
| 0 | Monorepo + Token + i18n | 20 |
| 1 | 数据基座 (domain + schema + fs + graph + protocol) | 27 |
| 2 | 编辑器 + Agent + MCP + 同步 + 服务端 | 50 |
| 3 | 愿景 + 阅读 + Journal + 任务 | 37 |
| 4 | 笔记高亮 + 人生规划 | 18 |
| 5 | 研究工作台 | 10 |
| 6 | 写作工作台 | 11 |
| 7 | 三端适配 + Agent完善 + 质量 | 21 |
| **总计** | | **194 个任务** |
