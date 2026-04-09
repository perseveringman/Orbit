# 16. 统一 Block 编辑器

## 1. 设计定位

统一 Block 编辑器不是一个“更高级的 Markdown 输入框”，而是 Orbit 在笔记、研究、写作三类核心内容上的共同生产内核。它基于 TipTap 提供一致的 Block 语义、选区能力、拖拽组装与引用插入机制，但它的真相来源仍然是文件系统中的 Markdown 文件；数据库只承担索引、关系、溯源、事件与能力编排。

这意味着本专题的核心任务不是做三套编辑器，而是定义一套可跨容器复用的内容协议：

1. **文件系统优先**：长文本正文始终落在 `sources/notes/`、`sources/documents/`、`sources/research/` 等目录中，TipTap JSON 只是运行时态，不是长期真相。
2. **元数据数据库协同**：Block 级引用、拖拽组装、模式能力、来源链、对象关系、事件日志进入 `.orbit/orbit.db`，服务搜索、回链、Agent 与同步。
3. **对象网络对齐**：编辑器产出的不是孤立文本，而是可进入 `object_index + links + events` 的内容对象与可寻址 Block 片段。
4. **多模式统一内核**：笔记模式强调低阻力记录，研究模式强调证据组织与问题推进，写作模式强调结构组装与发布前加工；三者共享同一 AST、命令系统、序列化协议与 provenance 模型。
5. **三端能力分层**：桌面端与 Web 端提供完整编辑器；iOS 端定位为“捕捉 + 轻编 + 审阅 + 引用确认”，不承担重型拖拽编排。

因此，16 的产出应被视为内容基础设施：06 的笔记与高亮在这里被编辑、07 的研究证据在这里被组装、10 的写作成品在这里被生成，而 12/13/18 提供它能成立的对象、能力与多端边界。

## 2. 关键用户场景

### 2.1 笔记：低阻力记录，但不丢失后续可追溯性

用户在阅读、对话、任务、Journal 或全局捕捉入口打开一条笔记时，默认进入轻量编辑体验：直接输入段落、列表、callout、任务项、引用，不被复杂结构打断。但如果某个段落后来被引用到研究空间、写作文档，或被选中继续问 Agent，系统必须能够为它补发稳定 `block_id`，并将该段内容升级为可追踪片段。

### 2.2 研究：把材料、问题、证据与阶段性结论编进同一画布

研究模式不是普通长文写作，而是“证据驱动的组装编辑”。用户会把高亮、边注、网页摘录、已有笔记、研究结论卡、反例、待验证问题拖入文档；编辑器要支持 `/evidence`、`/claim`、`/counterpoint`、`/question` 等 Block 类型，并且让每个研究结论都能回到来源材料。

### 2.3 写作：从研究材料到可发布产物

用户在写作工作台中打开文章、PRD、脚本或长文大纲时，希望通过 slash menu、素材侧栏与拖拽把研究材料拼装为最终文稿。这里的关键不是“引用过什么”，而是“这段内容从哪条高亮/哪条笔记/哪个研究结论长出来、经过哪些改写”。写作模式因此必须默认开启 `block_provenance`。

### 2.4 跨端：桌面/Web 完整组装，iOS 快速续写与引用确认

用户在桌面端进行重型整理，在 Web 端远程继续编辑，在 iOS 端只做三类事情：快速补写一段、确认某条引用是否插入、查看一段内容的来源链并做轻微修改。复杂拖拽、多列材料拼装、大纲批量重排、复杂 Block 创建应明确留在桌面/Web。

## 3. 核心设计

### 3.1 Monorepo 中的编辑器分层

统一编辑器应拆成“协议层 + 运行时层 + 平台适配层”，避免桌面实现绑死全平台：

- `packages/editor-schema`：Block schema、mode schema、slash item 定义、provenance 类型、序列化规则。
- `packages/editor-tiptap`：TipTap 扩展、命令、输入规则、NodeView、拖拽插件。
- `packages/editor-markdown`：Markdown ↔ TipTap AST 转换、HTML 注释解析、外部编辑补偿逻辑。
- `packages/editor-capabilities`：`editor.open/save`、`block.insertFromObject`、`provenance.trace`、`editor.switchMode` 等受控能力接口。
- `apps/desktop` / `apps/web`：完整编辑壳层，接入素材侧栏、研究上下文、写作大纲、对象面板。
- `apps/ios`：轻量适配层，复用 schema 与序列化，但只暴露受限命令集与有限 Block 类型。

