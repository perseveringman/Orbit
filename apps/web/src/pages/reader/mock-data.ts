// Mock data for the Full-Source Reading (全源阅读) UI

export type ArticleStatus = 'unread' | 'reading' | 'archived';

export interface Article {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  sourceType: 'rss' | 'site-watch' | 'channel' | 'manual';
  author: string;
  publishedAt: string;
  status: ArticleStatus;
  readingProgress: number;
  tags: string[];
}

export interface Subscription {
  id: string;
  title: string;
  kind: 'rss' | 'site-watch' | 'channel';
  url: string;
  status: 'active' | 'paused';
  fetchInterval: string;
  lastFetchedAt: string;
  articleCount: number;
}

export interface Highlight {
  id: string;
  articleId: string;
  text: string;
  color: string;
  note: string;
  createdAt: string;
}

export interface OutlineHeading {
  id: string;
  level: number;
  text: string;
}

export const MOCK_ARTICLES: Article[] = [
  {
    id: 'art-1',
    title: 'Transformer 架构的最新进展与实践指南',
    source: 'AI 前沿周刊',
    sourceUrl: 'https://example.com/ai-weekly',
    sourceType: 'rss',
    author: '张明',
    publishedAt: '2026-04-09T08:00:00Z',
    status: 'unread',
    readingProgress: 0,
    tags: ['AI', 'Transformer'],
  },
  {
    id: 'art-2',
    title: 'Building Resilient Distributed Systems with Rust',
    source: 'Systems Weekly',
    sourceUrl: 'https://example.com/systems-weekly',
    sourceType: 'rss',
    author: 'Alex Chen',
    publishedAt: '2026-04-08T14:30:00Z',
    status: 'reading',
    readingProgress: 45,
    tags: ['Rust', 'Distributed Systems'],
  },
  {
    id: 'art-3',
    title: '全栈 TypeScript 工程化实践：从 monorepo 到部署',
    source: '前端观察',
    sourceUrl: 'https://example.com/frontend-observer',
    sourceType: 'channel',
    author: '李华',
    publishedAt: '2026-04-08T10:15:00Z',
    status: 'reading',
    readingProgress: 72,
    tags: ['TypeScript', 'Engineering'],
  },
  {
    id: 'art-4',
    title: 'The Future of Web Components in 2026',
    source: 'Web Platform News',
    sourceUrl: 'https://example.com/web-platform',
    sourceType: 'site-watch',
    author: 'Sarah Miller',
    publishedAt: '2026-04-07T16:00:00Z',
    status: 'archived',
    readingProgress: 100,
    tags: ['Web Components', 'Standards'],
  },
  {
    id: 'art-5',
    title: '深度学习框架性能对比：PyTorch 3.0 vs JAX 2.0',
    source: 'ML 工程师日报',
    sourceUrl: 'https://example.com/ml-daily',
    sourceType: 'rss',
    author: '王强',
    publishedAt: '2026-04-07T09:45:00Z',
    status: 'unread',
    readingProgress: 0,
    tags: ['ML', 'Performance'],
  },
  {
    id: 'art-6',
    title: 'Designing for Calm Technology: Principles and Patterns',
    source: 'UX Collective',
    sourceUrl: 'https://example.com/ux-collective',
    sourceType: 'rss',
    author: 'Emily Zhang',
    publishedAt: '2026-04-06T12:00:00Z',
    status: 'unread',
    readingProgress: 0,
    tags: ['Design', 'UX'],
  },
  {
    id: 'art-7',
    title: 'PostgreSQL 17 新特性解读与迁移指南',
    source: '数据库内核月刊',
    sourceUrl: 'https://example.com/db-monthly',
    sourceType: 'channel',
    author: '赵磊',
    publishedAt: '2026-04-05T18:30:00Z',
    status: 'archived',
    readingProgress: 100,
    tags: ['PostgreSQL', 'Database'],
  },
  {
    id: 'art-8',
    title: 'SwiftUI 7 与 iOS 20 的 Adaptive Layout 新范式',
    source: 'Apple Dev Weekly',
    sourceUrl: 'https://example.com/apple-dev',
    sourceType: 'site-watch',
    author: 'Mike Johnson',
    publishedAt: '2026-04-05T08:00:00Z',
    status: 'reading',
    readingProgress: 30,
    tags: ['SwiftUI', 'iOS'],
  },
  {
    id: 'art-9',
    title: '如何构建自己的知识管理系统',
    source: '效率工具箱',
    sourceUrl: 'https://example.com/productivity',
    sourceType: 'rss',
    author: '陈晨',
    publishedAt: '2026-04-04T15:00:00Z',
    status: 'unread',
    readingProgress: 0,
    tags: ['PKM', 'Productivity'],
  },
];

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-1',
    title: 'AI 前沿周刊',
    kind: 'rss',
    url: 'https://example.com/ai-weekly/feed.xml',
    status: 'active',
    fetchInterval: '每 6 小时',
    lastFetchedAt: '2026-04-09T06:00:00Z',
    articleCount: 142,
  },
  {
    id: 'sub-2',
    title: 'Web Platform News',
    kind: 'site-watch',
    url: 'https://example.com/web-platform',
    status: 'active',
    fetchInterval: '每日',
    lastFetchedAt: '2026-04-09T00:00:00Z',
    articleCount: 56,
  },
  {
    id: 'sub-3',
    title: '前端观察',
    kind: 'channel',
    url: 'https://example.com/frontend-observer/channel',
    status: 'paused',
    fetchInterval: '每 12 小时',
    lastFetchedAt: '2026-04-07T12:00:00Z',
    articleCount: 89,
  },
];

