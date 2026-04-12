# 阅读模块迁移方案（对齐 orbit-reboot 设计）

> 日期: 2026-04-12
> 状态: Draft v2
> 替代: 2026-04-12-reader-migration-plan.md（该文档未考虑 orbit-reboot 设计，已废弃）
> 对齐文档: 00, 04, 06, 09, 12, 13, 17 号设计方案

---

## 1. 执行摘要

### 1.1 关键发现：新 Orbit 已具备正确架构

经过对三方代码的深度分析，发现**新 Orbit monorepo 已经实现了 orbit-reboot 设计方案要求的核心架构**：

| 架构要素 | orbit-reboot 要求 | 新 Orbit 现状 | 缺口 |
|----------|------------------|--------------|------|
| `object_index` 全局索引 | ✅ 12 号方案 | ✅ `db-schema/tables/object-index.ts` 已有 DDL | 无 |
| `links` 统一关系表 | ✅ 09/12 号方案 | ✅ `db-schema/tables/links.ts` 已有 | 无 |
| `events` 事件层 | ✅ 12 号方案 | ✅ `db-schema/tables/events.ts` 已有 | 无 |
| `file_index` 文件注册 | ✅ 13 号方案 | ✅ `db-schema/tables/file-index.ts` 已有 | 无 |
| `link_evidence` 证据层 | ✅ 09 号方案 | ✅ `db-schema/tables/link-evidence.ts` 已有 | 无 |
| 38 种对象类型 | ✅ 00 号方案 | ✅ `domain/object-types.ts`（含 article/book/highlight/note/source_endpoint/content_item） | 无 |
| 关系词汇表 | ✅ 09 号方案 | ✅ `domain/relation-vocabulary.ts` | 无 |
| 3 层目录布局 | ✅ 13 号方案 | ✅ `workspace-core/directory-layout.ts`（sources/wiki/.orbit） | 无 |
| 4 层内容管线 | ✅ 04 号方案 | ✅ `feature-reader/content-pipeline.ts` + `content-layers.ts` | 需填充运行时逻辑 |
| 内容状态机 | ✅ 04 号方案 | ✅ `feature-reader/content-state-machine.ts` | 需填充运行时逻辑 |
| 5 种 Resolver | ✅ 04 号方案 | ✅ `reader-resolvers/`（RSS/Podcast/YouTube/Newsletter/Generic） | 需填充运行时逻辑 |
| 多语言 i18n | ✅ 17 号方案 | ✅ `i18n/`（en-US/zh-CN/zh-TW） | 无 |
| 对象图谱 | ✅ 09 号方案 | ✅ `object-graph/`（link-crud, graph-index, relation-suggestion） | 无 |
| 能力层 / MCP | ✅ 15 号方案 | ✅ `capability-core/`（mcp-server, policy-engine） | 需注册 reader 能力 |

### 1.2 迁移本质：不是"搬旧代码"，而是"在正确架构上填充运行时"

旧迁移计划试图把旧 Orbit 的扁平 `articles` 大宽表、散落的 IPC handler 原样搬进新 monorepo。这与 orbit-reboot 设计根本冲突。

**正确做法**：新 Orbit 的接口和类型定义已完备（~3,053 行核心 reader 栈），需要做的是：

1. **运行时填充**：把接口背后的实际逻辑（fetch、extract、ASR、translation）填上
2. **算法移植**：从旧 Orbit 提取经过验证的算法（火山 ASR 协议、智能段落合并、翻译引擎链），适配到新接口
3. **DB Schema 扩充**：在现有 `type-tables.ts` 中补充 reader 专属字段（articles/books/highlights 等类型表的详细列定义）
4. **UI 构建**：用 HeroUI v3 构建阅读器组件

### 1.3 工作量重估