这保证 Orbit 新 monorepo 里，统一的不是“某个 React 组件”，而是跨端共享的内容协议。

### 3.2 Block 容器与模式模型

统一编辑器处理三类容器：

- `note`：普通笔记、边注、闪念、Journal 手记
- `research_artifact`：研究笔记、综述、问题树快照、证据整理稿
- `document`：文章、PRD、脚本、发布前正文

但“容器类型”和“编辑模式”不是一回事。模式是能力覆盖层：

```ts
interface EditorModeConfig {
  mode: 'note' | 'research' | 'writing';
  allowBlockIds: 'lazy' | 'required';
  allowMaterialPanel: boolean;
  allowProvenancePanel: boolean;
  slashGroups: string[];
  dragCompose: boolean;
  inlineAskAgent: boolean;
}
```

明确决策：

1. **笔记模式**：`allowBlockIds='lazy'`，优先低噪音记录。
2. **研究模式**：`allowBlockIds='required'`，所有顶层证据块与结论块都可追踪。
3. **写作模式**：`allowBlockIds='required'`，并默认开启 provenance 与素材组装能力。

模式切换分两类：

1. **视图切换**：同一对象在不同工作台里以不同能力集打开，例如某条 `note` 在笔记页按 note 模式打开，在研究空间中按 research 模式打开，不改变文件身份。
2. **对象升格**：当一条笔记被正式提升为研究产物或创作文档时，创建新的 `research_artifact` 或 `document` 对象与文件，并保留 `derived_from` / `feeds` 关系，而不是简单改 UI 开关。

### 3.3 Block ID：稳定寻址、懒分配、跨端可同步

Block 级能力必须建立在稳定 ID 之上。这里采用 **顶层 Block 必有稳定 `block_id`，嵌套片段用路径补充** 的策略：

```ts
// 推荐格式：blk_<ulid>
// 示例：blk_01JQ9M7F2Y6X1K8A4N3R5T7V9C
interface BlockAddress {
  ownerObjectType: 'note' | 'research_artifact' | 'document';
  ownerObjectId: string;
  blockId: string;
  path?: string;      // 例如 li[2]/p[1]
  startOffset?: number;
  endOffset?: number;
  quoteHash?: string;
}
```

设计决策如下：

1. **研究 / 写作模式**：所有顶层 Block 创建时立即生成 `block_id`。
2. **笔记模式**：默认只给“被外部引用、被选区提问、被加入研究、被拖入写作、被评论”的 Block 补发 `block_id`；普通输入的段落可以暂不分配。
3. **嵌套定位**：列表项、表格单元格、callout 内段落等不单独暴涨为全局对象，使用 `block_id + path + range` 做子片段定位。
4. **跨端同步**：`block_id` 一经发出永不复用；缺失时只能新增，不能重写旧 ID。
5. **外部编辑容错**：用户在外部编辑器删掉注释后，Orbit 重新导入时只为缺失 Block 重新分配新 ID，并把旧 provenance 标记为 `detached`，不做危险猜测覆盖。

### 3.4 序列化策略：Markdown 为真相，TipTap 为运行时

统一编辑器不以 TipTap JSON 作为长期存储格式，而采用：

- **文件系统**：frontmatter + 标准 Markdown 正文
- **Block 元信息**：用不可见 HTML 注释嵌入到 Markdown
- **数据库**：存放 provenance、links、events、对象索引、能力快照

推荐序列化形式：

```markdown
---
orbit_id: "doc_01JQ9M2..."
orbit_type: "document"
title: "Agent Native 写作框架"
---

<!-- orbit:block {"id":"blk_01JQ9M7..."} -->
# Agent Native 写作框架

<!-- orbit:block {"id":"blk_01JQ9M8..."} -->
这是一段正文。

<!-- orbit:block {"id":"blk_01JQ9MA..."} -->
> [!quote]
> 这段材料来自某条研究结论。
```

序列化规则：