export const MOCK_HIGHLIGHTS: Highlight[] = [
  {
    id: 'hl-1',
    articleId: 'art-2',
    text: 'Resilience is not about preventing failures, but about recovering from them gracefully.',
    color: '#fbbf24',
    note: '这个观点和 Erlang 的 let-it-crash 哲学很像',
    createdAt: '2026-04-08T15:00:00Z',
  },
  {
    id: 'hl-2',
    articleId: 'art-2',
    text: 'Circuit breakers should be the first line of defense in any distributed architecture.',
    color: '#34d399',
    note: '',
    createdAt: '2026-04-08T15:05:00Z',
  },
  {
    id: 'hl-3',
    articleId: 'art-2',
    text: 'The key insight is that timeout values should be dynamically adjusted based on p99 latency.',
    color: '#60a5fa',
    note: '可以用于 Orbit sync 层的超时策略',
    createdAt: '2026-04-08T15:12:00Z',
  },
  {
    id: 'hl-4',
    articleId: 'art-3',
    text: 'Monorepo 不是银弹，但对于需要共享类型和工具的全栈项目来说，它是最合理的选择。',
    color: '#f472b6',
    note: '',
    createdAt: '2026-04-08T11:00:00Z',
  },
];

export const MOCK_ARTICLE_BODY = `# Building Resilient Distributed Systems with Rust

## Introduction

In the era of cloud-native computing, building reliable distributed systems has become both more important and more challenging. Rust's ownership model and zero-cost abstractions provide unique advantages for writing concurrent, fault-tolerant services.

本文将从实际工程经验出发，探讨如何利用 Rust 的类型系统和并发原语来构建可靠的分布式系统。我们将重点关注以下几个方面：错误处理策略、重试机制、断路器模式以及可观测性。

## Error Handling Patterns

Resilience is not about preventing failures, but about recovering from them gracefully. In Rust, the \`Result\` type provides a powerful foundation for explicit error handling:

\`\`\`rust
#[derive(Debug, thiserror::Error)]
enum ServiceError {
    #[error("connection timeout after {0:?}")]
    Timeout(Duration),
    #[error("circuit breaker open for {service}")]
    CircuitOpen { service: String },
}
\`\`\`

每一个可能失败的操作都应该返回明确的错误类型，而不是依赖 panic 或隐式的错误传播。这种显式的错误处理方式使得代码的可靠性大幅提升。

## Circuit Breaker Pattern

Circuit breakers should be the first line of defense in any distributed architecture. They prevent cascade failures by temporarily stopping requests to unhealthy services:

- **Closed**: 正常状态，请求正常转发
- **Open**: 熔断状态，快速失败
- **Half-Open**: 探测状态，允许少量请求通过

The key insight is that timeout values should be dynamically adjusted based on p99 latency. Static timeouts are a common source of production incidents.

## Observability

可观测性是分布式系统的生命线。通过结构化日志、分布式追踪和指标采集，我们可以在问题发生时快速定位根因。Rust 的 \`tracing\` 生态系统为此提供了优秀的工具支持。

> "You can't fix what you can't see." — 这句话在分布式系统领域尤为重要。

## Conclusion

Building resilient distributed systems requires a combination of good abstractions, explicit error handling, and comprehensive observability. Rust provides the tools to achieve all three without sacrificing performance.`;