| 对比项 | 旧计划 | 本计划 |
|-------|--------|-------|
| DB Schema | 从零建 9 张表 | 扩充现有 type-tables 的列定义 |
| 对象模型 | 无 | 已有 38 种类型，只需补字段 |
| 关系系统 | 无 | 已有 links + object_index + 词汇表 |
| Resolver | 从零写 5 个 | 已有接口定义，填充运行时 |
| Content Pipeline | 从零写 | 已有 4 层管线定义，填充运行时 |
| 文件系统 | 未考虑 | 已有 3 层布局 + 编译管线 |
| 预计工作量 | ~9,000 行新代码 | ~5,000 行新代码（+2,500 行移植） |

---

## 2. 旧 Orbit 代码资产评估

### 2.1 值得移植的算法（高价值，需适配接口）

| 模块 | 旧文件 | 行数 | 移植策略 |
|------|--------|------|---------|
| 火山引擎 ASR 协议 | `volc-asr-service.ts` | 340 | 移植二进制协议，适配 `TranscriptionProvider` 接口 |
| 腾讯云 ASR | `asr/tencent-provider.ts` | 150 | 移植签名逻辑，适配同一接口 |
| ASR Provider 抽象 | `asr/asr-provider.ts` | 105 | 已有 `transcription-layer.ts` 接口，对齐 |
| 翻译引擎链 | `translation/engines/*.ts` | 967 | 移植 5 个引擎，适配 `TranslationProvider` 接口 |
| 翻译 Task Runner | `translation/task-runner.ts` | 540 | 移植段落分批、并发控制、进度广播 |
| 文本分割器 | `translation/text-splitter.ts` | 226 | 移植 CJK 感知分段算法 |
| RSS 服务 | `services/rss-service.ts` | 489 | 移植 feed 解析、podcast 检测、OPML |
| YouTube 服务 | `services/youtube-service.ts` | 740 | 移植流提取、字幕下载、频道解析 |
| 播客解析 | `services/podcast-resolver.ts` | 361 | 移植 URL 解析、Apple/Spotify 适配 |
| 正文提取 | `services/parser-service.ts` | 200 | 移植 Readability/Mercury 集成 |
| EPUB 元数据 | `services/epub-metadata.ts` | ~150 | 移植 epub.js 元数据提取 |
| 音频管线 | `services/audio-pipeline.ts` | ~200 | 移植 ffmpeg 预处理（16kHz PCM WAV） |
| 高亮 XPath | 旧 ArticleReaderCore | ~200 | 移植 `computeAnchorPath`/`resolveAnchorPath` |
| **合计** | | **~3,668** | |

### 2.2 需要重写的部分（旧架构不兼容）

| 模块 | 原因 |
|------|------|
| DB Schema（articles 大宽表） | 新 Orbit 用 type tables + object_index |
| IPC Handlers（503 通道） | 新 Orbit 用 capability interface + MCP |
| 高亮存储（旧 anchorPath 格式） | 新 Orbit 用 4 层 AnchorPayload |
| 翻译存储（paragraphs JSON） | 新 Orbit 翻译是独立 `derivative_assets` |
| Reader UI（1,730 行单文件） | 用 HeroUI v3 组件重写 |

### 2.3 不迁移的部分

- WeChat 公众号相关（wechat-*）
- 旧版 Drizzle ORM 模式（新版用原生 SQL DDL）
- 旧版 lucide-react 图标（用 HeroUI 图标）
- 旧版 React Context 状态管理

---

## 3. 数据层设计（对齐 12/13 号方案）

### 3.1 类型表扩充

在现有 `db-schema/tables/type-tables.ts` 的 Input 家族中，扩充以下表的详细列定义：

#### articles 表（扩充）