1. **只把最小必需 Block 元数据写回文件**：`block_id` 必写；复杂 provenance 不写进正文，避免污染可移植性。
2. **富关系留在数据库**：`block_provenance`、`links`、`events`、对象提升记录进入 `.orbit/orbit.db`。
3. **反序列化幂等**：Markdown → AST → Markdown 不应改变用户正文语义；Orbit 自有注释应保留。
4. **外部兼容优先**：删去 `orbit_` frontmatter 和注释后，文件仍是合法 Markdown。
5. **缓存不是真相**：桌面/Web/iOS 可在 `.orbit/cache/editor/` 或本地数据库中缓存 TipTap JSON 以加速打开，但保存与同步均以 Markdown canonical form 为准。

### 3.5 Slash Menu、拖拽组装与引用材料

slash menu 是能力入口，不只是格式菜单。统一分四组：

1. **通用块**：段落、标题、列表、任务项、引用、callout、代码、表格、图片、附件。
2. **引用与材料**：`/from-highlight`、`/from-note`、`/from-research`、`/mention-object`、`/quote-source`。
3. **研究增强**：`/evidence`、`/claim`、`/counterpoint`、`/question`、`/synthesis`。
4. **写作增强**：`/section-template`、`/argument-block`、`/insert-outline`、`/rewrite-with-sources`。

拖拽组装支持三种插入语义：

- **reference**：插入只读引用卡，保持活链接，不复制正文。
- **snapshot**：把来源内容快照插入为可编辑 Block，并建立 provenance。
- **embed**：插入可折叠素材卡，展开时查看原内容，不直接并入正文。

明确决策：研究与写作都支持三种语义；笔记模式默认只暴露 `reference` 和 `snapshot`，不提供重型素材编排面板。

### 3.6 Source / Provenance：从“引用谁”升级为“内容如何长成”

`block_provenance` 不再只服务创作文档，而是统一覆盖 note / research / writing 三类容器：

```ts
interface BlockProvenanceRecord {
  ownerType: 'note' | 'research_artifact' | 'document';
  ownerId: string;
  blockId: string;
  sourceRefs: Array<{
    sourceType: 'highlight' | 'note' | 'research_artifact' | 'document' | 'agent_message';
    sourceId: string;
    sourceBlockId?: string;
    anchor?: BlockAddress;
  }>;
  transformation: 'verbatim' | 'edited' | 'ai_rewrite' | 'merged' | 'summarized';
  provenanceState: 'active' | 'detached';
  lineageRootType?: string;
  lineageRootId?: string;
  createdAt: string;
  updatedAt: string;
}
```

关键原则：

1. **source 与 provenance 分层**：`source` 说明材料来自哪里；`provenance` 说明当前 Block 是如何由这些材料变换而来。
2. **多源一块合法**：研究结论与写作段落经常由多条高亮/笔记合成，因此 `sourceRefs` 必须是一对多。
3. **链路可追溯到底**：允许从写作段落 → 研究结论 → 研究证据 → 高亮 → 原文锚点逐级下钻。
4. **AI 改写不可洗白来源**：任何 AI 参与生成的新 Block，都必须保留输入材料链，而不是只留下“由 Agent 生成”。

### 3.7 与对象网络的对齐方式

为避免图谱膨胀，不把所有 Block 都直接提升为全局对象，而采用两层策略：

1. **容器对象始终入网**：`note`、`research_artifact`、`document` 必须进入 `object_index`。
2. **可复用 Block 按需晋升**：当 Block 被引用、评论、拖入其他容器、加入研究证据、被 Agent 单独操作时，才创建 `block_ref` 级索引记录，进入 `object_index` 并建立 `links`。

建议关系语义：

- `note -> highlight : derived_from`
- `research_artifact -> highlight/note/document : references`
- `document -> research_artifact : feeds`
- `block_ref -> block_ref : derived_from`
- `block_ref -> object : cites / supports / rebuts`
- `journal_entry -> block_ref : reflects_on`

同时，编辑器相关动作进入 `events`：

- `block_promoted`
- `block_referenced`
- `provenance_detached`
- `mode_switched`
- `material_inserted`
- `agent_rewrite_accepted`

这样 16 既不把数据库变成正文仓库，也不让 Block 级编排停留在 UI 层。

## 4. Agent 行为与自动化机制

Agent 在统一编辑器中的角色是“基于当前 Block 上下文进行增强”，不是越权代写整个文档。核心自动化分四类：

