# Orbit 系统架构蓝图

> **开发前必读** — 本图描绘 Orbit 的完整架构愿景。
> 所有开发工作应先理解本图中的层次与数据流，再动手编码。

## 总体架构：五层 + 三端 + 七 Agent

```mermaid
graph TB
  %% ============================================================
  %% COLOR THEME
  %% ============================================================
  classDef expLayer fill:#1a1a2e,stroke:#e94560,color:#eee,stroke-width:2px
  classDef agentLayer fill:#16213e,stroke:#0f3460,color:#eee,stroke-width:2px
  classDef capLayer fill:#0f3460,stroke:#533483,color:#eee,stroke-width:2px
  classDef dataLayer fill:#533483,stroke:#e94560,color:#eee,stroke-width:2px
  classDef storageLayer fill:#2c003e,stroke:#e94560,color:#eee,stroke-width:2px
  classDef serverBox fill:#1b1b2f,stroke:#e43f5a,color:#eee,stroke-width:2px
  classDef flowArrow stroke:#e94560,stroke-width:2px
  classDef dimBox fill:#111,stroke:#444,color:#999

  %% ============================================================
  %% LAYER 1 — EXPERIENCE LAYER  体验层
  %% ============================================================
  subgraph EXP["🖥️  L1 · Experience Layer — 体验层"]
    direction LR
    subgraph Desktop["Desktop (Electron)"]
      direction TB
      D_Main["main process<br/>IPC · LLM Proxy · FS"]
      D_Renderer["renderer<br/>React DOM · HeroUI v3"]
      D_Main --- D_Renderer
    end
    subgraph Web["Web (Browser)"]
      direction TB
      W_Entry["SPA entry<br/>React DOM · HeroUI v3"]
      W_Worker["Web Worker<br/>wa-sqlite · OPFS"]
      W_Entry --- W_Worker
    end
    subgraph iOS["iOS (React Native)"]
      direction TB
      I_Native["Expo Router<br/>RN Components"]
      I_SQLite["expo-sqlite"]
      I_Native --- I_SQLite
    end

    subgraph SharedUI["Shared UI Packages"]
      UI_Tokens["ui-tokens<br/>Design Tokens · OKLCH"]
      UI_Dom["ui-dom<br/>DOM Theme"]
      UI_Native["ui-native<br/>Native Theme"]
      Conv_UI["conversation-ui<br/>Streaming · Messages · Panels"]
      Editor["editor-dom<br/>TipTap · Block Schema · Markdown"]
      I18N["i18n<br/>zh-CN · en-US · zh-TW"]
    end
  end
  EXP:::expLayer

  %% ============================================================
  %% LAYER 2 — AGENT RUNTIME LAYER  Agent 运行时层
  %% ============================================================
  subgraph AGENT["🤖  L2 · Agent Runtime Layer — Agent 运行时层"]
    direction LR
    subgraph Orchestrator["Orchestrator 编排器"]
      Intent["Intent Router<br/>意图路由"]
      Context["Context Assembler<br/>上下文组装"]
      Dispatch["Dispatch / Risk Gate<br/>调度 · 风险关口"]
    end

    subgraph DomainAgents["Seven Domain Agents"]
      A_Planner["🎯 Planner<br/>Vision · Task · Today<br/>Focus · Review"]
      A_Reader["📖 Reader<br/>Article · Book · Podcast<br/>Transcript · Highlight"]
      A_Research["🔬 Research<br/>Question · Source Set<br/>Claim · Gap · Artifact"]
      A_Writing["✍️ Writing<br/>Draft · Document · Post<br/>Outline · Variant"]
      A_Review["📓 Review<br/>Journal · Timeline<br/>Daily · Weekly Summary"]
      A_Graph["🕸️ Graph<br/>Object Index · Links<br/>Backlinks · Dedup"]
      A_Ops["⚙️ Ops<br/>Async Job · Approval<br/>Notification · Connector"]
    end

    subgraph AgentInfra["Agent Infrastructure"]
      LLM["LLM Providers<br/>OpenAI · Anthropic · Ollama"]
      Memory["Multi-Layer Memory<br/>L0 Turn → L5 Archive"]
      Session["Session Manager<br/>Lineage · Compression"]
      Safety["Safety Gate<br/>Approval · Audit"]
      Tools["Tool Registry<br/>50+ Domain & General Tools"]
      Skills["Skill System<br/>Builtin · User · MCP"]
      Cost["Cost Tracker<br/>Rate Limiter"]
      Observe["Observability<br/>Trace · Metrics · Log"]
    end
  end
  AGENT:::agentLayer

  %% ============================================================
  %% LAYER 3 — CAPABILITY LAYER  能力层
  %% ============================================================
  subgraph CAP["⚡  L3 · Capability Layer — 能力层 (MCP)"]
    direction LR
    subgraph CapDomains["Eight Capability Domains"]
      C_WQ["Workspace Query<br/>项目摘要 · 对象详情<br/>关系图谱 · 时间线"]
      C_CC["Content Capture<br/>导入文章 · 保存网页<br/>转写 · 转译"]
      C_RE["Research<br/>资料池 · 证据包<br/>候选导入 · 落稿"]
      C_WR["Writing<br/>草拟 · 引用插入<br/>结构重组 · 导出"]
      C_PL["Planning<br/>项目 · 任务 · 里程碑<br/>回顾 · 日程"]
      C_GM["Graph / Memory<br/>对象检索 · 回链<br/>视图投影 · 记忆"]
      C_IN["Integration<br/>GitHub · Search<br/>Calendar · Cloud"]
      C_SO["Sensitive Ops<br/>删除 · 批量覆盖<br/>外部发布 · 密钥"]
    end

    subgraph CapInfra["Capability Infrastructure"]
      Registry["Capability Registry<br/>id · domain · kind · exposure<br/>scope · confirmation · audit"]
      Policy["Policy Engine<br/>Permission · Rate Limit"]
      MCP_S["MCP Server<br/>Expose to External"]
      MCP_C["MCP Client<br/>Consume External"]
    end
  end
  CAP:::capLayer

  %% ============================================================
  %% LAYER 4 — DOMAIN DATA LAYER  领域数据层
  %% ============================================================
  subgraph DATA["📦  L4 · Domain Data Layer — 领域数据层"]
    direction LR
    subgraph ObjectFamilies["Six Object Families"]
      OF_Dir["🧭 方向对象<br/>Vision · Direction<br/>Theme · Goal · Commitment"]
      OF_Exec["⚡ 执行对象<br/>Project · Milestone<br/>Task · Directive"]
      OF_Input["📥 输入对象<br/>Article · Book · Podcast<br/>Video · Asset · Feed"]
      OF_Think["💭 思考对象<br/>Highlight · Note<br/>ResearchQuestion · Claim"]
      OF_Output["📤 产出对象<br/>ResearchArtifact · Document<br/>Post · Draft · Deck"]
      OF_Memory["⏳ 记忆对象<br/>JournalEntry · Review<br/>AgentSession · ActionLog"]
    end

    subgraph DataInfra["Data Infrastructure"]
      ObjIndex["object_index<br/>Global Lookup Table"]
      Links["links<br/>Unified Relation Table<br/>8 Semantic Families"]
      Events["events<br/>Immutable Append-Only<br/>Object Lifecycle"]
      FTS["FTS5 Full-Text Search<br/>Cross-Object"]
      ViewModels["app-viewmodels<br/>Query → UI Binding"]
      DataProto["data-protocol<br/>Cursor · Query · Mutation"]
    end

    subgraph FeatureModules["Feature Modules"]
      F_Task["feature-task<br/>Lifecycle · Today Planner<br/>Focus · Review · Intent Parser"]
      F_Journal["feature-journal<br/>Five-Layer Model<br/>Privacy · Summary · Insight"]
      F_Reader["feature-reader<br/>Content Pipeline (4 layers)<br/>Transcription · Translation<br/>Highlight · Subscription"]
      F_Vision["feature-vision<br/>Version Chain · Directive<br/>Reminder · Onboarding"]
      F_Workbench["feature-workbench<br/>Research Workspace<br/>Writing Workbench"]
    end
  end
  DATA:::dataLayer

  %% ============================================================
  %% LAYER 5 — STORAGE & SYNC LAYER  存储与同步层
  %% ============================================================
  subgraph STORE["💾  L5 · Storage & Sync Layer — 存储与同步层"]
    direction LR
    subgraph LocalStorage["Local Storage (Truth)"]
      FS["File System<br/>sources/ → User Truth<br/>wiki/ → AI Compiled<br/>.orbit/ → Metadata"]
      SQLite["SQLite<br/>Object Tables · Index<br/>Links · Events · FTS"]
    end

    subgraph SyncEngine["Sync Engine (sync-core)"]
      LWW["LWW Merge<br/>Structured Objects"]
      ThreeWay["3-Way Merge<br/>Long Documents"]
      BlobCAS["Blob CAS<br/>Content-Addressed<br/>Immutable Blobs"]
      E2E["E2E Encryption<br/>AES-256-GCM"]
      Outbox["Outbox Pattern<br/>Offline Queue"]
    end

    subgraph PlatformPorts["Platform Contracts (7 Ports)"]
      P_DB["DatabasePort"]
      P_WS["WorkspacePort"]
      P_Sync["SyncPort"]
      P_Notify["NotificationPort"]
      P_Auth["AuthPort"]
      P_Secure["SecureStorePort"]
      P_Cap["CapabilityHostPort"]
    end
  end
  STORE:::storageLayer

  %% ============================================================
  %% SERVER — 服务端（零知识中继）
  %% ============================================================
  subgraph SERVER["☁️  Server — 零知识加密中继"]
    direction LR
    subgraph ServerRoutes["Hono HTTP API"]
      S_Auth["Auth<br/>Register · Session"]
      S_Device["Device<br/>Register · Pair · List"]
      S_Sync["Sync<br/>Cursor · Commit · Pull"]
      S_Blob["Blob<br/>Upload · Download"]
      S_Admin["Admin<br/>GDPR Export · Delete"]
    end
    subgraph ServerInfra["Infrastructure Ports"]
      S_PG["PostgreSQL<br/>Accounts · Devices<br/>Cursors · Audit"]
      S_R2["R2 / S3<br/>Encrypted Blob Store"]
      S_WS["WebSocket + APNs<br/>Change Notification"]
      S_Token["Token Port<br/>JWT Mint · Verify"]
    end
  end
  SERVER:::serverBox

  %% ============================================================
  %% CONNECTIONS — 层间连接
  %% ============================================================
  EXP -->|"UI events · User input"| AGENT
  AGENT -->|"Capability calls"| CAP
  CAP -->|"Domain operations"| DATA
  DATA -->|"Read / Write"| STORE
  STORE <-->|"Encrypted sync"| SERVER

  %% Agent reads data directly for context
  AGENT -.->|"Context read"| DATA
  %% UI reads viewmodels from data layer
  EXP -.->|"ViewModel queries"| DATA
```