```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,                     -- ULID: art_01JZ...
  
  -- 来源
  source_endpoint_id TEXT,                 -- FK → source_endpoints（可空，手动保存无来源）
  source_url TEXT,
  canonical_url TEXT,
  
  -- 内容元数据
  title TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  language TEXT,                            -- BCP 47
  language_confidence REAL,
  
  -- 媒介类型（保留旧 Orbit 经验证的统一表设计）
  content_type TEXT NOT NULL DEFAULT 'article',  -- article | podcast | video
  
  -- 文章特有
  word_count INTEGER,
  reading_time_minutes INTEGER,
  
  -- 音频特有（podcast）
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  
  -- 视频特有
  video_id TEXT,                           -- YouTube ID
  video_duration_seconds INTEGER,
  
  -- 阅读状态
  read_status TEXT NOT NULL DEFAULT 'inbox',  -- inbox | later | reading | archive
  read_progress REAL DEFAULT 0,            -- 0.0 ~ 1.0
  
  -- 文件系统绑定（对齐 13 号方案）
  raw_file_path TEXT,                      -- sources/library/articles/{id}/original.html
  readable_file_path TEXT,                 -- sources/library/articles/{id}/content.md
  
  -- 内容管线状态（对齐 04 号方案 8 阶段）
  pipeline_status TEXT NOT NULL DEFAULT 'saved',
    -- saved → queued → fetched → normalized → extracted → ready_to_read → archived
    -- 失败分支: fetch_failed | extract_failed | quarantined
  
  -- 审计
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_flg INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_articles_status ON articles(read_status, pipeline_status, updated_at DESC);
CREATE INDEX idx_articles_type ON articles(content_type, updated_at DESC);
CREATE INDEX idx_articles_source ON articles(source_endpoint_id);
```

#### source_endpoints 表（新增，对齐 04 号方案）

```sql
CREATE TABLE source_endpoints (
  id TEXT PRIMARY KEY,                     -- ULID: sep_01JZ...
  endpoint_type TEXT NOT NULL,             -- rss_feed | site_watch | channel | digest_list | saved_search | manual_url
  url TEXT NOT NULL,
  feed_url TEXT,                           -- 实际 RSS URL（可能与 url 不同）
  title TEXT,
  description TEXT,
  icon_url TEXT,
  language TEXT,
  
  -- 抓取配置
  fetch_interval_minutes INTEGER DEFAULT 60,
  last_fetched_at TEXT,
  etag TEXT,
  last_modified TEXT,
  error_count INTEGER DEFAULT 0,
  
  -- 审计
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_flg INTEGER NOT NULL DEFAULT 0
);
```

#### highlights 表（扩充，对齐 06 号方案 4 层锚点）

```sql
CREATE TABLE highlights (
  id TEXT PRIMARY KEY,                     -- ULID: hlt_01JZ...
  
  -- 来源对象（对齐 06 号方案：highlight 是对象网络一等公民）
  source_object_type TEXT NOT NULL,        -- article | book | note | document | research_artifact
  source_object_id TEXT NOT NULL,
  
  -- 4 层锚点（对齐 06 号方案 AnchorPayload）
  anchor_json TEXT NOT NULL,               -- JSON: {sourceVersion, locator, quote, prefix, suffix, textHash, state}
  quote_text TEXT NOT NULL,                -- 选中的原文
  
  -- 高亮属性
  color TEXT DEFAULT 'yellow',
  highlight_kind TEXT NOT NULL DEFAULT 'highlight',  -- highlight | question_seed | evidence | quote
  created_by TEXT NOT NULL DEFAULT 'manual',          -- manual | import | agent
  
  -- 审计
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_flg INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_highlights_source ON highlights(source_object_type, source_object_id);
CREATE INDEX idx_highlights_kind ON highlights(highlight_kind);
```

#### books 表（扩充）

```sql
CREATE TABLE books (
  id TEXT PRIMARY KEY,                     -- ULID: book_01JZ...
  title TEXT NOT NULL,
  author TEXT,
  cover_path TEXT,                         -- sources/library/books/{id}/cover.jpg
  
  -- 文件
  file_path TEXT NOT NULL,                 -- sources/library/books/{id}/source.epub
  file_type TEXT NOT NULL DEFAULT 'epub',  -- epub | pdf
  file_size_bytes INTEGER,
  
  -- 元数据
  language TEXT,
  publisher TEXT,
  description TEXT,
  
  -- 阅读状态
  read_status TEXT NOT NULL DEFAULT 'inbox',
  read_progress REAL DEFAULT 0,
  current_location TEXT,                   -- EPUB CFI 或 PDF 页码
  total_locations INTEGER,
  
  -- 审计
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_flg INTEGER NOT NULL DEFAULT 0
);
```