export const MOCK_OUTLINE: OutlineHeading[] = [
  { id: 'h-1', level: 1, text: 'Building Resilient Distributed Systems with Rust' },
  { id: 'h-2', level: 2, text: 'Introduction' },
  { id: 'h-3', level: 2, text: 'Error Handling Patterns' },
  { id: 'h-4', level: 2, text: 'Circuit Breaker Pattern' },
  { id: 'h-5', level: 2, text: 'Observability' },
  { id: 'h-6', level: 2, text: 'Conclusion' },
];

// ── Podcast ──────────────────────────────────────────────

export interface PodcastEpisode {
  id: string;
  title: string;
  podcastName: string;
  duration: number; // seconds
  publishedAt: string;
  audioUrl: string;
  status: ArticleStatus;
  readingProgress: number;
}

export const MOCK_PODCASTS: PodcastEpisode[] = [
  {
    id: 'pod-1',
    title: '大模型时代的工程实践：从训练到部署',
    podcastName: 'AI 深夜电台',
    duration: 2340,
    publishedAt: '2026-04-09T06:00:00Z',
    audioUrl: 'https://example.com/podcast/ep42.mp3',
    status: 'reading',
    readingProgress: 35,
  },
  {
    id: 'pod-2',
    title: 'Rust in Production: Lessons Learned',
    podcastName: 'Systems FM',
    duration: 3600,
    publishedAt: '2026-04-07T12:00:00Z',
    audioUrl: 'https://example.com/podcast/rust-prod.mp3',
    status: 'unread',
    readingProgress: 0,
  },
  {
    id: 'pod-3',
    title: '开源社区运营的方法论',
    podcastName: '代码之外',
    duration: 1800,
    publishedAt: '2026-04-05T20:00:00Z',
    audioUrl: 'https://example.com/podcast/opensource.mp3',
    status: 'archived',
    readingProgress: 100,
  },
];

// ── Video ────────────────────────────────────────────────

export interface VideoItem {
  id: string;
  title: string;
  channelName: string;
  duration: number;
  publishedAt: string;
  videoUrl: string;
  thumbnailUrl: string;
  status: ArticleStatus;
  readingProgress: number;
}

export const MOCK_VIDEOS: VideoItem[] = [
  {
    id: 'vid-1',
    title: '一小时搞懂 CRDT：协同编辑的核心算法',
    channelName: '系统设计频道',
    duration: 3720,
    publishedAt: '2026-04-08T10:00:00Z',
    videoUrl: 'https://example.com/video/crdt.mp4',
    thumbnailUrl: 'https://example.com/thumb/crdt.jpg',
    status: 'reading',
    readingProgress: 20,
  },
  {
    id: 'vid-2',
    title: 'Building a Database from Scratch in Go',
    channelName: 'CodeCraft',
    duration: 5400,
    publishedAt: '2026-04-06T14:00:00Z',
    videoUrl: 'https://example.com/video/db-go.mp4',
    thumbnailUrl: 'https://example.com/thumb/db-go.jpg',
    status: 'unread',
    readingProgress: 0,
  },
  {
    id: 'vid-3',
    title: 'WebAssembly 与前端性能优化实战',
    channelName: '前端充电站',
    duration: 2700,
    publishedAt: '2026-04-04T08:00:00Z',
    videoUrl: 'https://example.com/video/wasm.mp4',
    thumbnailUrl: 'https://example.com/thumb/wasm.jpg',
    status: 'archived',
    readingProgress: 100,
  },
];

// ── Book ─────────────────────────────────────────────────

