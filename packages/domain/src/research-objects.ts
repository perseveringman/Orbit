import type { IsoDateTimeString, ObjectLayer } from './common.js';

// ── ResearchSpace ──────────────────────────────────────────

export type ResearchSpaceStatus = 'active' | 'dormant' | 'archived';

export interface ResearchSpace {
  readonly objectType: 'research_space';
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: ResearchSpaceStatus;
  readonly projectId: string | null;
  readonly lastActiveAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ResearchQuestion ───────────────────────────────────────

export type ResearchQuestionStatus = 'open' | 'answered' | 'partially_answered' | 'abandoned';

export type ResearchQuestionKind = 'main' | 'sub_question' | 'hypothesis' | 'success_criterion';

export interface ResearchQuestion {
  readonly objectType: 'research_question';
  readonly id: string;
  readonly researchSpaceId: string;
  readonly parentQuestionId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly kind: ResearchQuestionKind;
  readonly status: ResearchQuestionStatus;
  readonly sortOrder: number | null;
  readonly answeredAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── SourceSet ──────────────────────────────────────────────

export interface SourceSet {
  readonly objectType: 'source_set';
  readonly id: string;
  readonly researchSpaceId: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly snapshotVersion: number | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ResearchClaim ──────────────────────────────────────────

export type ResearchClaimStatus = 'draft' | 'supported' | 'contested' | 'superseded' | 'retracted';

export type ResearchClaimConfidence = 'high' | 'medium' | 'low' | 'unverified';

export interface ResearchClaim {
  readonly objectType: 'research_claim';
  readonly id: string;
  readonly researchSpaceId: string;
  readonly questionId: string | null;
  readonly statement: string;
  readonly reasoning: string | null;
  readonly status: ResearchClaimStatus;
  readonly confidence: ResearchClaimConfidence;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ResearchGap ────────────────────────────────────────────

export type ResearchGapKind = 'factual' | 'comparison' | 'argument' | 'timeliness' | 'counter_example';

export type ResearchGapStatus = 'pending_search' | 'searching' | 'resolved' | 'shelved' | 'not_needed';

export interface ResearchGap {
  readonly objectType: 'research_gap';
  readonly id: string;
  readonly researchSpaceId: string;
  readonly questionId: string | null;
  readonly discoveredBySessionId: string | null;
  readonly description: string;
  readonly gapKind: ResearchGapKind;
  readonly status: ResearchGapStatus;
  readonly resolvedAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── ResearchArtifact ───────────────────────────────────────

export type ResearchArtifactKind =
  | 'summary_card'
  | 'insight_card'
  | 'comparison_matrix'
  | 'decision_table'
  | 'synopsis_report'
  | 'conclusion_memo'
  | 'article_outline'
  | 'presentation_outline'
  | 'ppt_structure'
  | 'task_suggestions'
  | 'custom';

export type ResearchArtifactStatus = 'draft' | 'final' | 'superseded' | 'archived';

export interface ResearchArtifact {
  readonly objectType: 'research_artifact';
  readonly id: string;
  readonly researchSpaceId: string;
  readonly questionId: string | null;
  readonly generatedBySessionId: string | null;
  readonly title: string;
  readonly artifactKind: ResearchArtifactKind;
  readonly summary: string | null;
  readonly filePath: string | null;
  readonly layer: ObjectLayer;
  readonly status: ResearchArtifactStatus;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
