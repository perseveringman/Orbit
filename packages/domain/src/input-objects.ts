import type { IsoDateTimeString, AnchorPayload } from './common.js';

// ── Article ────────────────────────────────────────────────

export type ArticleReadingStatus = 'unread' | 'reading' | 'archived';

export type ArticleMediaType = 'web_article' | 'newsletter' | 'social_post' | 'web_clip';

export interface Article {
  readonly objectType: 'article';
  readonly id: string;
  readonly contentItemId: string | null;
  readonly sourceEndpointId: string | null;
  readonly title: string;
  readonly sourceUrl: string;
  readonly author: string | null;
  readonly mediaType: ArticleMediaType;
  readonly language: string | null;
  readonly bundlePath: string;
  readonly contentFilePath: string;
  readonly originalFilePath: string | null;
  readonly origin: ContentOrigin;
  readonly proposedLinkCount: number;
  readonly activeLinkCount: number;
  readonly sourceEndpointQuality: number;
  readonly status: ArticleReadingStatus;
  readonly readingProgress: number | null;
  readonly lastReadPosition: Readonly<Record<string, unknown>> | null;
  readonly publishedAt: IsoDateTimeString | null;
  readonly fetchedAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Book ───────────────────────────────────────────────────

export type BookReadingStatus = 'unread' | 'reading' | 'finished' | 'archived';

export type BookFormat = 'epub' | 'pdf' | 'mobi' | 'other';

export interface Book {
  readonly objectType: 'book';
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly isbn: string | null;
  readonly publisher: string | null;
  readonly language: string | null;
  readonly format: BookFormat;
  readonly totalChapters: number | null;
  readonly totalPages: number | null;
  readonly bundlePath: string;
  readonly sourceFilePath: string;
  readonly metaFilePath: string;
  readonly chaptersJsonPath: string | null;
  readonly status: BookReadingStatus;
  readonly readingProgress: number | null;
  readonly lastReadPosition: Readonly<Record<string, unknown>> | null;
  readonly currentChapter: number | null;
  readonly publishedAt: IsoDateTimeString | null;
  readonly importedAt: IsoDateTimeString;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Highlight ──────────────────────────────────────────────

export type HighlightKind = 'highlight' | 'question_seed' | 'evidence' | 'quote';

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';

export type HighlightCreatedBy = 'manual' | 'import' | 'agent';

export type HighlightSourceObjectType = 'article' | 'book' | 'note' | 'document' | 'research_artifact';

export interface Highlight {
  readonly objectType: 'highlight';
  readonly id: string;
  readonly sourceObjectType: HighlightSourceObjectType;
  readonly sourceObjectId: string;
  readonly anchorJson: AnchorPayload;
  readonly quoteText: string;
  readonly color: HighlightColor;
  readonly highlightKind: HighlightKind;
  readonly createdBy: HighlightCreatedBy;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Note ───────────────────────────────────────────────────

export type NoteKind = 'fleeting' | 'annotation' | 'research' | 'journal' | 'synthesis';

export type NoteMaturity = 'inbox' | 'linked' | 'synthesized' | 'reusable';

export type NoteOrigin = 'manual' | 'highlight' | 'quick_capture' | 'agent' | 'journal';

export interface Note {
  readonly objectType: 'note';
  readonly id: string;
  readonly title: string;
  readonly filePath: string;
  readonly noteKind: NoteKind;
  readonly maturity: NoteMaturity;
  readonly origin: NoteOrigin;
  readonly sourceHighlightId: string | null;
  readonly sourceObjectId: string | null;
  readonly sourceObjectType: string | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Asset ──────────────────────────────────────────────────

export type AssetKind =
  | 'image'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'document'
  | 'archive'
  | 'other';

export type AssetCaptureMethod = 'upload' | 'download' | 'screenshot' | 'import' | 'agent';

export interface Asset {
  readonly objectType: 'asset';
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly assetKind: AssetKind;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly contentHash: string;
  readonly bundlePath: string;
  readonly filePath: string;
  readonly metaFilePath: string;
  readonly originalFilename: string | null;
  readonly sourceUrl: string | null;
  readonly captureMethod: AssetCaptureMethod;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ContentOrigin ──────────────────────────────────────────

/** How content entered the system — drives processing depth */
export type ContentOrigin =
  | 'feed_auto'         // Feed 自动抓取 (lightweight processing)
  | 'user_save'         // 用户主动保存 (deep processing)
  | 'agent_recommend'   // Agent 主动推荐 (standard processing)
  | 'import';           // 批量导入 (configurable)

/** Processing depth — determined by origin + link density */
export type ProcessingDepth =
  | 'lightweight'    // 摘要 + proposed links (Feed 默认)
  | 'standard'       // 全文索引 + FTS + 基础实体提取
  | 'deep';          // 全文分块 + embedding + 实体提取 + 关系编织 (Library 默认)

// ── SourceEndpoint ─────────────────────────────────────────

export type SourceEndpointKind =
  | 'rss_feed'
  | 'site_watch'
  | 'channel'
  | 'digest_list'
  | 'saved_search'
  | 'manual_url'
  | 'youtube_channel'
  | 'podcast_feed'
  | 'newsletter';

export type SourceEndpointStatus = 'active' | 'paused' | 'error' | 'archived';

export interface SourceEndpoint {
  readonly objectType: 'source_endpoint';
  readonly id: string;
  readonly title: string;
  readonly kind: SourceEndpointKind;
  readonly url: string;
  readonly siteUrl: string | null;
  readonly description: string | null;
  readonly language: string | null;
  readonly iconUrl: string | null;
  readonly status: SourceEndpointStatus;
  readonly fetchIntervalMinutes: number | null;
  readonly lastFetchedAt: IsoDateTimeString | null;
  readonly lastFetchError: string | null;
  readonly qualityScore: number;
  readonly totalItems: number;
  readonly confirmedItems: number;
  readonly consecutiveErrors: number;
  readonly lastErrorAt: IsoDateTimeString | null;
  readonly discoveryRule: Readonly<Record<string, unknown>> | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ContentItem ────────────────────────────────────────────

export type ContentMediaType =
  | 'web_article'
  | 'newsletter'
  | 'social_post'
  | 'book_epub'
  | 'book_pdf'
  | 'podcast_episode'
  | 'video'
  | 'audio'
  | 'web_clip'
  | 'document'
  | 'image'
  | 'other';

export type ContentItemStatus =
  | 'discovered'
  | 'saved'
  | 'queued'
  | 'fetching'
  | 'fetched'
  | 'normalizing'
  | 'normalized'
  | 'extracting'
  | 'extracted'
  | 'transcribing'
  | 'transcribed'
  | 'translating'
  | 'translated'
  | 'ready_to_read'
  | 'archived'
  | 'fetch_failed'
  | 'extract_failed'
  | 'transcribe_failed'
  | 'translate_failed'
  | 'quarantined';

export interface ContentItem {
  readonly objectType: 'content_item';
  readonly id: string;
  readonly sourceEndpointId: string | null;
  readonly canonicalUrl: string | null;
  readonly fetchUrl: string | null;
  readonly title: string;
  readonly mediaType: ContentMediaType;
  readonly language: string | null;
  readonly author: string | null;
  readonly origin: ContentOrigin;
  readonly processingDepth: ProcessingDepth;
  readonly status: ContentItemStatus;
  readonly lastError: string | null;
  readonly rawBlobPath: string | null;
  readonly rawBlobHash: string | null;
  readonly rawBlobMime: string | null;
  readonly rawBlobSize: number | null;
  readonly readableRepPath: string | null;
  readonly derivedObjectType: 'article' | 'book' | 'asset' | null;
  readonly derivedObjectId: string | null;
  readonly licenseStatus: 'unknown' | 'public' | 'fair_use' | 'restricted' | null;
  readonly publishedAt: IsoDateTimeString | null;
  readonly discoveredAt: IsoDateTimeString | null;
  readonly fetchedAt: IsoDateTimeString | null;
  readonly extractedAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Derivative Asset ───────────────────────────────────────

export type DerivativeAssetType = 'transcript' | 'translation' | 'summary' | 'digest' | 'question_set';
export type DerivativeAssetStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DerivativeAsset {
  readonly objectType: 'derivative_asset';
  readonly id: string;
  readonly sourceObjectId: string;
  readonly assetType: DerivativeAssetType;
  readonly targetLocale: string | null;
  readonly provider: string | null;
  readonly generationConfigJson: Readonly<Record<string, unknown>> | null;
  readonly contentJson: Readonly<Record<string, unknown>> | null;
  readonly filePath: string | null;
  readonly status: DerivativeAssetStatus;
  readonly progress: number;
  readonly qualityScore: number | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