export interface BookItem {
  id: string;
  title: string;
  author: string;
  totalChapters: number;
  currentChapter: number;
  status: ArticleStatus;
  readingProgress: number;
}

export interface BookChapter {
  id: string;
  number: number;
  title: string;
}

export const MOCK_BOOKS: BookItem[] = [
  {
    id: 'book-1',
    title: '设计数据密集型应用',
    author: 'Martin Kleppmann',
    totalChapters: 12,
    currentChapter: 5,
    status: 'reading',
    readingProgress: 42,
  },
  {
    id: 'book-2',
    title: 'Crafting Interpreters',
    author: 'Robert Nystrom',
    totalChapters: 30,
    currentChapter: 1,
    status: 'unread',
    readingProgress: 0,
  },
];

export const MOCK_BOOK_TOC: BookChapter[] = [
  { id: 'ch-1', number: 1, title: '可靠性、可扩展性与可维护性' },
  { id: 'ch-2', number: 2, title: '数据模型与查询语言' },
  { id: 'ch-3', number: 3, title: '存储与检索' },
  { id: 'ch-4', number: 4, title: '编码与演化' },
  { id: 'ch-5', number: 5, title: '复制' },
  { id: 'ch-6', number: 6, title: '分区' },
  { id: 'ch-7', number: 7, title: '事务' },
  { id: 'ch-8', number: 8, title: '分布式系统的麻烦' },
  { id: 'ch-9', number: 9, title: '一致性与共识' },
  { id: 'ch-10', number: 10, title: '批处理' },
  { id: 'ch-11', number: 11, title: '流处理' },
  { id: 'ch-12', number: 12, title: '数据系统的未来' },
];

export const MOCK_BOOK_CHAPTER_BODY = `# 第五章：复制

## 引言

复制意味着在通过网络连接的多台机器上保存相同数据的副本。我们希望能复制数据，可能出于各种各样的原因：

- 使得数据与用户在地理上接近（从而减少延迟）
- 即使系统的一部分出现故障，系统也能继续工作（从而提高可用性）
- 扩展可以接受读请求的机器数量（从而提高读取吞吐量）

## 领导者与追随者

每个保存数据库副本的节点称为副本（replica）。当存在多个副本时，会不可避免地出现一个问题：如何确保所有数据最终都落在了所有的副本上？

最常见的解决方案称为基于领导者的复制（leader-based replication），也称为主动/被动（active/passive）或主/从（master/slave）复制。其工作原理如下：

1. 副本之一被指定为领导者（leader）。当客户端写入数据库时，它必须将请求发送给领导者。
2. 其他副本称为追随者（follower）。领导者将新数据写入本地存储后，也会将数据变更发送给追随者。
3. 当客户端想要从数据库中读取数据时，可以向领导者或任何追随者查询。

> 复制的核心挑战在于处理复制数据的变更，这正是本章讨论的重点。

## 同步复制与异步复制

复制系统的一个重要细节是：复制是同步的还是异步的。在关系型数据库中，这通常是一个可配置的选项；其他系统通常硬编码为其中之一。

**同步复制**的优点是追随者保证有与领导者一致的最新数据副本。如果领导者突然失效，我们可以确信这些数据仍然能在追随者上找到。缺点是如果同步追随者没有响应，领导者就无法处理写入。

**异步复制**则相反：领导者不等待追随者的确认就继续处理。这意味着写入速度更快，但如果领导者失效且不可恢复，则尚未复制到追随者的写入将丢失。

## 复制延迟问题

基于领导者的复制要求所有写入都经过单个节点，但只读查询可以发往任何副本。对于读多写少的场景，我们可以创建很多追随者，将读请求分散到这些追随者上。这可以减轻领导者的负载，并允许向最近的副本发送读请求。

这种扩展方式只适用于异步复制——如果试图同步地复制到所有追随者，单个节点故障或网络中断就会导致整个系统不可用。

## 小结

本章讨论了复制的基本概念。复制可以服务于多个目的：高可用性、断开连接的操作、延迟优化和可扩展性。复制算法主要有三种：单主复制、多主复制和无主复制。`;

// ── Transcript ───────────────────────────────────────────

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
}

export interface SpeakerInfo {
  id: string;
  label: string;
  color: string;
}

