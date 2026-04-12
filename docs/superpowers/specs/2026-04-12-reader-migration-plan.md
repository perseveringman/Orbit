# Old Orbit → New Orbit 阅读模块迁移计划

> 日期: 2026-04-12
> 状态: Draft
> 范围: 文章阅读器、播客阅读器、视频阅读器、书籍阅读器

---

## 1. 执行摘要

将旧 Orbit 项目 (`/Users/ryanbzhou/Developer/old-orbit`) 中的四大阅读器模块迁移到新 Orbit monorepo 中，作为新版本的核心阅读能力。新 Orbit 已有 `feature-reader`、`reader-resolvers`、`db-schema` 等包的骨架，本计划利用已有架构，将旧版成熟功能填充进来。

### 迁移目标

| 模块 | 旧版代码量 | 核心能力 |
|------|-----------|---------|
| 📰 文章阅读器 | ~3000 行 | 正文提取、Readability 清洗、高亮标注、翻译、语言学习 |
| 🎙️ 播客阅读器 | ~2200 行 | RSS 订阅、音频播放、ASR 转写、转录同步、翻译 |
| 🎬 视频阅读器 | ~2500 行 | YouTube/本地视频、字幕提取、双轨音频同步、ASR、翻译 |
| 📚 书籍阅读器 | ~3500 行 | EPUB (epub.js)、PDF (pdf.js)、目录导航、进度、书签 |
| 🏗️ 共享基础设施 | ~5000 行 | SQLite/Drizzle ORM、503 IPC 通道、AI 服务层、翻译/高亮系统 |

---

## 2. 旧项目技术分析概要

### 2.1 架构总览

```
旧 Orbit (单体 Electron 应用)
├─ src/main/           ← Electron 主进程 (IPC handlers, DB, 后台服务)
│  ├─ db/schema.ts     ← Drizzle ORM, 50+ 张表
│  ├─ handlers/        ← 503 个 IPC 通道
│  └─ services/        ← RSS、YouTube、ASR、翻译、下载
├─ src/renderer/       ← React 渲染层
│  ├─ components/      ← 60+ 组件 (各阅读器 + 通用)
│  ├─ contexts/        ← React Context (主题、路由、通知)
│  └─ hooks/           ← 自定义 Hooks
├─ src/shared/         ← IPC 契约、类型定义
└─ src/ai/             ← AI 服务层 (LLM、Embedding、摘要)
```

### 2.2 核心依赖

| 依赖 | 版本 | 用途 | 新 Orbit 对应 |
|-----|------|------|-------------|
| `better-sqlite3` | ^12.6.2 | SQLite 驱动 | `@orbit/db-schema` |
| `drizzle-orm` | ^0.45.1 | ORM | `@orbit/db-schema` |
| `epubjs` | ^0.3.93 | EPUB 渲染 | 需引入 |
| `pdfjs-dist` | ^5.4.624 | PDF 渲染 | 需引入 |
| `rss-parser` | ^3.13.0 | RSS 解析 | `@orbit/reader-resolvers` |
| `ffmpeg-static` | ^5.3.0 | 音频转码 | 需引入 |
| `youtubei.js` | ^16.0.1 | YouTube API | 需引入 |
| `lucide-react` | ^0.563.0 | 图标 | 迁移到 HeroUI 图标 |

### 2.3 数据模型 (核心表)

| 表 | 字段数 | 用于 |
|---|-------|-----|
| `articles` | 30+ | 所有内容类型 (文章/播客/视频/书籍) |
| `feeds` | 12 | RSS/Podcast 订阅源 |
| `highlights` | 10 | 高亮标注 (anchorPath 定位) |
| `transcripts` | 6 | ASR 转录 (JSON segments) |
| `translations` | 8 | 翻译缓存 (paragraphs) |
| `books` | 15 | 书籍元数据、进度 |
| `downloads` | 8 | 离线下载任务 |
| `app_tasks` | 10 | 后台任务队列 (ASR 等) |

### 2.4 四大阅读器关键特性