## 三大核心流：输入 → 思考 → 输出

```mermaid
flowchart LR
  classDef inputStyle fill:#1b4332,stroke:#40916c,color:#d8f3dc,stroke-width:2px
  classDef thinkStyle fill:#1d3557,stroke:#457b9d,color:#a8dadc,stroke-width:2px
  classDef outputStyle fill:#6b2737,stroke:#e63946,color:#f1faee,stroke-width:2px
  classDef agentStyle fill:#2d1b69,stroke:#7b2cbf,color:#e0aaff,stroke-width:2px

  subgraph INPUT["📥 输入流 Input Flow"]
    direction TB
    I1["RSS · 网页 · 社媒日报"]
    I2["书籍 · 播客 · 视频"]
    I3["文件 · 语音 · 剪藏"]
    I1 --> Fetch["Fetch & Normalize"]
    I2 --> Fetch
    I3 --> Fetch
    Fetch --> Extract["Extract & Render"]
    Extract --> Translate["Translation Layer<br/>(parallel, not overwrite)"]
    Translate --> Store["Store to sources/library/"]
  end
  INPUT:::inputStyle

  subgraph THINK["💭 思考流 Thinking Flow"]
    direction TB
    H["Highlight 高亮"]
    N["Note 笔记"]
    RQ["Research Question 研究问题"]
    RS["Research Session 研究会话"]
    RC["Research Conclusion 研究结论"]
    J["Journal 手记 · Review 回顾"]
    H --> N
    N --> RQ
    RQ --> RS
    RS --> RC
    RC --> J
    J -.->|"feedback loop"| RQ
  end
  THINK:::thinkStyle

  subgraph OUTPUT["📤 输出流 Output Flow"]
    direction TB
    OL["Outline 大纲"]
    DR["Draft 草稿"]
    RE["Revision 修订"]
    PU["Publish 发布"]
    VA["Variants 变体<br/>Newsletter · Post · Talk · Script"]
    OL --> DR
    DR --> RE
    RE --> PU
    RE --> VA
  end
  OUTPUT:::outputStyle

  INPUT -->|"Route: highlight → note<br/>→ research → task"| THINK
  THINK -->|"Artifact + Notes<br/>→ Writing Workbench"| OUTPUT
  OUTPUT -.->|"Feedback → Review<br/>→ New task/research"| THINK

  subgraph AGENT_COORD["🤖 Agent 全程协调"]
    direction TB
    AG["Orchestrator<br/>意图路由 · 上下文组装 · 风险关口"]
  end
  AGENT_COORD:::agentStyle

  AG -.->|"辅助发现 · 推荐 · 转写"| INPUT
  AG -.->|"Gap 分析 · 证据管理 · 综合"| THINK
  AG -.->|"大纲生成 · 改写 · 引用"| OUTPUT
```