export const MOCK_SPEAKERS: SpeakerInfo[] = [
  { id: 'spk-host', label: '主持人', color: '#60a5fa' },
  { id: 'spk-guest1', label: '嘉宾A', color: '#34d399' },
  { id: 'spk-guest2', label: '嘉宾B', color: '#f472b6' },
];

export const MOCK_TRANSCRIPT: TranscriptSegment[] = [
  { startTime: 0, endTime: 15, speaker: 'spk-host', text: '大家好，欢迎收听本期节目。今天我们请到了两位在大模型领域有丰富实战经验的工程师来分享他们的心得。' },
  { startTime: 15, endTime: 35, speaker: 'spk-guest1', text: '大家好，我是张明，目前在一家 AI 创业公司负责模型训练基础设施。我们主要使用 PyTorch 和自研的分布式训练框架。' },
  { startTime: 35, endTime: 52, speaker: 'spk-guest2', text: '我是李华，在一家大厂做模型部署和推理优化。我的工作重点是把训练好的模型高效地部署到生产环境。' },
  { startTime: 52, endTime: 78, speaker: 'spk-host', text: '非常好。那我们先从训练说起。张明，现在训练大模型最大的工程挑战是什么？' },
  { startTime: 78, endTime: 120, speaker: 'spk-guest1', text: '我觉得最大的挑战是规模化。当你把模型参数量从几十亿推到几千亿时，很多原来能用的方法都不行了。你需要重新思考数据并行、模型并行、流水线并行的组合策略。' },
  { startTime: 120, endTime: 158, speaker: 'spk-host', text: '确实，这也是很多团队的痛点。李华，从部署的角度来看呢？' },
  { startTime: 158, endTime: 205, speaker: 'spk-guest2', text: '部署的核心问题是延迟和成本的平衡。用户期望毫秒级的响应，但大模型的推理天然就比较慢。我们花了很多时间在量化、剪枝和投机采样上。' },
  { startTime: 205, endTime: 240, speaker: 'spk-guest1', text: '对，而且训练和部署其实是紧密耦合的。如果训练时不考虑部署约束，后面会很痛苦。我们现在从训练阶段就开始做量化感知训练。' },
  { startTime: 240, endTime: 285, speaker: 'spk-host', text: '这个点很重要。我们稍后深入讨论量化感知训练。先聊聊基础设施的选型——你们是用云服务还是自建集群？' },
  { startTime: 285, endTime: 330, speaker: 'spk-guest1', text: '我们是混合模式。日常开发和小规模实验用云服务，大规模训练用自建的 GPU 集群。成本控制非常关键，一次训练跑下来可能就是几十万的计算费用。' },
];

// ── Bilingual paragraphs (for TranslationOverlay) ────────

export interface BilingualParagraph {
  index: number;
  original: string;
  translated: string;
  language: string;
}

export const MOCK_BILINGUAL_PARAGRAPHS: BilingualParagraph[] = [
  {
    index: 0,
    original: 'Replication means keeping a copy of the same data on multiple machines that are connected via a network.',
    translated: '复制意味着在通过网络连接的多台机器上保存相同数据的副本。',
    language: '中文',
  },
  {
    index: 1,
    original: 'There are several reasons why you might want to replicate data: to keep data geographically close to users, to allow the system to continue working even if some parts have failed, and to scale out the number of machines that can serve read queries.',
    translated: '你可能希望复制数据的原因有几个：使数据在地理上接近用户、即使某些部分出现故障系统也能继续工作、以及扩展能够服务读查询的机器数量。',
    language: '中文',
  },
  {
    index: 2,
    original: 'The difficulty lies in handling changes to replicated data, which is what this chapter is about.',
    translated: '困难在于处理已复制数据的变更，这正是本章讨论的内容。',
    language: '中文',
  },
];

// ── Multi-content-type data (Phase 7) ──────────────────────────────────

export type ContentType = 'article' | 'podcast' | 'video' | 'book';
export type ContentStatus = 'unread' | 'in_progress' | 'done' | 'archived';

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  source: string;
  author: string;
  url: string;
  publishedAt: string;
  status: ContentStatus;
  progress: number;
  tags: string[];
}

