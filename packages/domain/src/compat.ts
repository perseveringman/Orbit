/**
 * Backward-compatible types from the original domain package.
 * These are deprecated — use the new Wave 1 types instead.
 */

// ── Legacy scalars ─────────────────────────────────────────

/** @deprecated Use ObjectId from common.ts */
export type OrbitEntityId = string;

/** @deprecated Use the new 4-state `TaskStatus` → `'todo' | 'doing' | 'done' | 'canceled'` */
export type LegacyTaskStatus = 'todo' | 'doing' | 'done' | 'canceled';

/** @deprecated Use the new `ProjectStatus` */
export type LegacyProjectStatus = 'active' | 'archived' | 'done';

// ── Legacy base interface ──────────────────────────────────

/** @deprecated Use OrbitObjectBase (discriminant: objectType) */
export interface OrbitEntityBase {
  readonly kind: string;
  readonly id: OrbitEntityId;
  readonly workspaceId: OrbitEntityId;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string | null;
}

// ── Legacy record interfaces ───────────────────────────────

/** @deprecated Use the new Workspace model */
export interface WorkspaceRecord extends OrbitEntityBase {
  readonly kind: 'workspace';
  readonly name: string;
  readonly slug: string;
  readonly ownerUserId: OrbitEntityId;
}

/** @deprecated Use SourceEndpoint */
export interface FeedRecord extends OrbitEntityBase {
  readonly kind: 'feed';
  readonly title: string;
  readonly siteUrl: string;
  readonly feedUrl: string;
}

/** @deprecated Use Project */
export interface ProjectRecord extends OrbitEntityBase {
  readonly kind: 'project';
  readonly title: string;
  readonly status: LegacyProjectStatus;
  readonly lastReviewedAt?: string | null;
}

/** @deprecated Use Task */
export interface TaskRecord extends OrbitEntityBase {
  readonly kind: 'task';
  readonly projectId: OrbitEntityId | null;
  readonly title: string;
  readonly status: LegacyTaskStatus;
  readonly todayOn?: string | null;
  readonly focusRank?: number | null;
  readonly completedAt?: string | null;
  readonly lastReviewedAt?: string | null;
}

/** @deprecated Use Article */
export interface ArticleRecord extends OrbitEntityBase {
  readonly kind: 'article';
  readonly feedId: OrbitEntityId;
  readonly title: string;
  readonly sourceUrl: string;
  readonly status: 'unread' | 'reading' | 'archived';
  readonly publishedAt?: string | null;
}

/** @deprecated Use Highlight */
export interface HighlightRecord extends OrbitEntityBase {
  readonly kind: 'highlight';
  readonly articleId: OrbitEntityId;
  readonly quote: string;
  readonly color: 'yellow' | 'green' | 'blue' | 'pink';
  readonly note?: string | null;
}

/** @deprecated Use Tag */
export interface TagRecord extends OrbitEntityBase {
  readonly kind: 'tag';
  readonly name: string;
  readonly color?: string | null;
}

/** @deprecated Use Note */
export interface NoteRecord extends OrbitEntityBase {
  readonly kind: 'note';
  readonly articleId: OrbitEntityId;
  readonly title: string;
  readonly markdown: string;
}

// ── Legacy DomainObject union ──────────────────────────────

/** @deprecated Use the new DomainObject union */
export type LegacyDomainObject =
  | WorkspaceRecord
  | ProjectRecord
  | TaskRecord
  | FeedRecord
  | ArticleRecord
  | HighlightRecord
  | TagRecord
  | NoteRecord;

// ── Legacy relation names ──────────────────────────────────

export const DOMAIN_RELATION_NAMES = {
  workspaceToProject: 'workspace/project',
  workspaceToTask: 'workspace/task',
  workspaceToFeed: 'workspace/feed',
  projectToTask: 'project/task',
  feedToArticle: 'feed/article',
  articleToHighlight: 'article/highlight',
  articleToNote: 'article/note',
  articleToTag: 'article/tag',
  taskToToday: 'task/today',
  taskToFocus: 'task/focus',
  taskToReview: 'task/review',
} as const;