## 对象网络：六族 · 八类关系

```mermaid
graph TB
  classDef direction fill:#1a1a2e,stroke:#e94560,color:#eee,stroke-width:2px
  classDef execution fill:#16213e,stroke:#0f3460,color:#eee,stroke-width:2px
  classDef input fill:#1b4332,stroke:#40916c,color:#d8f3dc,stroke-width:2px
  classDef thinking fill:#1d3557,stroke:#457b9d,color:#a8dadc,stroke-width:2px
  classDef product fill:#6b2737,stroke:#e63946,color:#f1faee,stroke-width:2px
  classDef memory fill:#2d1b69,stroke:#7b2cbf,color:#e0aaff,stroke-width:2px
  classDef infra fill:#111,stroke:#555,color:#aaa,stroke-width:1px

  subgraph DIR["🧭 方向对象"]
    Vision["Vision 愿景"]
    Direction["Direction 方向"]
    Theme["Theme 主题"]
    Goal["Goal 目标"]
    Vision --> Direction --> Theme --> Goal
  end
  DIR:::direction

  subgraph EXEC["⚡ 执行对象"]
    Project["Project 项目"]
    Milestone["Milestone 里程碑"]
    Task["Task 任务"]
    Directive["Directive 指令"]
    Project --> Milestone --> Task
    Directive -.-> Task
  end
  EXEC:::execution

  subgraph INP["📥 输入对象"]
    Article["Article 文章"]
    Book["Book 书籍"]
    Podcast["Podcast 播客"]
    Asset["Asset 资源"]
  end
  INP:::input

  subgraph THK["💭 思考对象"]
    Highlight["Highlight 高亮"]
    Note["Note 笔记"]
    ResearchQ["Research Question"]
    Claim["Claim 论点"]
  end
  THK:::thinking

  subgraph PRD["📤 产出对象"]
    Artifact["Research Artifact"]
    Document["Document 文档"]
    Post["Post 帖子"]
    Draft["Draft 草稿"]
  end
  PRD:::product

  subgraph MEM["⏳ 记忆对象"]
    JournalEntry["Journal Entry"]
    ReviewObj["Review 回顾"]
    AgentSession["Agent Session"]
  end
  MEM:::memory

  %% Cross-family relations (8 semantic families)
  Goal -->|"suggests"| Task
  Article -->|"annotated_by"| Highlight
  Highlight -->|"annotated_by"| Note
  Note -->|"supports"| ResearchQ
  ResearchQ -->|"produces"| Artifact
  Artifact -->|"informs"| Draft
  Draft -->|"outputs"| Document
  Task -->|"outputs"| Document
  JournalEntry -->|"reflects_on"| Project
  ReviewObj -->|"reviews"| Task
  Theme -->|"context_for"| Project
  Claim -->|"evidenced_by"| Article
  AgentSession -->|"discusses"| Task

  subgraph UNIFIED_INDEX["🗄️ Unified Infrastructure"]
    OI["object_index — 全局索引"]
    LK["links — 统一关系表"]
    EV["events — 不可变事件流"]
  end
  UNIFIED_INDEX:::infra
```

