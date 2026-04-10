import type { IsoDateTimeString } from './common.js';

// ── Document ───────────────────────────────────────────────

export type DocumentStatus =
  | 'collecting_materials'
  | 'assembling'
  | 'drafting'
  | 'revising'
  | 'ready_to_publish'
  | 'published'
  | 'superseded';

export interface Document {
  readonly objectType: 'document';
  readonly id: string;
  readonly title: string;
  readonly status: DocumentStatus;
  readonly filePath: string;
  readonly briefId: string;
  readonly outlineVersionId: string | null;
  readonly voiceProfileId: string | null;
  readonly writingWorkspaceId: string;
  readonly projectId: string | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Draft ──────────────────────────────────────────────────

export type DraftStatus =
  | 'generating'
  | 'generated'
  | 'editing'
  | 'accepted'
  | 'discarded';

export interface Draft {
  readonly objectType: 'draft';
  readonly id: string;
  readonly documentId: string;
  readonly outlineNodeId: string;
  readonly status: DraftStatus;
  readonly title: string;
  readonly materialItemIds: readonly string[];
  readonly voiceProfileId: string | null;
  readonly targetWordCount: number | null;
  readonly actualWordCount: number | null;
  readonly blockRange: Readonly<{ start: number; end: number }> | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Post ───────────────────────────────────────────────────

export type PostStatus =
  | 'preparing'
  | 'previewing'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'retracted';

export interface Post {
  readonly objectType: 'post';
  readonly id: string;
  readonly sourceDocumentId: string;
  readonly sourceVariantId: string | null;
  readonly status: PostStatus;
  readonly platform: string;
  readonly formatRules: Readonly<Record<string, unknown>> | null;
  readonly publishAt: IsoDateTimeString | null;
  readonly externalUrl: string | null;
  readonly externalId: string | null;
  readonly excerpt: string | null;
  readonly coverMeta: Readonly<Record<string, unknown>> | null;
  readonly feedbackSummary: string | null;
  readonly feedbackTargetUids: readonly string[] | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── VoiceProfile ───────────────────────────────────────────

export type VoiceTone =
  | 'restrained'
  | 'sharp'
  | 'warm'
  | 'coaching'
  | 'academic'
  | 'narrative';

export type VoiceAudienceLevel =
  | 'technical'
  | 'team'
  | 'general'
  | 'investor'
  | 'social_media';

export interface VoiceProfile {
  readonly objectType: 'voice_profile';
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly toneSummary: string;
  readonly tones: readonly VoiceTone[];
  readonly styleRules: readonly string[];
  readonly rhetoricHabits: readonly string[] | null;
  readonly audienceLevels: readonly VoiceAudienceLevel[] | null;
  readonly antiPatterns: readonly string[];
  readonly sampleRefs: readonly Readonly<{ objectType: string; objectId: string }>[];
  readonly negativeSampleRefs: readonly Readonly<{ objectType: string; objectId: string }>[] | null;
  readonly version: number;
  readonly avgSentenceLength: number | null;
  readonly paragraphDensity: 'compact' | 'normal' | 'spacious' | null;
  readonly colloquialismDegree: 'formal' | 'moderate' | 'conversational' | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── OutputVariant ──────────────────────────────────────────

export type OutputKind =
  | 'article'
  | 'newsletter'
  | 'social_post'
  | 'talk'
  | 'script'
  | 'memo';

export type VariantStatus =
  | 'generating'
  | 'draft'
  | 'review'
  | 'ready'
  | 'published';

export interface OutputVariant {
  readonly objectType: 'output_variant';
  readonly id: string;
  readonly documentId: string;
  readonly outputKind: OutputKind;
  readonly title: string;
  readonly status: VariantStatus;
  readonly filePath: string;
  readonly voiceOverlayId: string | null;
  readonly maxLength: number | null;
  readonly structureTemplateId: string | null;
  readonly publishStatus: PostStatus | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
