// ── Subscription Management ────────────────────────────────
import type {
  SourceEndpoint,
  SourceEndpointKind,
  SourceEndpointStatus,
  IsoDateTimeString,
} from '@orbit/domain';

// ── Subscription creation input ────────────────────────────

export interface CreateSubscriptionInput {
  readonly title: string;
  readonly kind: SourceEndpointKind;
  readonly url: string;
  readonly siteUrl?: string | null;
  readonly description?: string | null;
  readonly language?: string | null;
  readonly iconUrl?: string | null;
  readonly fetchIntervalMinutes?: number | null;
}

export function createSubscription(input: CreateSubscriptionInput): SourceEndpoint {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    objectType: 'source_endpoint',
    id: crypto.randomUUID(),
    title: input.title,
    kind: input.kind,
    url: input.url,
    siteUrl: input.siteUrl ?? null,
    description: input.description ?? null,
    language: input.language ?? null,
    iconUrl: input.iconUrl ?? null,
    status: 'active',
    fetchIntervalMinutes: input.fetchIntervalMinutes ?? null,
    lastFetchedAt: null,
    lastFetchError: null,
    qualityScore: 0.5,
    totalItems: 0,
    confirmedItems: 0,
    consecutiveErrors: 0,
    lastErrorAt: null,
    discoveryRule: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Subscription filter ────────────────────────────────────

export interface SubscriptionFilter {
  readonly kind?: SourceEndpointKind;
  readonly status?: SourceEndpointStatus;
  readonly language?: string;
  readonly searchText?: string;
}

export function matchesFilter(endpoint: SourceEndpoint, filter: SubscriptionFilter): boolean {
  if (filter.kind && endpoint.kind !== filter.kind) return false;
  if (filter.status && endpoint.status !== filter.status) return false;
  if (filter.language && endpoint.language !== filter.language) return false;
  if (filter.searchText) {
    const q = filter.searchText.toLowerCase();
    const haystack = `${endpoint.title} ${endpoint.description ?? ''} ${endpoint.url}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// ── Fetch schedule ─────────────────────────────────────────

export interface FetchSchedule {
  readonly endpointId: string;
  readonly lastFetchedAt: IsoDateTimeString | null;
  readonly intervalMinutes: number;
  readonly nextFetchAt: IsoDateTimeString;
}

export function computeNextFetch(endpoint: SourceEndpoint): FetchSchedule {
  const interval = endpoint.fetchIntervalMinutes ?? 60;
  const lastFetch = endpoint.lastFetchedAt
    ? new Date(endpoint.lastFetchedAt).getTime()
    : Date.now();
  const nextFetchAt = new Date(lastFetch + interval * 60_000).toISOString() as IsoDateTimeString;

  return {
    endpointId: endpoint.id,
    lastFetchedAt: endpoint.lastFetchedAt,
    intervalMinutes: interval,
    nextFetchAt,
  };
}

// ── Subscription manager interface ─────────────────────────

export interface SubscriptionManager {
  readonly subscribe: (input: CreateSubscriptionInput) => SourceEndpoint;
  readonly unsubscribe: (id: string) => void;
  readonly pause: (id: string) => SourceEndpoint;
  readonly resume: (id: string) => SourceEndpoint;
  readonly setFetchInterval: (id: string, minutes: number) => SourceEndpoint;
  readonly mute: (id: string) => SourceEndpoint;
  readonly unmute: (id: string) => SourceEndpoint;
  readonly list: (filter?: SubscriptionFilter) => readonly SourceEndpoint[];
  readonly getById: (id: string) => SourceEndpoint | undefined;
}
