import type {
  IsoDateTimeString,
  Layer,
  LinkStatus,
  ObjectOrigin,
  ObjectUid,
  SourceChannel,
} from './common.js';

// ── Object query / result ──────────────────────────────────────────

export interface ObjectQueryFilter {
  readonly objectType?: string;
  readonly status?: string;
  readonly origin?: ObjectOrigin;
  readonly layer?: Layer;
  readonly textSearch?: string;
  readonly updatedSince?: IsoDateTimeString;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface ObjectRecord {
  readonly objectUid: ObjectUid;
  readonly objectType: string;
  readonly objectId: string;
  readonly canonicalTable: string;
  readonly layer: Layer;
  readonly sourceFileId: string | null;
  readonly title: string | null;
  readonly summary: string | null;
  readonly status: string | null;
  readonly origin: ObjectOrigin;
  readonly visibility: string;
  readonly versionToken: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedFlg: boolean;
}

export interface ObjectQueryResult {
  readonly items: readonly ObjectRecord[];
  readonly nextCursor: string | null;
  readonly totalHint: number | null;
}

// ── Link query / result ────────────────────────────────────────────

export interface LinkRecord {
  readonly linkId: string;
  readonly sourceUid: ObjectUid;
  readonly targetUid: ObjectUid;
  readonly relationType: string;
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

export interface LinkQueryFilter {
  readonly relationType?: string;
  readonly origin?: ObjectOrigin;
  readonly status?: LinkStatus;
  readonly sourceType?: string;
  readonly targetType?: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface WriteLinkInput {
  readonly sourceUid: ObjectUid;
  readonly targetUid: ObjectUid;
  readonly relationType: string;
  readonly origin: ObjectOrigin;
  readonly sourceChannel?: SourceChannel;
  readonly status?: LinkStatus;
  readonly confidence?: number;
  readonly whySummary?: string;
  readonly contextJson?: string;
  readonly weight?: number;
}

// ── Event query / result ───────────────────────────────────────────

export interface EventRecord {
  readonly eventId: string;
  readonly streamUid: ObjectUid | null;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly causationId: string | null;
  readonly correlationId: string | null;
  readonly payloadJson: string;
  readonly occurredAt: IsoDateTimeString;
  readonly createdAt: IsoDateTimeString;
}

export interface AppendEventInput {
  readonly streamUid?: ObjectUid;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorId?: string;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly payloadJson: string;
}

export interface EventListResult {
  readonly items: readonly EventRecord[];
  readonly nextCursor: string | null;
}

// ── Search query / result ──────────────────────────────────────────

export interface SearchScope {
  readonly objectTypes?: readonly string[];
  readonly layers?: readonly Layer[];
  readonly updatedSince?: IsoDateTimeString;
  readonly updatedBefore?: IsoDateTimeString;
}

export interface SearchResult {
  readonly objectUid: ObjectUid;
  readonly objectType: string;
  readonly title: string | null;
  readonly snippet: string | null;
  readonly score: number;
  readonly highlights: readonly string[];
}