#### derivative_assets 表（新增，对齐 04 号方案 AI 衍生物）

```sql
CREATE TABLE derivative_assets (
  id TEXT PRIMARY KEY,                     -- ULID: drv_01JZ...
  source_object_id TEXT NOT NULL,          -- 来源内容对象 ID
  
  -- 衍生物类型
  asset_type TEXT NOT NULL,                -- transcript | translation | summary | digest | question_set
  target_locale TEXT,                      -- 翻译目标语言（BCP 47）
  
  -- 生成信息
  provider TEXT,                           -- openai | volcengine | tencent | google | bing | local
  generation_config_json TEXT,             -- 生成配置快照
  
  -- 内容
  content_json TEXT,                       -- 结构化内容（segments/paragraphs/text）
  file_path TEXT,                          -- 可选：大衍生物存文件
  
  -- 状态
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  progress REAL DEFAULT 0,
  quality_score REAL,
  
  -- 审计
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_flg INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_derivatives_source ON derivative_assets(source_object_id, asset_type);
CREATE INDEX idx_derivatives_status ON derivative_assets(status);
```

### 3.2 文件系统布局（对齐 13 号方案）

阅读器内容在文件系统中的存储：

```
sources/library/
  articles/{art_id}/
    original.html              ← 原始抓取（Layer 1: Raw）
    content.md                 ← 提取正文 + frontmatter（Layer 2: Readable）
    attachments/               ← 图片等附件
  books/{book_id}/
    source.epub | source.pdf   ← 原始文件（Layer 1: Raw）
    meta.md                    ← frontmatter 元数据
    cover.jpg                  ← 封面
  media/{art_id}/
    source.mp3 | source.mp4   ← 原始媒体（Layer 1: Raw）

.orbit/
  cache/
    extraction/{art_id}.json   ← 提取缓存
    thumbnails/{id}.jpg        ← 缩略图
  derived/
    transcripts/{drv_id}.json  ← ASR 转录（Layer 4: AI Derivative）
    translations/{drv_id}.json ← 翻译结果（Layer 4: AI Derivative）
```

### 3.3 对象索引同步规则

所有 reader 对象创建时必须同步写入 `object_index`：

```typescript
// 创建文章时
await db.exec(`INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, source_file_id, title, status, origin, visibility, version_token, created_at, updated_at)
  VALUES ('article:${id}', 'article', '${id}', 'articles', 'source', '${fileId}', ?, 'inbox', 'human', 'private', '${ulid()}', ?, ?)`);

// 创建高亮时（对齐 06 号方案：高亮是一等公民）
await db.exec(`INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, origin, ...)
  VALUES ('highlight:${id}', 'highlight', '${id}', 'highlights', 'system', ?, '${createdBy}', ...)`);

// 创建 links 关系
await db.exec(`INSERT INTO links (link_id, source_uid, target_uid, relation_type, origin, status, ...)
  VALUES (?, 'highlight:${hltId}', 'article:${artId}', 'excerpted_from', 'human', 'active', ...)`);
```

---

## 4. 运行时实现（对齐 04 号方案 8 阶段管线）

### 4.1 Resolver 层填充（`@orbit/reader-resolvers`）

现有接口已定义好（780 行），需要填充实际网络逻辑：

| Resolver | 需移植的旧代码 | 新增依赖 |
|----------|--------------|---------|
| `rss-resolver.ts` | `rss-service.ts` 的 feed 解析、OPML、podcast 检测 | `rss-parser` |
| `podcast-resolver.ts` | `podcast-resolver.ts` 的 Apple/Spotify/小宇宙 URL 解析 | 无 |
| `youtube-resolver.ts` | `youtube-service.ts` 的 videoId 提取、字幕下载、频道 RSS | `youtubei.js` |
| `generic-resolver.ts` | `parser-service.ts` 的 Readability 正文提取 | `@postlight/parser` |
| `newsletter-resolver.ts` | 新写，Substack/Revue RSS 适配 | 无 |

### 4.2 Content Pipeline 填充（`@orbit/feature-reader`）