## Monorepo 包依赖拓扑

```mermaid
graph BT
  classDef app fill:#e94560,stroke:#1a1a2e,color:#fff,stroke-width:2px
  classDef feature fill:#533483,stroke:#e94560,color:#eee,stroke-width:2px
  classDef core fill:#0f3460,stroke:#533483,color:#eee,stroke-width:2px
  classDef infra fill:#16213e,stroke:#0f3460,color:#eee,stroke-width:2px
  classDef platform fill:#1a1a2e,stroke:#e94560,color:#eee,stroke-width:2px

  %% Apps
  Desktop["apps/desktop"]:::app
  WebApp["apps/web"]:::app
  iOSApp["apps/ios"]:::app
  ServerApp["apps/server"]:::app

  %% Feature packages
  F_Task["feature-task"]:::feature
  F_Journal["feature-journal"]:::feature
  F_Reader["feature-reader"]:::feature
  F_Vision["feature-vision"]:::feature
  F_Workbench["feature-workbench"]:::feature

  %% Core packages
  AgentCore["agent-core"]:::core
  CapCore["capability-core"]:::core
  Domain["domain"]:::core
  DataProto["data-protocol"]:::core
  SyncCore["sync-core"]:::core
  ObjGraph["object-graph"]:::core
  WsCore["workspace-core"]:::core
  AppVM["app-viewmodels"]:::core
  ReaderRes["reader-resolvers"]:::core

  %% Infrastructure packages
  DbSchema["db-schema"]:::infra
  SrvCore["server-core"]:::infra
  SrvDbSchema["server-db-schema"]:::infra
  SrvInfra["server-infra"]:::infra

  %% UI packages
  UITokens["ui-tokens"]:::platform
  UIDom["ui-dom"]:::platform
  UINative["ui-native"]:::platform
  ConvUI["conversation-ui"]:::platform
  EditorDom["editor-dom"]:::platform
  I18n["i18n"]:::platform

  %% Platform packages
  PlatContracts["platform-contracts"]:::platform
  PlatElectron["platform-electron"]:::platform
  PlatWeb["platform-web"]:::platform
  PlatIOS["platform-ios"]:::platform

  %% Dependencies: Apps → Features/UI
  Desktop --> F_Task & F_Journal & F_Reader & F_Vision & F_Workbench
  Desktop --> ConvUI & EditorDom & UIDom & I18n
  Desktop --> PlatElectron & AgentCore
  WebApp --> F_Task & F_Journal & F_Reader & F_Vision & F_Workbench
  WebApp --> ConvUI & EditorDom & UIDom & I18n
  WebApp --> PlatWeb & AppVM
  iOSApp --> UINative & I18n & PlatIOS
  ServerApp --> SrvCore & SrvDbSchema & SrvInfra

  %% Dependencies: Features → Core
  F_Task --> Domain & DataProto
  F_Journal --> Domain & DataProto
  F_Reader --> Domain & DataProto & ReaderRes
  F_Vision --> Domain & DataProto
  F_Workbench --> Domain & DataProto

  %% Dependencies: Core → Core
  AgentCore --> CapCore & Domain & DataProto
  AppVM --> Domain & DataProto
  ObjGraph --> Domain & DataProto
  CapCore --> Domain
  ReaderRes --> Domain

  %% Dependencies: Core → Infrastructure
  DataProto --> Domain
  DbSchema --> Domain
  SyncCore --> Domain & DataProto
  WsCore --> Domain

  %% Dependencies: Platform → Contracts
  PlatElectron --> PlatContracts
  PlatWeb --> PlatContracts
  PlatIOS --> PlatContracts
  PlatContracts --> Domain

  %% UI dependencies
  UIDom --> UITokens
  UINative --> UITokens
```

