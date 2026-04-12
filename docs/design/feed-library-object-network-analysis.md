# Feed 与 Library 在对象网络中的设计思考

> 本文思考旧 Orbit 的 RAG 相关性评分方案与新 Orbit 的对象网络方案之间的根本差异，
> 以及 Feed 和 Library 如何在"一切都是对象"的新范式下重新定位。

---

## 一、旧 Orbit 的 RIG 模式：向量空间中的平面相关性

旧 Orbit 的信号/噪音判断本质上是一个 **RAG（Retrieval-Augmented Generation）模式**：

```
新 Feed Item → 生成 Embedding → KNN 搜索 Library 的 Chunk 向量 → 余弦相似度 → 评分
```

这个方案有三个隐含假设：

1. **相关性 = 语义向量距离**。一篇新文章和 Library 中某些段落在 embedding 空间里"距离近"，就被认为是高信号。
2. **Library 是参照系，Feed 是待评判者**。评分永远是"Feed 相对于 Library"的单向比较，Library 本身不被评分。
3. **评分发生在 chunk 级别**。系统看到的是 256 token 的文本片段之间的距离，而不是"这篇文章和用户正在推进的项目有什么关系"。

这些假设在"阅读器 + 知识工具"的旧产品里是够用的。但在新 Orbit 的"Agent-first 个人操作系统"里，它们三个全都不再成立。

### 为什么不成立

**假设 1 失效**：向量相似度只是相关性的一个信号维度。用户正在做一个"Orbit Reboot 架构设计"的项目，一篇关于"如何设计 Agent Memory"的文章，即使和 Library 中的文章在向量空间距离不近（因为 Library 里之前没有相关内容），也应该被标记为高信号——因为它和用户当前的 `project` 对象、`research_space` 对象、`goal` 对象形成了明确的支撑关系。向量相似度捕捉的是"内容像不像"，而不是"对用户当前工作有没有用"。

**假设 2 失效**：在对象网络里，"Library 是参照系"这个概念本身就不存在。对象网络中的一切——项目、任务、研究空间、愿景、笔记、高亮——都可以是判断 Feed 信号的上下文。一篇 Feed 文章可能和 Library 中没有任何近似内容，但它精准回答了用户在 `research_space` 中提出的一个 `research_question`，或者它讨论的技术方案正好是用户某个 `task` 的阻塞项。

**假设 3 失效**：chunk 级别的评分丢失了对象级别的语义。当 Agent 需要判断"这篇 Feed 文章对用户有没有价值"时，它需要的不是"这段文字和某个 256 token 的 chunk 余弦相似度是 0.72"，而是"这篇文章 `supports` 用户正在进行的某个 `research_space`"或"这篇文章 `informs` 用户当前关注的 `theme`"。

---

## 二、新 Orbit 的范式：对象网络中的关系发现

新 Orbit 设计文档的核心主张（00 总纲 §3）：

> **功能不是中心，对象才是中心。**

这意味着 Feed 和 Library **不是两个模块**，而是内容对象进入对象网络的 **两种入口模式**：

### Feed：被动发现入口

Feed 中的每一条内容，在进入系统的那一刻就是一个 `content_item` 对象。它通过 `source_endpoint` 对象（RSS Feed / YouTube Channel / Podcast Feed）的 `feeds` 关系自动产生。它天然就在对象网络中有位置：

```
source_endpoint --feeds--> content_item
```

Agent 判断这个 `content_item` 是否是信号，不是去做向量搜索，而是**在对象网络中寻找关系路径**：

- 这个 `content_item` 的主题 `about` 用户的哪些 `theme` / `goal`？
- 这个 `content_item` 的内容 `supports` / `informs` 哪些活跃的 `project` / `research_space`？
- 这个 `content_item` 是否 `answers_for` 用户某个未解决的 `research_question`？
- 这个 `content_item` 的作者/来源是否和用户已确认的高价值 `source_endpoint` 有 `relates_to` 关系？

这些判断产生的不是一个 0-1 的浮点分数，而是**一组带语义的 proposed links**，每条 link 都有 `why_summary`、`evidence_refs` 和 `confidence`。Agent 可以解释"为什么推荐这篇文章"，而不只是说"相似度 0.72"。

### Library：主动策展入口

Library 中的内容是用户显式保存的。它从 `content_item` 进一步派生为具体的领域对象（`article`、`book`），并在保存的那一刻获得更深的对象网络身份：

```
content_item --derived_from--> article
article --supports--> research_space
article --context_for--> project
article --tagged_with--> tag
highlight --excerpted_from--> article
note --annotated_by--> highlight
```

Library 内容进入深度处理不是因为"它在一个叫 Library 的模块里"，而是因为**用户的保存动作本身就是一个 `origin: 'human'` 的关系确认**——用户在说"这个对象值得进入我的工作记忆网络"。

### 关键洞察：Feed 和 Library 的区别是 `origin` 和 `link density`