1. **上下文理解**：围绕当前选区、当前 Block、当前容器对象、关联来源链生成解释、总结、对比与下一步建议。
2. **材料编排**：根据研究问题或写作段落推荐可插入的高亮、笔记、研究结论，并明确插入语义（reference / snapshot / embed）。
3. **结构建议**：在研究或写作模式下建议新 section、反论证块、证据缺口块、过渡段，而不是直接无来源续写。
4. **溯源维护**：用户接受 Agent 改写或合并时，自动更新 `block_provenance.transformation`，并写入事件日志。

自动化边界必须明确：

- Agent 可以建议 `slash` 项、推荐来源、改写某个 Block，但**不能静默重排整篇文档结构**。
- Agent 可以生成新 Block，但**只有在记录来源链后才可落盘**。
- 对外部 MCP Agent，编辑器开放的是受控能力，如 `editor.insert_from_object`、`provenance.trace`、`editor.suggest_outline`，而不是数据库直写权限。
- iOS 端 Agent 更偏向“解释/总结/推荐引用”，不触发大规模批量组装。

典型流：

1. 用户在研究模式中选中一段结论。
2. Agent 发现缺少证据，推荐 3 条高亮与 1 条旧笔记。
3. 用户选择以 `snapshot` 方式插入其中两条。
4. 系统写入新 Block、生成 `block_id`、登记 `block_provenance`、创建 `links(document/research_artifact -> source)`、写入 `events(material_inserted)`。
5. 后续如果用户把该段落拖入写作文档，沿原有 lineage 延续，而不是重新丢失来源。

## 5. 数据模型 / 接口 / 能力边界

### 5.1 核心数据对象

```ts
interface EditorDocumentHandle {
  objectType: 'note' | 'research_artifact' | 'document';
  objectId: string;
  filePath: string;
  mode: 'note' | 'research' | 'writing';
  contentFormat: 'markdown';
  lastSyncedAt: string;
}

interface EditorBlockMeta {
  blockId: string;
  ownerObjectType: EditorDocumentHandle['objectType'];
  ownerObjectId: string;
  blockType: string;
  promotedToObject?: boolean;
}
```

数据库分工：

- **文件系统**：frontmatter、Markdown 正文、Block HTML 注释。
- **`file_index` / `object_index`**：容器对象索引、按需晋升的 `block_ref` 索引。
- **`links`**：研究、写作、笔记、Journal 与 Block 之间的语义关系。
- **`block_provenance`**：Block 来源链、变换方式、脱链状态。
- **`events` / `event_log`**：模式切换、引用插入、改写接受、脱链告警。

### 5.2 能力接口

统一编辑器至少暴露以下内部能力：

| 接口 | 用途 |
|---|---|
| `editor.open(handle)` | 打开指定对象与模式 |
| `editor.save(handle, markdown)` | 将 canonical Markdown 写回文件系统并同步数据库 |
| `editor.switch_mode(handle, mode)` | 在允许的前提下切换能力层 |
| `block.ensure_id(handle, blockLocator)` | 为懒分配 Block 补发 `block_id` |
| `block.insert_from_object(handle, sourceRef, insertMode)` | 从高亮/笔记/研究产物插入材料 |
| `block.promote_to_object(handle, blockId)` | 将高价值 Block 晋升为 `block_ref` 对象 |
| `provenance.trace(handle, blockId)` | 查看完整来源链 |
| `provenance.detach(handle, blockId, reason)` | 显式断开溯源 |
| `editor.list_commands(mode, platform)` | 依据模式与平台返回 slash menu |

### 5.3 三端能力矩阵

| 能力 | Desktop | Web | iOS |
|---|---|---|---|
| 基础文本编辑 | 完整 | 完整 | 完整 |
| 研究/写作模式切换 | 完整 | 完整 | 受限 |
| Slash Menu 完整集 | 完整 | 完整 | 精简 |
| 拖拽组装 | 完整 | 完整 | 不支持自由拖拽 |
| 素材侧栏 + 多面板并排 | 完整 | 完整 | 不支持 |
| Provenance 查看 | 完整 | 完整 | 卡片式查看 |
| Provenance 编辑/合并来源 | 完整 | 完整 | 仅确认/移除单条来源 |
| 表格/Mermaid/复杂布局 | 完整 | 大部分支持 | 只读或降级渲染 |
| 引用插入 | 完整 | 完整 | 通过动作表单插入 |
| 外部文件实时监听 | 完整 | 依赖 Web 文件访问/同步层 | 不支持直接监听 |

