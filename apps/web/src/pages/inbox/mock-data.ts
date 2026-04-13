// Mock data for the Inbox (收件箱) UI

export type InboxItemType = 'reading' | 'note' | 'todo' | 'agent-review';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  // Reading
  source?: string;
  url?: string;
  articleContent?: string;
  // Note
  noteContent?: string;
  // Todo
  todoStatus?: 'pending' | 'in_progress' | 'done';
  todoDueDate?: string;
  todoProject?: string;
  todoPriority?: 'low' | 'medium' | 'high' | 'urgent';
  // Agent review
  agentName?: string;
  agentAction?: string;
  agentConversation?: { role: 'user' | 'agent'; content: string; time: string }[];
  pendingActions?: { id: string; label: string; description: string }[];
}

export const MOCK_INBOX_ITEMS: InboxItem[] = [
  // ── Reading ────────────────────────────────────────────────
  {
    id: 'inbox-r1',
    type: 'reading',
    title: 'Transformer 架构的最新进展与实践指南',
    preview: '本文综述了 2026 年以来 Transformer 架构在效率、长上下文和多模态方向的关键突破……',
    timestamp: '2026-04-13T09:30:00Z',
    unread: true,
    source: 'AI 前沿周刊',
    url: 'https://example.com/ai-weekly/transformer',
    articleContent: `近年来，Transformer 架构已经从自然语言处理扩展到了计算机视觉、音频生成、机器人控制等多个领域。本文将从三个维度梳理最新进展。

第一，效率优化。Flash Attention 3.0 引入了分块稀疏注意力机制，在保持精度的同时将推理速度提升了 4 倍。Ring Attention 则允许在多设备间高效处理超长序列，使百万级 token 的上下文窗口成为可能。

第二，架构创新。State Space Models (SSM) 与 Transformer 的混合架构正在崛起。Mamba-2 架构通过选择性状态空间层替代部分注意力层，在语言建模任务上达到了与纯 Transformer 相当的性能，同时推理吞吐量提升了 3 倍。

第三，多模态融合。统一的 Transformer 编码器正在取代分离式的多模态管线。最新的 Gemini Ultra 2 和 GPT-5 都采用了原生多模态架构，能在图像、文本、音频和视频之间无缝推理。这种架构使得跨模态的 few-shot 学习成为了可能。

展望未来，Transformer 架构仍然是深度学习的基石，但其形态正在快速演变。工程师需要密切关注效率工具链的发展，以便在实际项目中充分利用这些进步。`,
  },
  {
    id: 'inbox-r2',
    type: 'reading',
    title: 'Building Resilient Distributed Systems with Rust',
    preview: 'A practical guide to circuit breakers, retry strategies, and observability in Rust…',
    timestamp: '2026-04-12T14:00:00Z',
    unread: false,
    source: 'Systems Weekly',
    url: 'https://example.com/systems-weekly/rust-resilience',
    articleContent: `In the era of cloud-native computing, building reliable distributed systems has become both more important and more challenging. Rust's ownership model and zero-cost abstractions provide unique advantages for writing concurrent, fault-tolerant services.

Error handling in distributed systems requires explicit strategies. The Result type in Rust forces developers to handle every failure path, eliminating an entire class of runtime surprises. Combined with the thiserror and anyhow crates, you can build rich error hierarchies that carry context across service boundaries.

Circuit breakers should be the first line of defense in any distributed architecture. By tracking failure rates and temporarily halting requests to unhealthy downstream services, you prevent cascade failures that can bring down entire clusters. Libraries like tower provide composable middleware for implementing these patterns.

Observability is equally critical. Structured logging with tracing, metrics exported to Prometheus, and distributed traces via OpenTelemetry form the three pillars of production visibility. In Rust, the tracing ecosystem integrates seamlessly with async runtimes like Tokio, giving you per-request spans with minimal overhead.`,
  },
  {
    id: 'inbox-r3',
    type: 'reading',
    title: '如何构建自己的知识管理系统',
    preview: '一套从信息捕获到知识输出的完整方法论，结合 Zettelkasten 与渐进式总结……',
    timestamp: '2026-04-11T10:15:00Z',
    unread: true,
    source: '效率工具箱',
    url: 'https://example.com/productivity/pkm',
    articleContent: `知识管理不是工具问题，而是工作流问题。无论你使用 Notion、Obsidian 还是纯文本文件，关键在于建立一套可持续的信息处理流程。

第一步是捕获。将每天遇到的有价值信息快速记录下来，不要试图在捕获阶段就完成组织。使用统一的收件箱（inbox）作为所有信息的入口。

第二步是处理。定期清理收件箱，对每条信息做出决策：删除、归档、转化为笔记、或创建待办事项。这个过程应该是日常习惯的一部分。

第三步是连接。好的知识管理系统不是文件夹层级，而是网状结构。通过双向链接和标签将相关概念连接起来，让知识之间产生化学反应。

第四步是输出。知识只有在被使用时才有价值。定期回顾笔记，将积累的洞见转化为文章、演讲或实际项目决策。`,
  },

  // ── Note ────────────────────────────────────────────────────
  {
    id: 'inbox-n1',
    type: 'note',
    title: 'Orbit 架构设计思路',
    preview: '核心理念：以意图为驱动的个人操作系统，融合任务管理、阅读和 AI 代理……',
    timestamp: '2026-04-13T08:00:00Z',
    unread: true,
    noteContent: `Orbit 的核心理念是打造一个以意图为驱动的个人操作系统。

关键设计决策：
1. 统一收件箱：所有输入（阅读、任务、笔记、AI 产出）汇聚到一个地方，降低认知负担。
2. 意图引擎：用户表达目标而非操作，系统自动拆解为可执行的任务序列。
3. AI 代理协作：Agent 可以独立完成调研、草拟、代码审查等工作，但关键决策需要用户审批。
4. 渐进式信息处理：从快速捕获 → 整理 → 深度思考 → 输出，每个阶段有对应的 UI 模式。

技术栈选择：
- 前端：React + TypeScript + TailwindCSS
- UI 组件：HeroUI
- 构建：Turborepo monorepo
- 后端（规划中）：Rust + SQLite`,
  },
  {
    id: 'inbox-n2',
    type: 'note',
    title: '本周学习：Rust 异步编程模型',
    preview: 'Tokio 运行时、Future trait、Pin/Unpin 的关系总结……',
    timestamp: '2026-04-12T20:30:00Z',
    unread: false,
    noteContent: `Rust 异步编程核心概念梳理：

1. Future trait：代表一个异步计算。poll() 方法要么返回 Ready(value)，要么返回 Pending。
2. async/await 语法：编译器将 async fn 转换为实现了 Future 的状态机。
3. Tokio 运行时：提供任务调度器和异步 I/O 驱动。spawn() 将 Future 提交给运行时执行。
4. Pin<T>：确保自引用结构体不会被移动。大部分情况下用 Box::pin() 即可。

实践要点：
- 避免在异步函数中持有 MutexGuard 跨越 .await 点
- 使用 tokio::select! 处理竞争的异步操作
- Channel（mpsc/oneshot）是异步任务间通信的首选方式`,
  },
  {
    id: 'inbox-n3',
    type: 'note',
    title: '产品灵感：渐进式摘要法',
    preview: 'Tiago Forte 的 Progressive Summarization 方法可以应用到 Orbit 的阅读模块……',
    timestamp: '2026-04-10T16:45:00Z',
    unread: false,
    noteContent: `渐进式摘要法（Progressive Summarization）核心思想：

每次重新访问一篇笔记时，增加一层"压缩"：
Layer 0：原文全文
Layer 1：加粗关键段落
Layer 2：高亮加粗中最重要的句子
Layer 3：用自己的话写一句话总结
Layer 4：将洞见融入自己的输出

应用到 Orbit：
- 阅读模块可以支持多层高亮
- 每次打开已读文章时，提示用户做下一层摘要
- AI 可以辅助生成 Layer 3 的候选总结
- 与笔记模块联动，将 Layer 4 输出为独立笔记`,
  },

  // ── Todo ────────────────────────────────────────────────────
  {
    id: 'inbox-t1',
    type: 'todo',
    title: '完成 Inbox 页面开发',
    preview: '实现收件箱的列表视图和详情面板，包括阅读、笔记、待办、AI 审核四种类型……',
    timestamp: '2026-04-13T07:00:00Z',
    unread: true,
    todoStatus: 'in_progress',
    todoDueDate: '2026-04-15',
    todoProject: 'Orbit MVP',
    todoPriority: 'high',
  },
  {
    id: 'inbox-t2',
    type: 'todo',
    title: '调研 SQLite WASM 方案',
    preview: '评估 wa-sqlite、sql.js 和 cr-sqlite 三个方案的性能和兼容性……',
    timestamp: '2026-04-12T11:00:00Z',
    unread: false,
    todoStatus: 'pending',
    todoDueDate: '2026-04-18',
    todoProject: 'Orbit MVP',
    todoPriority: 'medium',
  },
  {
    id: 'inbox-t3',
    type: 'todo',
    title: '写技术博客：Turborepo 实践心得',
    preview: '总结 Orbit 项目中使用 Turborepo 的经验，包括缓存策略和 CI 优化……',
    timestamp: '2026-04-11T09:00:00Z',
    unread: false,
    todoStatus: 'pending',
    todoDueDate: '2026-04-20',
    todoProject: '技术写作',
    todoPriority: 'low',
  },
  {
    id: 'inbox-t4',
    type: 'todo',
    title: '修复 TopBar 搜索框焦点问题',
    preview: '按 ⌘F 后搜索框获取焦点，但 Escape 关闭后焦点没有回到之前的元素……',
    timestamp: '2026-04-10T14:30:00Z',
    unread: false,
    todoStatus: 'done',
    todoDueDate: '2026-04-12',
    todoProject: 'Orbit MVP',
    todoPriority: 'medium',
  },

  // ── Agent Review ───────────────────────────────────────────
  {
    id: 'inbox-a1',
    type: 'agent-review',
    title: '代码审查：任务引擎重构',
    preview: 'Agent 完成了任务状态机的重构，需要你审核变更……',
    timestamp: '2026-04-13T10:00:00Z',
    unread: true,
    agentName: 'Code Review Agent',
    agentAction: '代码审查',
    agentConversation: [
      { role: 'user', content: '请审查任务引擎的状态机重构 PR，重点关注状态转换的正确性和边界情况。', time: '2026-04-13T09:30:00Z' },
      { role: 'agent', content: '我已经审查了 PR #142 的全部变更。总体评价：代码质量良好，状态转换逻辑清晰。发现了 3 个需要注意的点：\n\n1. `transition()` 方法缺少从 blocked → focused 的直接转换路径，需要确认是否为设计意图。\n2. 单元测试覆盖了主要路径，但缺少并发状态转换的测试。\n3. 建议将状态转换规则提取为配置，便于后续扩展。', time: '2026-04-13T09:45:00Z' },
      { role: 'user', content: 'blocked → focused 确实不应该直接转换，需要先解除阻塞。其他两点同意，请生成修复建议。', time: '2026-04-13T09:50:00Z' },
      { role: 'agent', content: '好的，我已经准备了以下修改建议：\n\n1. 在 `VALID_TRANSITIONS` 常量中添加注释说明 blocked 状态的约束。\n2. 新增 3 个并发测试用例。\n3. 将转换规则重构为 `TransitionConfig` 类型。\n\n请审核以下待执行操作。', time: '2026-04-13T10:00:00Z' },
    ],
    pendingActions: [
      { id: 'act-1', label: '添加状态约束注释', description: '在 VALID_TRANSITIONS 中为 blocked 状态添加设计说明注释' },
      { id: 'act-2', label: '新增并发测试', description: '添加 3 个测试用例覆盖并发状态转换场景' },
      { id: 'act-3', label: '提取转换配置', description: '将状态转换规则重构为独立的 TransitionConfig 类型' },
    ],
  },
  {
    id: 'inbox-a2',
    type: 'agent-review',
    title: '调研报告：本地优先数据同步方案',
    preview: 'Research Agent 完成了 CRDT 和操作日志两种方案的对比分析……',
    timestamp: '2026-04-12T16:00:00Z',
    unread: true,
    agentName: 'Research Agent',
    agentAction: '调研分析',
    agentConversation: [
      { role: 'user', content: '请调研适合 Orbit 的本地优先数据同步方案，重点比较 CRDT 和操作日志两种路线。', time: '2026-04-12T14:00:00Z' },
      { role: 'agent', content: '调研完成。以下是两种方案的对比：\n\nCRDT 方案（如 Automerge、Yjs）：\n优点：自动冲突解决、支持离线协作、数学上保证最终一致性。\n缺点：内存占用较大、某些数据结构的合并语义不直观、存储开销高。\n\n操作日志方案（如 cr-sqlite、ElectricSQL）：\n优点：与现有 SQL 模型兼容、存储效率高、查询灵活。\n缺点：冲突解决需要自定义策略、实现复杂度较高。\n\n建议：Orbit 以结构化数据为主（任务、笔记元数据），推荐 cr-sqlite 方案。对于富文本笔记内容，可以局部引入 Yjs。', time: '2026-04-12T15:30:00Z' },
      { role: 'agent', content: '我已经整理了详细的技术对比文档和推荐的实施路线图。是否需要我创建对应的任务卡片？', time: '2026-04-12T16:00:00Z' },
    ],
    pendingActions: [
      { id: 'act-4', label: '创建同步方案评估任务', description: '在 Orbit MVP 项目中创建"评估 cr-sqlite 集成"任务' },
      { id: 'act-5', label: '保存调研文档', description: '将调研报告保存为笔记，关联到 Orbit MVP 项目' },
    ],
  },
];
