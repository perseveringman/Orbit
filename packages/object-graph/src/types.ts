// ── Local type aliases (avoid @orbit/domain build-order dependency) ──

export type ObjectUid = string;
export type ObjectId = string;
export type IsoDateTimeString = string;
export type ObjectOrigin = 'human' | 'ai' | 'system';
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

// ── Relation vocabulary ──

export const RELATION_FAMILIES = {
  structural: ['contains', 'parent_of', 'child_of'],
  provenance: ['derived_from', 'excerpted_from', 'annotated_by', 'evidenced_by'],
  support: ['supports', 'informs', 'context_for'],
  execution: ['blocks', 'depends_on', 'suggests', 'decides'],
  output: ['produces', 'outputs', 'published_as', 'feeds'],
  discussion: ['discusses', 'asks_about', 'answers_for'],
  reflection: ['reflects_on', 'reviews', 'reframes'],
  aggregation: ['tagged_with', 'about', 'relates_to'],
  extra: ['references', 'aligned_to', 'output_of'],
} as const;

export type RelationFamily = keyof typeof RELATION_FAMILIES;

export type RelationType =
  (typeof RELATION_FAMILIES)[RelationFamily][number];

// ── Core data structures ──

export interface ObjectReference {
  readonly objectUid: ObjectUid;
  readonly objectType: string;
  readonly objectId: ObjectId;
}

export interface Link {
  readonly linkId: string;
  readonly sourceUid: ObjectUid;
  readonly targetUid: ObjectUid;
  readonly relationType: RelationType | string;
  readonly origin: ObjectOrigin;
  readonly sourceChannel: SourceChannel | null;
  readonly status: LinkStatus;
  readonly confidence: number | null;
  readonly whySummary: string | null;
  readonly contextJson: string | null;
  readonly weight: number | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export type EvidenceType = 'quote' | 'block' | 'message' | 'event' | 'similarity';

export interface LinkEvidence {
  readonly id: string;
  readonly linkId: string;
  readonly evidenceType: EvidenceType;
  readonly evidenceRef: string | null;
  readonly payloadJson: string | null;
  readonly createdAt: IsoDateTimeString;
}

// ── Filtering ──

export interface LinkFilter {
  readonly relationFamily?: RelationFamily;
  readonly relations?: readonly string[];
  readonly origin?: ObjectOrigin;
  readonly status?: LinkStatus;
  readonly objectType?: string;
}

// ── CRUD inputs ──

export type CreateLinkInput = Omit<Link, 'linkId' | 'createdAt' | 'updatedAt'>;

export type UpdateLinkInput = Partial<
  Pick<Link, 'relationType' | 'status' | 'confidence' | 'whySummary' | 'contextJson' | 'weight'>
>;

// ── Cross-object query types ──

export interface ContextBundle {
  readonly rootUid: ObjectUid;
  readonly objects: readonly ObjectReference[];
  readonly links: readonly Link[];
}

export interface WorkChainResult {
  readonly startUid: ObjectUid;
  readonly chain: readonly ObjectReference[];
  readonly links: readonly Link[];
}

export interface EvidenceTraceResult {
  readonly outputUid: ObjectUid;
  readonly evidenceChain: readonly ObjectReference[];
  readonly links: readonly Link[];
}

// ── Hydration ──

export interface HydratedObject {
  readonly objectUid: ObjectUid;
  readonly objectType: string;
  readonly data: unknown;
  readonly metadata: Record<string, unknown>;
}