现有接口（1,273 行），填充运行时逻辑：

#### Stage 3: Fetch
```typescript
// content-pipeline.ts 已有 FetchResult 接口，需实现：
async function fetchContent(url: string, options: FetchOptions): Promise<FetchResult> {
  // 移植自旧 rss-service.ts: HTTP fetch + etag + lastModified
  // 新增: 遵循 robots.txt、User-Agent 策略
}
```

#### Stage 5: Extract
```typescript
// content-pipeline.ts 已有 ExtractionResult 接口，需实现：
async function extractReadable(raw: FetchResult, contentType: string): Promise<ExtractionResult> {
  // 移植自旧 parser-service.ts: @postlight/parser 集成
  // 新增: 语言检测（对齐 17 号方案）、段落 ID 生成
}
```

#### Stage 5b: Transcribe
```typescript
// transcription-layer.ts 已有接口，需实现 2 个 Provider：
interface TranscriptionProvider {
  id: string;
  transcribe(audioPath: string, config: TranscriptionConfig): AsyncGenerator<TranscriptSegment>;
}

// Provider 1: 火山引擎 — 移植自 volc-asr-service.ts（340 行核心）
// Provider 2: 腾讯云 — 移植自 tencent-provider.ts（150 行核心）
// 共享: ffmpeg 音频预处理管线 — 移植自 audio-pipeline.ts
```

#### Stage 7: Translate
```typescript
// translation-layer.ts 已有接口，需实现引擎链：
interface TranslationEngine {
  id: string;
  translate(text: string, source: string, target: string): Promise<string>;
}

// 移植 5 个引擎: google-cloud, google-free, bing-free, azure, llm
// 移植 fallback-chain.ts: 引擎降级策略
// 移植 text-splitter.ts: CJK 感知段落分割
// 新增: 翻译结果写入 derivative_assets 表（不覆盖原文）
```

### 4.3 高亮引擎升级（对齐 06 号方案 4 层锚点）

旧 Orbit 高亮用简单 `anchorPath` 字符串。新 Orbit 需要 4 层 `AnchorPayload`：

```typescript
// highlight-engine.ts — 新增
interface AnchorPayload {
  sourceVersion?: string;
  locator: {
    // 文章: { paragraphIndex, domPath, blockId }
    // EPUB: { epubCfi }
    // PDF: { page, rects, textLayerOffsets }
    // 转录: { segmentIndex, startTime, endTime }
  };
  quote: string;
  prefix?: string;
  suffix?: string;
  textHash: string;
  state: 'active' | 'fuzzy' | 'detached';
}

// 移植旧 computeAnchorPath/resolveAnchorPath
// 升级: 添加 text fingerprint 回附能力
// 升级: 锚点状态机（active → fuzzy → detached）
```

### 4.4 SelectionContext 统一捕捉（对齐 06 号方案）

所有阅读面共享同一个选择上下文：

```typescript
// selection-context.ts — 新增于 feature-reader
interface SelectionContext {
  surfaceType: 'reader_article' | 'reader_book' | 'reader_podcast' | 'reader_video' | 'note_editor' | 'document_editor' | 'agent_reply';
  sourceObjectType: string;
  sourceObjectId: string;
  selectedText: string;
  surroundingText?: { prefix: string; suffix: string };
  anchor: AnchorPayload;
  blockRef?: { blockId?: string; startOffset?: number; endOffset?: number };
}

// 从 SelectionContext 可以：
// → 创建 HighlightObject
// → 创建 NoteObject(kind='annotation')
// → 向 Agent 提问（附带上下文）
// → 发送到 Research Space
// → 创建 Task
```

---

## 5. 平台层（对齐 15 号方案能力接口）

### 5.1 能力注册（而非传统 IPC Handler）

新 Orbit 不用旧版 503 个 IPC 通道的方式。所有阅读器能力通过 `@orbit/capability-core` 注册：