| 维度 | Feed 内容 | Library 内容 |
|------|----------|-------------|
| 进入方式 | 自动（Agent 抓取） | 主动（用户保存） |
| 初始 origin | `ai` / `system` | `human` |
| 初始 link density | 稀疏（仅 `feeds` 关系） | 密集（user 确认的多重关系） |
| Agent 角色 | 策展人：发现关系、提议链接 | 助手：深度处理、辅助理解 |
| 处理深度 | 轻量（摘要 + proposed links） | 深度（全文索引 + 实体提取 + 关系编织） |
| 在对象网络中的状态 | 边缘节点（可能被忽略） | 核心节点（被多重关系锚定） |

从这个视角看，Library 不是"一个存放收藏的文件夹"，而是**对象网络中 link density 高、被用户确认锚定的核心区域**。Feed 不是"一个未读列表"，而是**对象网络边缘持续涌入的候选节点，等待 Agent 发现它们与核心区域的潜在关系**。

---

## 三、旧方案 vs 新方案的根本分歧

| 维度 | 旧 Orbit（RAG/向量） | 新 Orbit（对象网络） |
|------|---------------------|---------------------|
| 相关性的定义 | 内容语义相似度 | 对象间的关系路径 |
| 评分的单位 | chunk（256 token） | object（完整的领域对象） |
| 评分的参照系 | Library 的向量库 | 整个对象网络（项目、研究、任务、愿景…） |
| 评分的结果 | 浮点分数 (0-1) | proposed links with why_summary |
| Agent 的推理材料 | 向量检索的 chunk 列表 | 对象包 + 关系包 + 事件包 |
| 可解释性 | "相似度 0.72" | "这篇文章 supports 你的 XX 研究空间，因为它讨论了 YY" |
| 用户纠错 | 无（分数就是分数） | reject link / 改写 relation / 静音规则 |
| 跨域关联 | 不支持（只看内容） | 天然支持（文章可关联项目、任务、研究、写作） |

这不是"新方案更好"的简单结论，而是**两套方案解决的问题层次不同**：

- 旧方案解决的是"这篇新文章和我读过的东西像不像"
- 新方案解决的是"这篇新文章对我正在做的事有没有用"

---

## 四、向量检索在新方案中的位置

这并不意味着向量检索没有价值。在新 Orbit 中，向量检索的正确位置是**关联建议的信号源之一**，而不是信号/噪音判断的唯一机制。

根据 09 专题 §3.5 的设计，关联建议有四类信号源：

1. **文本语义相似**（向量检索）→ 发现"内容像"的潜在关系
2. **共现上下文**（同项目、同研究空间、同会话）→ 发现"一起出现过"的关系
3. **溯源链邻近**（同一来源、同一引用链）→ 发现"同源"的关系
4. **时间邻近与行为模式**（同一天被连续阅读、提问、写作）→ 发现"行为关联"的关系

向量检索是信号源 #1，它输出的不是最终评分，而是 **proposed links 的候选集**。Graph Agent 综合四类信号后，以 `status='proposed'` 将建议写入 `links` 表，等待用户确认或 Agent 根据置信度自动激活（低风险时 `A1 透明自动执行`）。

这意味着：

- **旧方案的 `feed-relevance.ts` 不应原样迁移**，而应改造为新 Orbit 中"关联建议"系统的一个信号提供者
- **新方案不需要一个独立的 `FeedRelevanceEngine`**，而是需要 Graph Agent 能够在 Feed 内容入库时，调用多种信号源（包括向量检索），产出 proposed links
- **评分从"分数"变成"关系"**：不再是 `feedRelevance: { score: 0.72, label: 'high' }`，而是 `link: { relation: 'supports', target: 'research_space:xxx', confidence: 0.72, why_summary: '...' }`

---

## 五、Feed 和 Library 在新架构中的落地方案

### 不再需要 `@orbit/feature-feed` 和 `@orbit/feature-library` 作为独立包

回到前面的迁移计划，我现在认为独立的 `feature-feed` 和 `feature-library` 包**不符合新 Orbit 的设计哲学**。原因：

1. **04 专题已经明确**：Orbit 的订阅不等于传统 RSS reader 的 feed 列表，而是一个统一的 source network。Feed、site watch、channel digest、saved search、manual capture 都是合法来源。
2. **09 专题已经明确**：Feed 内容和 Library 内容都是对象网络中的节点，它们的区别在于 `origin` 和 `link density`，而不是它们住在不同的"模块"里。
3. **12 专题已经明确**：Agent 不需要记住 20 套表结构，它只看见 `object.query`、`link.write`、`event.append`。

### 正确的落地方式

#### 1. 在 `@orbit/feature-reader` 中扩展

`feature-reader` 已经包含了 source-discovery、subscription-manager、content-pipeline、content-layers、content-state-machine。这些正是 Feed/Library 共享的基础设施。应该在这里扩展：