## Agent 内部架构

```mermaid
graph TB
  classDef trigger fill:#1b4332,stroke:#40916c,color:#d8f3dc,stroke-width:2px
  classDef orch fill:#e94560,stroke:#1a1a2e,color:#fff,stroke-width:2px
  classDef agent fill:#533483,stroke:#e94560,color:#eee,stroke-width:2px
  classDef infra fill:#16213e,stroke:#0f3460,color:#eee,stroke-width:2px
  classDef memory fill:#2d1b69,stroke:#7b2cbf,color:#e0aaff,stroke-width:2px

  subgraph Triggers["Trigger Layer 触发层"]
    T1["UI Action 用户操作"]
    T2["Reader Context 阅读上下文"]
    T3["Research Space 研究空间"]
    T4["Writing Brief 写作简报"]
    T5["Journal Review 日记回顾"]
    T6["Scheduled Timer 定时触发"]
    T7["Background Event 后台事件"]
  end
  Triggers:::trigger

  subgraph Orch["Orchestrator 编排器"]
    O1["1. Intent Routing 意图路由"]
    O2["2. Context Assembly 上下文组装"]
    O3["3. Dispatch Decision 调度决策<br/>(same · sub · parallel · async)"]
    O4["4. Result Archival 结果归档"]
    O5["5. Risk Gate 风险关口"]
    O1 --> O2 --> O3 --> O4 --> O5
  end
  Orch:::orch

  subgraph Agents["Domain Agents 领域 Agent"]
    direction LR
    A1["🎯 Planner"]
    A2["📖 Reader"]
    A3["🔬 Research"]
    A4["✍️ Writing"]
    A5["📓 Review"]
    A6["🕸️ Graph"]
    A7["⚙️ Ops"]
  end
  Agents:::agent

  subgraph MemorySystem["Memory System 记忆系统"]
    M0["L0 Turn Scratch<br/>当前决策信息"]
    M1["L1 Session Context<br/>本次会话 + 相邻轮次"]
    M2["L2 Object Memory<br/>结构 + 关系 (来自领域层)"]
    M3["L3 Long-term Fact<br/>提取/确认的事实"]
    M4["L4 Compressed Handoff<br/>会话间桥梁"]
    M5["L5 Archive/Search<br/>可查询历史"]
    M0 --> M1 --> M2 --> M3 --> M4 --> M5
  end
  MemorySystem:::memory

  subgraph AgentTools["Tool & Safety Infrastructure"]
    Tools["Tool Registry<br/>50+ tools across domains"]
    Safety["Safety Gate<br/>12 rules · Approval chain"]
    Audit["Audit Log<br/>Every action recorded"]
    SkillSys["Skill System<br/>Builtin · User · MCP-discovered"]
    TeamSys["Team System<br/>Multi-agent collaboration"]
  end
  AgentTools:::infra

  subgraph LLMLayer["LLM Provider Layer"]
    OpenAI["OpenAI"]
    Anthropic["Anthropic"]
    Ollama["Ollama (Local)"]
    CredPool["Credential Pool<br/>Priority · Rotation · Fallback"]
    CostTrack["Cost Tracker · Rate Limiter"]
  end
  LLMLayer:::infra

  Triggers --> Orch
  Orch --> Agents
  Agents --> AgentTools
  Agents <--> MemorySystem
  Agents --> LLMLayer
  AgentTools --> |"Capability calls"| CAP_REG["Capability Registry<br/>(Layer 3)"]
```

