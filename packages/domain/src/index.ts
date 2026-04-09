export const ORBIT_OBJECT_KINDS = ['workspace', 'feed', 'article', 'highlight', 'tag', 'note'] as const;

export type OrbitObjectKind = (typeof ORBIT_OBJECT_KINDS)[number];

export type OrbitEntityId = string;
export type IsoDateTimeString = string;

export interface OrbitEntityBase {
  readonly kind: OrbitObjectKind;
  readonly id: OrbitEntityId;
  readonly workspaceId: OrbitEntityId;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

export interface WorkspaceRecord extends OrbitEntityBase {
  readonly kind: 'workspace';
  readonly name: string;
  readonly slug: string;
  readonly ownerUserId: OrbitEntityId;
}

export interface FeedRecord extends OrbitEntityBase {
  readonly kind: 'feed';
  readonly title: string;
  readonly siteUrl: string;
  readonly feedUrl: string;
}

export interface ArticleRecord extends OrbitEntityBase {
  readonly kind: 'article';
  readonly feedId: OrbitEntityId;
  readonly title: string;
  readonly sourceUrl: string;
  readonly status: 'unread' | 'reading' | 'archived';
  readonly publishedAt?: IsoDateTimeString | null;
}

export interface HighlightRecord extends OrbitEntityBase {
  readonly kind: 'highlight';
  readonly articleId: OrbitEntityId;
  readonly quote: string;
  readonly color: 'yellow' | 'green' | 'blue' | 'pink';
  readonly note?: string | null;
}

export interface TagRecord extends OrbitEntityBase {
  readonly kind: 'tag';
  readonly name: string;
  readonly color?: string | null;
}

export interface NoteRecord extends OrbitEntityBase {
  readonly kind: 'note';
  readonly articleId: OrbitEntityId;
  readonly title: string;
  readonly markdown: string;
}

export type DomainObject =
  | WorkspaceRecord
  | FeedRecord
  | ArticleRecord
  | HighlightRecord
  | TagRecord
  | NoteRecord;

export const DOMAIN_RELATION_NAMES = {
  workspaceToFeed: 'workspace/feed',
  feedToArticle: 'feed/article',
  articleToHighlight: 'article/highlight',
  articleToNote: 'article/note',
  articleToTag: 'article/tag',
} as const;

const DOMAIN_OBJECT_LABELS: Record<OrbitObjectKind, string> = {
  workspace: '工作区',
  feed: '订阅源',
  article: '文章',
  highlight: '高亮',
  tag: '标签',
  note: '笔记',
};

export function isDomainObjectKind(value: string): value is OrbitObjectKind {
  return ORBIT_OBJECT_KINDS.includes(value as OrbitObjectKind);
}

export function getDomainObjectLabel(kind: OrbitObjectKind): string {
  return DOMAIN_OBJECT_LABELS[kind];
}

export function buildDomainObjectKey(kind: OrbitObjectKind, id: OrbitEntityId): string {
  return `${kind}:${id}`;
}