#### 📰 文章阅读器
- **正文提取**: Readability 算法清洗 HTML
- **渲染**: 自定义 Markdown 渲染器 + 高亮叠加层
- **高亮系统**: XPath anchorPath 定位、标签分类、笔记批注
- **翻译**: 段落级流式翻译 (Google/Bing/LLM)
- **语言学习**: 词汇标记、词频统计
- **文内搜索**: Ctrl+F 实现 (find-in-document.ts)

#### 🎙️ 播客阅读器
- **订阅管理**: RSS 解析、iTunes/PodcastIndex 搜索、URL 智能解析
- **音频播放**: HTML5 Audio、变速 (0.5x-3x)、快进快退、断点续播
- **ASR 转写**: 火山引擎 (WebSocket) + 腾讯云 (HTTP)、ffmpeg 音频预处理
- **转录同步**: 实时滚动定位、speaker 标识、智能段落合并
- **高亮**: transcript:5-8 段落范围锚定

#### 🎬 视频阅读器
- **视频源**: YouTube (yt-dlp 流提取) + 本地文件
- **播放器**: 双轨同步 (视频+独立音频)、画质切换、URL 过期重试
- **字幕**: YouTube json3 字幕下载、语言自动选择
- **ASR**: 同播客，复用火山/腾讯 ASR
- **智能段落**: 2s 原始段合并为 8-30s 段落、标点断句、CJK 检测
- **浮动字幕**: 双语字幕叠加层

#### 📚 书籍阅读器
- **EPUB**: epub.js 渲染、目录提取、章节导航
- **PDF**: pdf.js Canvas 渲染、文本层提取、结构化目录生成
- **进度**: 百分比/页码追踪、自动保存
- **翻译**: 整章翻译、双语对照
- **书库**: 导入/上传、封面提取、元数据管理

---

## 3. 新 Orbit 目标架构

### 3.1 包映射

```
新 Orbit Monorepo
├─ packages/
│  ├─ feature-reader/          ← 阅读器业务逻辑层 (已有骨架)
│  │  ├─ article-renderer.ts   ← [新增] 文章渲染管线
│  │  ├─ podcast-renderer.ts   ← [填充] 播客渲染逻辑
│  │  ├─ video-renderer.ts     ← [填充] 视频渲染逻辑
│  │  ├─ book-renderer.ts      ← [新增] 书籍渲染逻辑
│  │  ├─ transcription-layer.ts← [填充] ASR 对接
│  │  ├─ translation-layer.ts  ← [填充] 翻译管线
│  │  ├─ highlight-engine.ts   ← [新增] 高亮标注引擎
│  │  ├─ content-pipeline.ts   ← [填充] 内容清洗管线
│  │  └─ subscription-manager.ts← [填充] 订阅管理
│  │
│  ├─ reader-resolvers/        ← 内容源解析 (已有骨架)
│  │  ├─ rss-resolver.ts       ← [填充] RSS 解析
│  │  ├─ podcast-resolver.ts   ← [填充] 播客搜索/URL解析
│  │  ├─ youtube-resolver.ts   ← [填充] YouTube 流提取
│  │  └─ generic-resolver.ts   ← [填充] 通用 URL 解析
│  │
│  ├─ db-schema/               ← 数据库 Schema (已有骨架)
│  │  └─ tables/               ← [新增] articles, feeds, highlights,
│  │                               transcripts, translations, books,
│  │                               downloads, app_tasks
│  │
│  ├─ platform-electron/       ← Electron 平台层
│  │  └─ ipc-handlers/         ← [新增] 阅读器 IPC handlers
│  │     ├─ article-handlers.ts
│  │     ├─ feed-handlers.ts
│  │     ├─ highlight-handlers.ts
│  │     ├─ asr-handlers.ts
│  │     ├─ translation-handlers.ts
│  │     ├─ youtube-handlers.ts
│  │     ├─ download-handlers.ts
│  │     └─ book-handlers.ts
│  │
│  └─ ui-dom/                  ← UI 组件 (HeroUI v3)
│     └─ reader/               ← [新增] 阅读器 React 组件
│        ├─ ArticleReaderView.tsx
│        ├─ PodcastReaderView.tsx
│        ├─ VideoReaderView.tsx
│        ├─ BookReaderView.tsx
│        ├─ AudioPlayer.tsx
│        ├─ VideoPlayer.tsx
│        ├─ TranscriptView.tsx
│        ├─ AnnotationLayer.tsx
│        ├─ HighlightToolbar.tsx
│        └─ ReaderSettings.tsx
│
└─ apps/desktop/               ← Electron 宿主
   └─ src/renderer-entry/
      └─ reader/               ← [新增] 阅读器页面集成
```