- **SourceResolver**：智能 URL 解析（YouTube/Podcast/RSS/通用），从旧 Orbit 迁移核心解析逻辑
- **FetchScheduler**：订阅源定时抓取调度
- **ContentOriginClassifier**：标记内容的 `origin`（feed_auto / user_save / agent_recommend）
- **ProcessingDepthPolicy**：根据 origin + link density 决定处理深度

#### 2. 在 `@orbit/agent-core` 的 Reader Agent Profile 中实现策展逻辑

Reader Agent 不只是"帮用户读文章"，按 14 专题 §3.3 的定义，它负责：

> article, book, podcast, video transcript, highlight → 摘要、解释、翻译、转写结果、**建链建议**

"建链建议"就是旧 Orbit 中"信号/噪音评分"的新 Orbit 等价物。Reader Agent 在新 Feed 内容入库时：

1. 生成轻量摘要（DerivedLayer）
2. 调用 Graph Agent 的关联建议能力，产出 proposed links
3. 将高置信、低风险的 links 自动激活（A1 级别）
4. 将中低置信的 links 以 `proposed` 状态等待用户浏览 Feed 时确认

#### 3. Feed 视图和 Library 视图是同一对象网络的两种查询视图

按 12 专题的设计，这只是不同的 `ObjectQueryFilter`：

```typescript
// Feed 视图：来自订阅源的、自动发现的内容
const feedQuery: ObjectQueryFilter = {
  objectTypes: ['content_item'],
  originTypes: ['system', 'ai'],
  hasSourceEndpoint: true,
  sortBy: 'relevance_then_time',
};

// Library 视图：用户主动保存的内容
const libraryQuery: ObjectQueryFilter = {
  objectTypes: ['article', 'book'],
  originTypes: ['human'],
  sortBy: 'user_preference',
};
```

它们查的是同一个 `object_index` + `links` 表，只是过滤条件不同。这正是 09 专题说的"分裂方案保留为使用层语义，不保留为存储层真相"。

#### 4. 信号/噪音不是一个分数，而是 link density 的自然涌现

在 Feed 视图中，Agent 不需要显式计算一个 `relevance: 0.72`。一个 Feed 内容对象如果被 Graph Agent 发现了多条 `supports`、`informs`、`about` 关系链接到用户的活跃项目和研究空间，它自然会在排序中获得更高位置——因为 link density 就是信号强度的体现。

排序公式不再是 `score * time_decay`，而是：

```
priority = f(
  active_link_count,       // 与活跃对象的确认关系数
  proposed_link_count,     // 待确认的建议关系数
  max_link_confidence,     // 最高建议置信度
  source_endpoint_quality, // 来源质量（历史确认率）
  time_decay,              // 时间衰减
  user_interaction_signal  // 用户交互信号（是否点开、是否停留）
)
```

这个公式的每个分量都来自对象网络的真实数据，而不是一个黑箱向量距离。

---

## 六、修订后的迁移策略

基于以上思考，我认为迁移计划需要修订：

### 不再创建的包
- ~~`@orbit/feature-feed`~~ → Feed 逻辑融入 `feature-reader` + `agent-core`
- ~~`@orbit/feature-library`~~ → Library 逻辑融入 `feature-reader` + `agent-core`
- ~~`FeedRelevanceEngine`~~ → 替换为 Graph Agent 的关联建议能力

### 仍然需要创建的包
- `@orbit/reader-resolvers` — URL 智能解析器（YouTube/Podcast/RSS/通用），这是纯工具层，与架构无关

### 需要扩展的包
- `@orbit/feature-reader` — 增加 SourceResolver、FetchScheduler、视频/播客渲染模型
- `@orbit/domain` — 扩展 SourceEndpointKind、增加 ContentOrigin 类型
- `@orbit/agent-core` — Reader Agent Profile（包含旧 Orbit 的策展逻辑，但改造为基于对象关系的建链建议）

### 向量检索的位置
- 向量检索作为 Graph Agent 关联建议的信号源之一保留
- 不作为独立的"Feed 评分引擎"，而是作为 `link.suggest` 能力的内部实现细节
- 与共现分析、溯源链分析、时间行为分析并列，共同输出 proposed links

---

## 七、结论

**旧 Orbit 的 RAG 评分和新 Orbit 的对象网络是两种根本不同的信息组织范式。**

旧方案把内容看作向量空间中的点，用距离衡量相关性。新方案把内容看作对象网络中的节点，用关系路径衡量价值。

Feed 和 Library 不是两个独立模块，而是同一对象网络的两种入口模式：Feed 是边缘候选区，Library 是核心锚定区。Agent 的工作不是"给 Feed 内容打分"，而是"在对象网络中发现新内容与已有对象的潜在关系"。

**应该按新项目的方案走。** 旧项目中值得迁移的是具体的工程能力（URL 解析、RSS 解析、播客发现、转写调度、阅读器渲染模型），而不是它的信息架构（单一 articles 表 + 向量评分 + feed/library 二分法）。