```typescript
// reader-capabilities.ts — 新增于 capability-core 或 feature-reader
const readerCapabilities = [
  // 来源发现
  { id: 'reader.discover_sources', handler: discoverSources },
  { id: 'reader.subscribe_source', handler: subscribeSource },
  { id: 'reader.capture_url', handler: captureUrl },
  { id: 'reader.import_local_media', handler: importLocalMedia },
  
  // 内容管线
  { id: 'reader.fetch_content', handler: fetchContent },
  { id: 'reader.extract_readable', handler: extractReadable },
  { id: 'reader.start_transcription', handler: startTranscription },
  { id: 'reader.start_translation', handler: startTranslation },
  
  // 阅读交互
  { id: 'reader.open', handler: openInReader },
  
  // 高亮与笔记（对齐 06 号方案）
  { id: 'selection.capture', handler: captureSelection },
  { id: 'highlight.create', handler: createHighlight },
  { id: 'highlight.list', handler: listHighlights },
  { id: 'note.create', handler: createNote },
  { id: 'note.attach_to_highlight', handler: attachNoteToHighlight },
  
  // 锚点
  { id: 'anchor.resolve', handler: resolveAnchor },
  
  // 流转
  { id: 'material.route_to_research', handler: routeToResearch },
  { id: 'material.route_to_action', handler: routeToAction },
];
```

这些能力同时通过 IPC（Electron 内部）和 MCP（外部 Agent）暴露。

### 5.2 Electron IPC 桥接

在 `apps/desktop` 的 preload/main 中，仍需要少量 IPC 用于：
- 文件系统操作（读写 sources/library/）
- ffmpeg 子进程调用
- 书籍文件二进制读取
- 本地媒体导入（文件选择对话框）

但这些是**平台原语**，不是业务逻辑 handler。

---

## 6. UI 层（HeroUI v3，对齐 04/06 号方案统一 Reader）

### 6.1 统一 Reader 布局（对齐 04 号方案）

所有内容类型共享同一 Reader 框架：

