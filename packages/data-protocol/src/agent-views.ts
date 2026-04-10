import type {
  ActorType,
  IsoDateTimeString,
  ObjectOrigin,
  ObjectUid,
} from './common.js';

// ── Agent logical views (doc 12 §3.7) ─────────────────────────────
// The agent sees the full schema projected as a minimal 3-view model.

/** `agent_items_v` — simplified object view for agents */
export interface AgentItemView {
  readonly objectUid: ObjectUid;
  readonly objectType: string;
  readonly title: string | null;
  readonly summary: string | null;
  readonly status: string | null;
  readonly origin: ObjectOrigin;
  readonly layer: string;
  readonly updatedAt: IsoDateTimeString;
}

/** `agent_links_v` — simplified link view for agents */
export interface AgentLinkView {
  readonly linkId: string;
  readonly sourceUid: ObjectUid;
  readonly targetUid: ObjectUid;
  readonly relationType: string;
  readonly origin: ObjectOrigin;
  readonly status: string;
  readonly confidence: number | null;
  readonly whySummary: string | null;
}

/** `agent_events_v` — simplified event view for agents */
export interface AgentEventView {
  readonly eventId: string;
  readonly streamUid: ObjectUid | null;
  readonly eventType: string;
  readonly actorType: ActorType;
  readonly payloadJson: string;
  readonly occurredAt: IsoDateTimeString;
}

// ── Agent query / filter types ─────────────────────────────────────

export interface AgentQueryFilter {
  readonly objectType?: string;
  readonly status?: string;
  readonly origin?: ObjectOrigin;
  readonly layer?: string;
  readonly textSearch?: string;
  readonly updatedSince?: IsoDateTimeString;
  readonly limit?: number;
}

export interface AgentLinkFilter {
  readonly sourceUid?: ObjectUid;
  readonly targetUid?: ObjectUid;
  readonly relationType?: string;
  readonly origin?: ObjectOrigin;
  readonly status?: string;
  readonly limit?: number;
}

export interface AgentWriteLinkInput {
  readonly sourceUid: ObjectUid;
  readonly targetUid: ObjectUid;
  readonly relationType: string;
  readonly origin?: ObjectOrigin;
  readonly confidence?: number;
  readonly whySummary?: string;
}

export interface AgentAppendEventInput {
  readonly streamUid?: ObjectUid;
  readonly eventType: string;
  readonly actorType?: ActorType;
  readonly payloadJson: string;
}

// ── Agent data access protocol ─────────────────────────────────────

/**
 * Unified data access interface for agents.
 * Agents interact through this simplified protocol rather than
 * querying raw tables directly.
 */
export interface AgentDataAccess {
  items: {
    query(filter: AgentQueryFilter): Promise<AgentItemView[]>;
    read(objectUid: ObjectUid): Promise<AgentItemView | null>;
  };
  links: {
    list(filter: AgentLinkFilter): Promise<AgentLinkView[]>;
    write(input: AgentWriteLinkInput): Promise<AgentLinkView>;
  };
  events: {
    list(streamUid: ObjectUid, since?: string): Promise<AgentEventView[]>;
    append(input: AgentAppendEventInput): Promise<AgentEventView>;
  };
  search: {
    query(text: string, scope?: string): Promise<AgentItemView[]>;
  };
}
