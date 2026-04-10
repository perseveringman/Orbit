// ── Relation families ──────────────────────────────────────

export const RELATION_FAMILIES = {
  structural: ['contains', 'parent_of', 'child_of'],
  provenance: ['derived_from', 'excerpted_from', 'annotated_by', 'evidenced_by'],
  support: ['supports', 'informs', 'context_for'],
  execution: ['blocks', 'depends_on', 'suggests', 'decides'],
  output: ['produces', 'outputs', 'published_as', 'feeds'],
  discussion: ['discusses', 'asks_about', 'answers_for'],
  reflection: ['reflects_on', 'reviews', 'reframes'],
  aggregation: ['tagged_with', 'about', 'relates_to'],
} as const;

export type RelationFamily = keyof typeof RELATION_FAMILIES;

export type RelationType = (typeof RELATION_FAMILIES)[RelationFamily][number];

// ── Flat array of all relation types ───────────────────────

export const RELATION_TYPES: readonly RelationType[] = Object.values(RELATION_FAMILIES).flat() as RelationType[];

// ── Inverse display names (for bidirectional UI) ───────────

export const INVERSE_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  contains: '属于',
  parent_of: '子级',
  child_of: '父级',
  derived_from: '派生出',
  excerpted_from: '摘自',
  annotated_by: '批注了',
  evidenced_by: '提供证据',
  supports: '被支撑',
  informs: '被告知',
  context_for: '上下文来自',
  blocks: '被阻塞',
  depends_on: '阻塞',
  suggests: '由…建议',
  decides: '被决定',
  produces: '产自',
  outputs: '输出自',
  published_as: '发布来源',
  feeds: '输入来自',
  discusses: '讨论于',
  asks_about: '被提问',
  answers_for: '回答于',
  reflects_on: '被反思',
  reviews: '被回顾',
  reframes: '被重构',
  tagged_with: '标记了',
  about: '关于',
  relates_to: '关联',
};

// ── Link status & origin ───────────────────────────────────

export type LinkStatus = 'proposed' | 'active' | 'rejected' | 'archived';

export type SourceChannel =
  | 'manual'
  | 'wikilink'
  | 'drag_drop'
  | 'quick_capture'
  | 'agent_chat'
  | 'ingest'
  | 'review'
  | 'import';

export type EvidenceType = 'quote' | 'block' | 'message' | 'event' | 'similarity';

// ── Helpers ────────────────────────────────────────────────

export function isValidRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value);
}

export function getRelationFamily(relation: RelationType): RelationFamily | undefined {
  for (const [family, relations] of Object.entries(RELATION_FAMILIES)) {
    if ((relations as readonly string[]).includes(relation)) {
      return family as RelationFamily;
    }
  }
  return undefined;
}