```
┌────────────────────────────────────────────────────────────────┐
│  ReaderHeader: 标题 | 来源 | 语言 | 管线状态 | 阅读模式切换     │
├──────────────────────────────────┬─────────────────────────────┤
│                                  │                             │
│  MainContent (按类型切换渲染器)   │  ContextSidebar             │
│  ├─ ArticleRenderer              │  ├─ 相关项目/研究            │
│  ├─ BookRenderer                 │  ├─ 已有高亮列表             │
│  ├─ PodcastRenderer              │  ├─ 已有笔记列表             │
│  └─ VideoRenderer                │  ├─ AI 建议                 │
│                                  │  └─ 来源链路                │
│  翻译层（双语覆盖/仅译/原文）     │                             │
│  高亮层（标记渲染 + 浮动工具栏）  │                             │
│                                  │                             │
├──────────────────────────────────┴─────────────────────────────┤
│  BottomBar: 播放控制(音视频) | 进度 | 段落定位 | 导出            │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 HeroUI v3 组件映射

| 组件 | HeroUI 基础 | 说明 |
|------|------------|------|
| ReaderHeader | `<div>` + Chip + Button | 状态标签用 Chip |
| ArticleRenderer | 自定义 prose 容器 | Tailwind typography |
| AudioPlayer | Range + Button + 自定义 | 播放/暂停/变速/进度条 |
| VideoPlayer | HTML5 video + 自定义控件 | 双轨同步 |
| TranscriptView | 自定义列表 | 时间码 + 高亮同步 |
| HighlightToolbar | Popover + Button group | 浮动选择菜单 |
| TranslationToggle | Switch + Tabs | 原文/双语/译文切换 |
| ContextSidebar | Card + Accordion | 折叠式上下文面板 |
| BookToc | 自定义树 | 章节导航 |

### 6.3 SelectionContext 浮动菜单（对齐 06 号方案）

用户选中文本后，弹出统一浮动工具栏：

```
┌──────────────────────────────────────┐
│ 🖍 高亮  📝 边注  🤖 问 Agent  📌 任务 │
│ 📚 加入研究  🏷️ 标签                   │
└──────────────────────────────────────┘
```

- "高亮" → 创建 HighlightObject，写入 object_index + links
- "边注" → 先创建 Highlight，再创建 Note(kind='annotation')，链接关系 `annotated_by`
- "问 Agent" → 构造 SelectionContext，打开 Agent 面板（不自动创建高亮）
- "任务" → 创建 Task，链接关系 `derived_from` 指向高亮
- "加入研究" → 链接关系 `supports` 指向选定的 Research Space

---

## 7. 实施阶段

### Phase 0: DB Schema 扩充（~2 天）

**目标**：在现有 `@orbit/db-schema` 中补充 reader 类型表详细列定义

- [ ] 扩充 `type-tables.ts` Input 家族：articles、books、highlights 详细列
- [ ] 新增 `source_endpoints` 表
- [ ] 新增 `derivative_assets` 表（对齐 04 号方案 AI 衍生物）
- [ ] 补充 reader 相关索引
- [ ] 更新 `getBootstrapSql()` 依赖顺序
- [ ] 在 `@orbit/domain` 补充类型接口字段

**不需要做**：object_index / links / events / file_index（已有）

### Phase 1: Resolver 运行时（~3 天）

**目标**：在 `@orbit/reader-resolvers` 现有接口上填充实际网络逻辑

- [ ] 安装依赖：`rss-parser`、`youtubei.js`、`@postlight/parser`
- [ ] `rss-resolver.ts`：移植 feed 解析 + OPML 导入
- [ ] `podcast-resolver.ts`：移植 Apple/Spotify/小宇宙 URL 解析
- [ ] `youtube-resolver.ts`：移植 videoId 提取 + 字幕下载
- [ ] `generic-resolver.ts`：移植 Readability 正文提取 + 语言检测
- [ ] `resolver-router.ts`：集成测试

### Phase 2: Content Pipeline 运行时（~5 天）

**目标**：在 `@orbit/feature-reader` 现有接口上填充内容处理逻辑

- [ ] `content-pipeline.ts`：实现 fetch → extract → normalize 管线
- [ ] `subscription-manager.ts`：实现 feed 定时抓取 + 去重
- [ ] `fetch-scheduler.ts`：实现自适应重试 + 退避
- [ ] `media-renderers.ts`：实现文章/书籍/播客/视频渲染适配
- [ ] `content-state-machine.ts`：实现完整状态转换

### Phase 3: ASR + Translation 运行时（~5 天）

**目标**：移植旧 Orbit 经过验证的 ASR 和翻译引擎

- [ ] 安装依赖：`ffmpeg-static`
- [ ] 实现 `TranscriptionProvider` 接口 + 火山引擎 Provider
- [ ] 实现腾讯云 Provider
- [ ] 移植 ffmpeg 音频预处理管线
- [ ] 移植智能段落合并算法
- [ ] 实现 `TranslationEngine` 接口 + 5 个引擎
- [ ] 移植翻译 task runner（段落分批 + 并发控制）
- [ ] 移植 CJK 感知文本分割器
- [ ] 衍生物写入 `derivative_assets` 表

### Phase 4: 高亮 + SelectionContext（~3 天）

**目标**：对齐 06 号方案的 4 层锚点和统一选择上下文

- [ ] 实现 `AnchorPayload` 4 层模型
- [ ] 实现 `SelectionContext` 统一接口
- [ ] 移植旧版 XPath 锚点算法，适配到新 locator 层
- [ ] 实现 text fingerprint 回附（fuzzy matching）
- [ ] 实现锚点状态机（active → fuzzy → detached）
- [ ] 高亮创建时同步写入 object_index + links

### Phase 5: 能力注册 + IPC（~2 天）

**目标**：注册 reader 能力到 capability-core，桥接 Electron IPC

- [ ] 注册全部 reader capabilities
- [ ] 实现 Electron preload 桥接（文件操作、ffmpeg 调用等平台原语）
- [ ] 实现进度事件广播（ASR/Translation 进度）

### Phase 6: UI 组件（~8 天）

**目标**：用 HeroUI v3 构建所有阅读器 React 组件

- [ ] ReaderShell（统一容器 + 路由）
- [ ] ArticleRenderer + ArticleReaderView
- [ ] AudioPlayer（变速/进度/断点续播）
- [ ] PodcastReaderView（音频 + 转录同步）
- [ ] VideoPlayer（双轨同步 + 画质切换）
- [ ] VideoReaderView（视频 + 字幕 + 转录）
- [ ] BookReaderView + EpubRenderer + PdfRenderer
- [ ] BookToc + BookLibrary
- [ ] TranscriptView（时间码 + 高亮联动）
- [ ] HighlightToolbar（浮动选择菜单）
- [ ] TranslationOverlay（双语/原文/译文切换）
- [ ] ContextSidebar（关联项目/笔记/研究）

### Phase 7: 集成 + 路由（~2 天）

**目标**：在 desktop app 中集成

- [ ] 路由: `/reader/:type/:id`
- [ ] 侧边栏: 文章/播客/视频/书籍入口
- [ ] 内容列表页
- [ ] 全局命令面板集成

---

## 8. 依赖清单

### 新增到 monorepo

| 包 | 安装位置 | 用途 |
|---|---------|------|
| `rss-parser` | reader-resolvers | RSS/Atom 解析 |
| `youtubei.js` | reader-resolvers | YouTube Innertube API |
| `@postlight/parser` | reader-resolvers | 网页正文提取 |
| `epubjs` | feature-reader | EPUB 渲染 |
| `pdfjs-dist` | feature-reader | PDF 渲染 |
| `ffmpeg-static` | platform-electron | 音频转码 |

### 已有可复用

| 能力 | 新 Orbit 包 |
|------|-----------|
| SQLite Schema | `@orbit/db-schema`（object_index/links/events/file_index 已有） |
| 对象类型 | `@orbit/domain`（38 种类型已定义） |
| 对象图谱 | `@orbit/object-graph`（link CRUD/图遍历/密度计算） |
| 数据协议 | `@orbit/data-protocol`（Repository 接口/Mutation envelope） |
| 工作区布局 | `@orbit/workspace-core`（3 层目录/frontmatter/编译管线） |
| 能力系统 | `@orbit/capability-core`（MCP server/策略引擎/审批） |
| Agent 核心 | `@orbit/agent-core`（19 个 LLM provider/安全链/审计） |
| UI 组件 | `@heroui/react`（HeroUI v3 设计系统） |
| i18n | `@orbit/i18n`（三语支持已有） |
| 同步 | `@orbit/sync-core`（冲突解决/E2E 加密/CAS） |

---

## 9. 风险与对策

| 风险 | 影响 | 对策 |
|-----|------|------|
| epub.js/pdf.js 与 Electron sandbox 冲突 | 书籍无法渲染 | Phase 6 开头先做 PoC |
| 火山引擎 WebSocket 二进制协议移植 | ASR 不可用 | 保留旧代码可运行的参考实现 |
| 旧 anchorPath 格式迁移到 4 层 AnchorPayload | 旧高亮数据丢失 | 写兼容层：`xpath:` → locator + quote |
| @postlight/parser 维护状态 | 正文提取失效 | 备选 Mozilla Readability |
| YouTube API 变更 | 视频解析失败 | youtubei.js 比 yt-dlp 更新更快 |

---

## 10. 与旧迁移计划的对比

| 维度 | 旧计划 (废弃) | 本计划 |
|------|-------------|-------|
| 数据模型 | 照搬旧 articles 大宽表 | 用新 type tables + object_index |
| 对象网络 | 未考虑 | 所有对象进 object_index + links |
| 高亮系统 | 照搬旧 anchorPath | 升级为 4 层 AnchorPayload |
| 文件系统 | 未考虑 | 对齐 sources/wiki/.orbit 三层 |
| 翻译存储 | 照搬旧 paragraphs JSON | 写入 derivative_assets 表 |
| 能力暴露 | 传统 IPC handler | capability interface + MCP |
| 关系系统 | 无 | 统一 links 表 + 关系词汇表 |
| 三语支持 | 未考虑 | 对齐 17 号方案语言检测 |
| 代码量 | ~9,000 行全新 | ~5,000 行新 + 2,500 行移植 |