## 实施路径：Phase 依赖图

```mermaid
graph LR
  classDef done fill:#40916c,stroke:#1b4332,color:#fff,stroke-width:2px
  classDef critical fill:#e94560,stroke:#1a1a2e,color:#fff,stroke-width:2px
  classDef normal fill:#0f3460,stroke:#533483,color:#eee,stroke-width:2px
  classDef advanced fill:#533483,stroke:#e94560,color:#eee,stroke-width:2px

  P0["Phase 0<br/>🏗️ 数据基础设施<br/>DB · Repository · Ports"]:::critical
  P1["Phase 1<br/>✅ Task 端到端<br/>ViewModel · CRUD · UI"]:::critical
  P2["Phase 2<br/>📓 Journal + Vision<br/>日记 · 愿景贯通"]:::normal
  P3["Phase 3<br/>📖 Reader 管道<br/>获取 · 存储 · 展示"]:::normal
  P4["Phase 4<br/>📥 Inbox + 对象网络<br/>信息入口 · 关联"]:::normal
  P5["Phase 5<br/>🤖 Agent 集成<br/>LLM · 对话 · 工具"]:::normal
  P6["Phase 6<br/>☁️ 服务端 + 同步<br/>API · E2E · Auth"]:::normal
  P7["Phase 7<br/>✍️ 编辑器 + 写作<br/>Block Editor · Notes"]:::normal
  P8["Phase 8<br/>🔍 搜索 · i18n · iOS<br/>打磨 · 三端完善"]:::advanced
  P9["Phase 9<br/>🧠 高级 Agent<br/>全域 Agent · MCP · 编排"]:::advanced

  P0 --> P1
  P1 --> P2
  P2 --> P3
  P3 --> P4
  P4 --> P5
  P2 --> P5
  P5 --> P6
  P0 --> P6
  P4 --> P7
  P7 --> P8
  P6 --> P8
  P5 --> P9

  style P0 stroke-width:3px
  style P1 stroke-width:3px
```

---

*此文档由分析 `docs/orbit-reboot/` 全部 19 篇设计文档 + 32 个 packages 的实际代码后生成。*
*最后更新：2026-04-13*