明确边界：**iOS 端不是完整创作工作台，而是统一编辑器的轻交互前端**。当文档包含 iOS 不支持的复杂 Block 时，必须提供只读 fallback 与“在桌面/Web 继续编辑”入口，而不是静默丢失结构。

## 6. 与其他专题的依赖关系

| 依赖专题 | 关系说明 |
|---|---|
| **06（笔记与高亮系统）** | 06 提供 `SelectionContext`、高亮锚点、边注对象与材料引用入口；16 负责把这些材料变成可编辑 Block、可追溯引用与可继续提问的内容容器。没有 06，16 只有编辑能力，没有材料入口。 |
| **05（研究工作台）** | 05 定义研究空间、问题树、证据池、研究产物与研究会话；16 则提供研究模式下的证据块、结论块、拖拽组装与来源链 UI。05 负责研究流程，16 负责研究内容编排内核。 |
| **07（写作工作台）** | 07 定义写作目标、素材面板、结构大纲、发布流与成品生命周期；16 提供写作模式编辑器、slash 引用、Block provenance 与从研究到写作的组装机制。07 是工作流层，16 是编辑协议层。 |
| **09（对象网络与关联能力）** | 16 的容器对象、按需晋升的 `block_ref`、来源链与 backlinks 都依赖 09 的 `object_index + links + events`。如果 09 不成立，16 只能做本地编辑器，无法支持对象级回链、全局检索与跨工作台引用。 |
| **13（文件系统优先数据架构）** | 16 需要 13 提供 frontmatter + block 注释契约、file-backed object、bundle 路径与外部编辑回附规则。没有 13，Block 无法成为可带走的长期资产。 |
| **15（应用能力 MCP 化）** | 16 需要 15 提供受控 capability layer，把 `editor.open/save`、`block.insert_from_object`、`provenance.trace`、`editor.suggest_outline` 暴露给内部/外部 Agent。反过来，15 也依赖 16 定义细粒度、可审计、可撤销的编辑能力边界。 |
| **11（LocalFirst 同步与 GDPR）** | 11 负责 block 注释同步、外部修改检测、跨端冲突策略、iOS 本地缓存与 Web 降级访问边界；16 必须遵守这些约束，确保 `block_id` 稳定、Markdown 可合并、复杂 Block 可降级而不丢数据。 |
| **18（设计系统与换肤）** | 18 提供编辑器在 reader / research / writing 三模式下的 token、暗色、排版与状态表达；16 则把这些视觉约束落到具体编辑交互。 |

## 7. 风险、边界与设计决策

1. **不保存 TipTap JSON 作为长期真相**：否则会破坏文件系统优先与外部编辑兼容。明确决策：Markdown 是唯一长期正文格式，JSON 只是缓存。
2. **不让所有 Block 自动进入对象网络**：否则对象数量爆炸、回链噪音失控。明确决策：只有被引用、被讨论、被拖拽复用、被 Agent 单独处理的 Block 才晋升为 `block_ref`。
3. **模式切换不是任意互转**：note 与 research 可以共享同一底层文件但能力不同；写作对象一旦成为 `document`，其发布语义、模板与 provenance 约束不同，应该通过对象升格完成，而不是随时在原对象上“切成写作模式”。
4. **移动端以保真优先，不以完整编辑为目标**：iOS 必须保证查看、轻改、插入引用、保留结构；但复杂拖拽、重型多栏编排、复杂 Block 创建故意不做，以避免弱交互把数据结构做坏。
5. **provenance 不是装饰信息，而是写作与研究可信度基础设施**：任何 AI 改写、材料合并、引用插入，都必须更新 provenance 与事件日志；否则 Orbit 失去“观点可回到材料”的核心优势。
6. **序列化必须允许外部破坏但不能静默伪恢复**：用户在外部删掉 `orbit:block` 注释后，系统最多重发新 ID 并标记旧链路 `detached`，不能假装旧 provenance 仍然准确。
7. **桌面/Web 完整编辑、iOS 降级适配是硬边界**：这是能力分层，不是临时阉割。Orbit 的统一编辑器要统一协议，不强求三端同构 UI。
