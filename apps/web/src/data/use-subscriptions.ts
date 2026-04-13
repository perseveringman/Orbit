import { useMemo } from 'react';
import { useOrbitData } from './orbit-data-context';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  title: string;
  endpointType: string;
  url: string | null;
  feedUrl: string | null;
  description: string | null;
  iconUrl: string | null;
  language: string | null;
  fetchIntervalMinutes: number;
  syncStatus: string;
  lastSyncedAt: string | null;
  etag: string | null;
  lastModified: string | null;
  qualityScore: number;
  totalItems: number;
  confirmedItems: number;
  consecutiveErrors: number;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentItem {
  id: string;
  sourceEndpointId: string | null;
  externalId: string | null;
  title: string | null;
  contentType: string | null;
  rawJson: string | null;
  origin: string;
  processingDepth: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionFilter {
  syncStatus?: string;
  endpointType?: string;
}

// ── Row mappers ────────────────────────────────────────────────────────────

function rowToSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    title: row.title as string,
    endpointType: row.endpoint_type as string,
    url: (row.url as string) ?? null,
    feedUrl: (row.feed_url as string) ?? null,
    description: (row.description as string) ?? null,
    iconUrl: (row.icon_url as string) ?? null,
    language: (row.language as string) ?? null,
    fetchIntervalMinutes: (row.fetch_interval_minutes as number) ?? 60,
    syncStatus: (row.sync_status as string) || 'idle',
    lastSyncedAt: (row.last_synced_at as string) ?? null,
    etag: (row.etag as string) ?? null,
    lastModified: (row.last_modified as string) ?? null,
    qualityScore: (row.quality_score as number) ?? 0.5,
    totalItems: (row.total_items as number) ?? 0,
    confirmedItems: (row.confirmed_items as number) ?? 0,
    consecutiveErrors: (row.consecutive_errors as number) ?? 0,
    lastErrorAt: (row.last_error_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToContentItem(row: Record<string, unknown>): ContentItem {
  return {
    id: row.id as string,
    sourceEndpointId: (row.source_endpoint_id as string) ?? null,
    externalId: (row.external_id as string) ?? null,
    title: (row.title as string) ?? null,
    contentType: (row.content_type as string) ?? null,
    rawJson: (row.raw_json as string) ?? null,
    origin: (row.origin as string) || 'feed_auto',
    processingDepth: (row.processing_depth as string) || 'lightweight',
    status: (row.status as string) || 'pending',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useSubscriptionList(filter?: SubscriptionFilter): { subscriptions: Subscription[]; loading: boolean } {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return { subscriptions: [], loading: !ready };
    try {
      const wheres = ['deleted_flg = 0'];
      const params: unknown[] = [];

      if (filter?.syncStatus) {
        wheres.push('sync_status = ?');
        params.push(filter.syncStatus);
      }
      if (filter?.endpointType) {
        wheres.push('endpoint_type = ?');
        params.push(filter.endpointType);
      }

      const sql = `SELECT * FROM source_endpoints WHERE ${wheres.join(' AND ')} ORDER BY created_at DESC`;
      const rows = db.query<Record<string, unknown>>(sql, params);
      return { subscriptions: rows.map(rowToSubscription), loading: false };
    } catch {
      return { subscriptions: [], loading: false };
    }
  }, [db, version, ready, filter?.syncStatus, filter?.endpointType]);
}

export function useSubscription(id: string | null): Subscription | null {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !id) return null;
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM source_endpoints WHERE id = ? AND deleted_flg = 0',
        [id],
      );
      return rows.length > 0 ? rowToSubscription(rows[0]) : null;
    } catch {
      return null;
    }
  }, [db, id, version, ready]);
}

export function useContentItemsForEndpoint(endpointId: string | null): ContentItem[] {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !endpointId) return [];
    try {
      const rows = db.query<Record<string, unknown>>(
        `SELECT * FROM content_items
         WHERE source_endpoint_id = ? AND deleted_flg = 0
         ORDER BY created_at DESC LIMIT 50`,
        [endpointId],
      );
      return rows.map(rowToContentItem);
    } catch {
      return [];
    }
  }, [db, endpointId, version, ready]);
}

export function useSubscriptionCount(): number {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return 0;
    try {
      const rows = db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM source_endpoints WHERE deleted_flg = 0');
      return rows[0]?.cnt ?? 0;
    } catch {
      return 0;
    }
  }, [db, version, ready]);
}