export const MOCK_CONTENT_ITEMS: ContentItem[] = [
  // Articles (map from existing MOCK_ARTICLES for consistency)
  {
    id: 'c-art-1',
    type: 'article',
    title: 'Transformer 架构的最新进展与实践指南',
    source: 'AI 前沿周刊',
    author: '张明',
    url: 'https://example.com/ai-weekly/transformer',
    publishedAt: '2026-04-09T08:00:00Z',
    status: 'unread',
    progress: 0,
    tags: ['AI', 'Transformer'],
  },
  {
    id: 'c-art-2',
    type: 'article',
    title: 'Building Resilient Distributed Systems with Rust',
    source: 'Systems Weekly',
    author: 'Alex Chen',
    url: 'https://example.com/systems-weekly/rust',
    publishedAt: '2026-04-08T14:30:00Z',
    status: 'in_progress',
    progress: 45,
    tags: ['Rust', 'Distributed Systems'],
  },
  {
    id: 'c-art-3',
    type: 'article',
    title: '全栈 TypeScript 工程化实践：从 monorepo 到部署',
    source: '前端观察',
    author: '李华',
    url: 'https://example.com/frontend-observer/ts',
    publishedAt: '2026-04-08T10:15:00Z',
    status: 'in_progress',
    progress: 72,
    tags: ['TypeScript', 'Engineering'],
  },
  // Podcasts
  {
    id: 'c-pod-1',
    type: 'podcast',
    title: '和 Andrej Karpathy 聊 LLM 的未来',
    source: 'Deep Tech FM',
    author: 'Deep Tech FM',
    url: 'https://example.com/deep-tech-fm/ep42',
    publishedAt: '2026-04-09T06:00:00Z',
    status: 'unread',
    progress: 0,
    tags: ['AI', 'LLM'],
  },
  {
    id: 'c-pod-2',
    type: 'podcast',
    title: 'Rust in Production: Lessons from Cloudflare',
    source: 'Rustacean Station',
    author: 'Rustacean Station',
    url: 'https://example.com/rustacean/ep88',
    publishedAt: '2026-04-07T12:00:00Z',
    status: 'in_progress',
    progress: 60,
    tags: ['Rust', 'Infrastructure'],
  },
  // Videos
  {
    id: 'c-vid-1',
    type: 'video',
    title: 'WWDC 2026 Keynote 精华回顾',
    source: 'Apple',
    author: 'Apple',
    url: 'https://youtube.com/watch?v=wwdc2026',
    publishedAt: '2026-04-06T18:00:00Z',
    status: 'unread',
    progress: 0,
    tags: ['Apple', 'WWDC'],
  },
  {
    id: 'c-vid-2',
    type: 'video',
    title: 'Building a Game Engine in Zig',
    source: 'Handmade Network',
    author: 'Andrew Kelley',
    url: 'https://youtube.com/watch?v=zig-engine',
    publishedAt: '2026-04-05T10:00:00Z',
    status: 'in_progress',
    progress: 35,
    tags: ['Zig', 'GameDev'],
  },
  // Books
  {
    id: 'c-book-1',
    type: 'book',
    title: 'Designing Data-Intensive Applications',
    source: 'O\'Reilly',
    author: 'Martin Kleppmann',
    url: 'https://example.com/ddia',
    publishedAt: '2023-01-01T00:00:00Z',
    status: 'in_progress',
    progress: 68,
    tags: ['Systems', 'Database'],
  },
  {
    id: 'c-book-2',
    type: 'book',
    title: '深入理解计算机系统 (CSAPP)',
    source: '机械工业出版社',
    author: 'Randal E. Bryant',
    url: 'https://example.com/csapp',
    publishedAt: '2022-06-01T00:00:00Z',
    status: 'unread',
    progress: 0,
    tags: ['CS', 'Systems'],
  },
  {
    id: 'c-book-3',
    type: 'book',
    title: 'The Pragmatic Programmer',
    source: 'Pragmatic Bookshelf',
    author: 'David Thomas & Andrew Hunt',
    url: 'https://example.com/pragprog',
    publishedAt: '2024-03-15T00:00:00Z',
    status: 'done',
    progress: 100,
    tags: ['Engineering', 'Career'],
  },
];