### 3.2 分层原则

```
┌─────────────────────────────────────────────────────────┐
│  UI 层 (ui-dom/reader/)                                 │
│  HeroUI v3 组件、Tailwind CSS v4                        │
│  纯展示，通过 props/callbacks 与业务层交互               │
├─────────────────────────────────────────────────────────┤
│  业务逻辑层 (feature-reader/)                            │
│  View Model、状态机、渲染管线                            │
│  零 UI 依赖，纯 TypeScript                               │
├─────────────────────────────────────────────────────────┤
│  解析层 (reader-resolvers/)                              │
│  URL 解析、RSS 解析、YouTube 流提取                      │
│  零 UI 依赖，纯 Node.js                                  │
├─────────────────────────────────────────────────────────┤
│  数据层 (db-schema/)                                     │
│  表定义、索引、迁移                                       │
├─────────────────────────────────────────────────────────┤
│  平台层 (platform-electron/)                             │
│  IPC handlers、文件系统、ffmpeg、yt-dlp                  │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 迁移阶段

### Phase 1: 数据层 — DB Schema 迁移

**目标**: 将旧版 50+ 张表中与阅读器相关的核心表迁移到 `@orbit/db-schema`

**新增表**:
1. `articles` — 统一内容表 (文章/播客/视频)
2. `feeds` — RSS/Podcast 订阅源
3. `highlights` — 高亮标注 (含 anchorPath)
4. `highlight_tags` — 标签关联
5. `transcripts` — ASR 转录
6. `translations` — 翻译缓存
7. `books` — 书籍元数据
8. `downloads` — 离线下载
9. `app_tasks` — 后台任务队列

**关键设计决策**:
- 保持 `articles` 表统一 (所有内容类型共用)，通过 `contentType` 字段区分
- `highlights.anchorPath` 保持 `xpath:...` 和 `transcript:N-M` 双格式
- `transcripts.segments` 存为 JSON 字符串
- 全部使用 `deleted_flg` 软删除

### Phase 2: 解析层 — Reader Resolvers 填充

**目标**: 填充 `@orbit/reader-resolvers` 中已有骨架文件

**迁移内容**:
1. `rss-resolver.ts` ← 旧版 RSS 解析 + iTunes 自定义字段映射
2. `podcast-resolver.ts` ← iTunes/PodcastIndex 搜索 + URL 智能解析
3. `youtube-resolver.ts` ← yt-dlp 流提取 + 字幕下载 + Innertube 元数据
4. `generic-resolver.ts` ← Readability 正文提取 + 通用 URL 解析
5. `newsletter-resolver.ts` ← 邮件/WeChat 内容解析

**新增依赖**: `rss-parser`, `youtubei.js`

### Phase 3: 业务逻辑层 — Feature Reader 填充

**目标**: 填充 `@orbit/feature-reader` 中已有骨架文件

**迁移内容**:
1. `content-pipeline.ts` ← HTML 清洗、Readability、元数据提取
2. `subscription-manager.ts` ← Feed CRUD、自动刷新调度
3. `transcription-layer.ts` ← ASR 服务对接 (火山引擎/腾讯云)
4. `translation-layer.ts` ← 流式翻译管线 (Google/Bing/LLM)
5. `podcast-renderer.ts` ← 播客播放状态机、进度管理
6. `video-renderer.ts` ← 视频播放状态机、双轨同步
7. `highlight-engine.ts` ← [新增] 高亮引擎 (XPath/Transcript 锚定)
8. `article-renderer.ts` ← [新增] 文章渲染管线
9. `book-renderer.ts` ← [新增] EPUB/PDF 渲染管线
10. `smart-segment-merger.ts` ← [新增] 智能段落合并算法

**新增依赖**: `epubjs`, `pdfjs-dist`, `ffmpeg-static`

### Phase 4: 平台层 — IPC Handlers

**目标**: 在 `@orbit/platform-electron` 中添加阅读器相关 IPC handlers

**迁移内容** (从旧版 503 个通道中提取阅读器相关的 ~80 个):
1. `article-handlers.ts` — 文章 CRUD、正文提取
2. `feed-handlers.ts` — 订阅源管理、自动抓取
3. `highlight-handlers.ts` — 高亮 CRUD、标签管理
4. `asr-handlers.ts` — ASR 启动/取消、进度事件
5. `transcript-handlers.ts` — 转录缓存、speaker 管理
6. `translation-handlers.ts` — 翻译启动、进度流、缓存
7. `youtube-handlers.ts` — 流提取、元数据、认证
8. `download-handlers.ts` — 音视频下载、进度
9. `book-handlers.ts` — 书籍导入、元数据提取

### Phase 5: UI 层 — React 组件 (HeroUI v3)

**目标**: 用 HeroUI v3 重写所有阅读器 UI 组件

#### 5a. 共享组件
1. `TranscriptView.tsx` — 转录显示 (播客/视频共用)
2. `AnnotationLayer.tsx` — 高亮叠加层
3. `HighlightToolbar.tsx` — 高亮操作工具栏
4. `AudioPlayer.tsx` — 音频播放器 (播客/视频音频轨)
5. `ReaderSettings.tsx` — 阅读器通用设置

#### 5b. 文章阅读器
1. `ArticleReaderView.tsx` — 主容器
2. `ArticleContent.tsx` — 清洗后正文渲染
3. `ArticleCard.tsx` — 文章列表卡片

#### 5c. 播客阅读器
1. `PodcastReaderView.tsx` — 主容器 (音频+转录+翻译)
2. `PodcastSearchPanel.tsx` — 播客搜索/订阅
3. `FeedManager.tsx` — 订阅源管理

#### 5d. 视频阅读器
1. `VideoReaderView.tsx` — 主容器
2. `VideoPlayer.tsx` — 视频播放器 (双轨同步、画质切换)
3. `SubtitleOverlay.tsx` — 浮动双语字幕

#### 5e. 书籍阅读器
1. `BookReaderView.tsx` — 主容器
2. `EpubRenderer.tsx` — epub.js 渲染封装
3. `PdfRenderer.tsx` — pdf.js 渲染封装
4. `BookToc.tsx` — 目录导航
5. `BookLibrary.tsx` — 书库管理

### Phase 6: 宿主集成

**目标**: 在 `apps/desktop` 中集成阅读器页面

1. 添加路由: `/reader/article/:id`, `/reader/podcast/:id`, `/reader/video/:id`, `/reader/book/:id`
2. 侧边栏导航: 文章、播客、视频、书籍入口
3. 内容列表页: 统一的 ContentList + 类型筛选
4. 添加订阅入口: 侧边栏 + 命令面板

---

## 5. 技术决策

### 5.1 保留的设计
- **统一 articles 表**: 所有内容类型共用一张表，contentType 区分
- **anchorPath 高亮定位**: XPath (文章) + transcript:N-M (音视频) 双格式
- **智能段落合并**: 2s 原始段 → 8-30s 段落，CJK 检测，标点断句
- **断点续播**: readProgress 字段保存 0-1 进度比例
- **ASR 双模式**: 实时 WebSocket (火山引擎) + 后台 HTTP (腾讯云)

### 5.2 改进的设计
- **UI 框架**: lucide-react + Tailwind → HeroUI v3 + Tailwind CSS v4
- **状态管理**: 组件内 useState 散落 → feature-reader 层 ViewModel 集中管理
- **IPC 契约**: 散落字符串 → `@orbit/platform-contracts` 类型安全契约
- **翻译服务**: 硬编码提供商 → `@orbit/agent-core` 统一 LLM 路由
- **测试**: 无测试 → 每层有 vitest 单元测试

### 5.3 不迁移的部分
- WeChat 公众号相关 (wechat-*)：暂不迁移
- 知识图谱 (KG) 模块：独立规划
- 写作助手 (WritingAssist)：独立规划
- 研究模块 (Research)：独立规划
- 时间管理 (Time Block)：独立规划

---

## 6. 依赖清单

### 需新增到 monorepo 的依赖

| 包 | 安装位置 | 用途 |
|---|---------|------|
| `rss-parser` | `reader-resolvers` | RSS/Atom 解析 |
| `youtubei.js` | `reader-resolvers` | YouTube Innertube API |
| `epubjs` | `feature-reader` | EPUB 渲染引擎 |
| `pdfjs-dist` | `feature-reader` | PDF 渲染引擎 |
| `ffmpeg-static` | `platform-electron` | 音频转码 (ASR 前处理) |

### 已有可复用的依赖

| 能力 | 新 Orbit 已有 | 说明 |
|------|-------------|------|
| SQLite ORM | `@orbit/db-schema` | Drizzle ORM 已配置 |
| LLM 调用 | `@orbit/agent-core` | 19 个 provider，可替代翻译/摘要 |
| IPC 桥 | `@orbit/platform-contracts` | 类型安全 IPC 契约 |
| UI 组件 | `@heroui/react` | HeroUI v3 设计系统 |
| 国际化 | `@orbit/i18n` | 已有框架 |

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|-----|------|------|
| epub.js / pdf.js 与 Electron 沙盒冲突 | 书籍阅读器无法渲染 | Phase 5e 开始时先做 PoC |
| yt-dlp 系统依赖 | 用户需手动安装 | 提供自动下载脚本，或改用 youtubei.js 纯 JS 方案 |
| ASR 服务 API Key 管理 | 用户配置复杂 | 复用 agent-core 的 LLMConfigStore 模式 |
| 旧版 50+ 表全量迁移 | 数据库膨胀 | 只迁移阅读器相关 9 张表 |
| 组件状态复杂 (VideoReaderView 43 个 state) | 难维护 | 拆分为 ViewModel + 多个子 hooks |

---

## 8. 执行顺序建议

```
Phase 1 (DB Schema)      ████████░░░░░░░░░░░░
Phase 2 (Resolvers)       ░░░░████████░░░░░░░░
Phase 3 (Feature Logic)   ░░░░░░░░████████░░░░
Phase 4 (IPC Handlers)    ░░░░░░░░░░░░████░░░░
Phase 5 (UI Components)   ░░░░░░░░░░░░░░██████
Phase 6 (Integration)     ░░░░░░░░░░░░░░░░░░██
```

**可并行**: Phase 1 完成后，Phase 2/3/4 可并行开发（它们只依赖 Schema 定义）。
Phase 5 依赖 Phase 3 的 ViewModel 接口。Phase 6 依赖所有前置阶段。

---

## 9. 附录：分析报告文件

以下分析报告由 5 个并行 Agent 深度阅读旧版源码生成：

| 报告 | 内容 |
|------|------|
| `article-reader-analysis.txt` | 文章阅读器完整技术分析 (36.8 KB) |
| `book-reader-analysis.txt` | 书籍阅读器完整技术分析 (46.3 KB) |
| `podcast-reader-analysis.txt` | 播客阅读器完整技术分析 |
| `video-reader-analysis.txt` | 视频阅读器完整技术分析 |
| `shared-infra-analysis.txt` | 共享基础设施完整技术分析 (42.4 KB) |

报告存放位置: session files 目录
