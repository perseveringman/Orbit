import { useCallback } from 'react';
import { useOrbitData } from './orbit-data-context';

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface CreateSubscriptionInput {
  title: string;
  endpointType: string;
  url?: string;
  feedUrl?: string;
  description?: string | null;
  iconUrl?: string | null;
  language?: string | null;
  fetchIntervalMinutes?: number;
}

export interface SaveContentItemInput {
  sourceEndpointId: string;
  externalId?: string;
  title: string;
  contentType?: string;
  rawJson?: string;
  origin?: string;
}

export function useSubscriptionMutations() {
  const { db, repos, invalidate, ready } = useOrbitData();

  const createSubscription = useCallback(
    (input: CreateSubscriptionInput): string | null => {
      if (!ready || !db) return null;

      const id = generateId();
      const now = new Date().toISOString();

      db.transaction(() => {
        db.run(
          `INSERT INTO source_endpoints (id, title, endpoint_type, url, feed_url, description, icon_url, language, fetch_interval_minutes, sync_status, quality_score, total_items, confirmed_items, consecutive_errors, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', 0.5, 0, 0, 0, ?, ?, 0)`,
          [
            id,
            input.title,
            input.endpointType,
            input.url ?? null,
            input.feedUrl ?? null,
            input.description ?? null,
            input.iconUrl ?? null,
            input.language ?? null,
            input.fetchIntervalMinutes ?? 60,
            now,
            now,
          ],
        );

        db.run(
          `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
           VALUES (?, 'source_endpoint', ?, 'source_endpoints', 'system', ?, ?, 'active', 'human', 'private', ?, ?, ?, 0)`,
          [`source_endpoint:${id}`, id, input.title, input.description ?? null, `sub-${id}`, now, now],
        );

        db.run(
          `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
           VALUES (?, ?, ?, ?)`,
          [`source_endpoint:${id}`, input.title, input.description ?? '', input.endpointType],
        );

        if (repos) {
          repos.events.append({
            streamUid: `source_endpoint:${id}`,
            eventType: 'subscription.created',
            actorType: 'user',
            payloadJson: JSON.stringify({ title: input.title, type: input.endpointType, feedUrl: input.feedUrl }),
          });
        }
      });

      invalidate();
      return id;
    },
    [db, repos, invalidate, ready],
  );

  const pauseSubscription = useCallback(
    (id: string) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();
      db.run("UPDATE source_endpoints SET sync_status = 'paused', updated_at = ? WHERE id = ?", [now, id]);
      invalidate();
    },
    [db, invalidate, ready],
  );

  const resumeSubscription = useCallback(
    (id: string) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();
      db.run("UPDATE source_endpoints SET sync_status = 'idle', consecutive_errors = 0, updated_at = ? WHERE id = ?", [now, id]);
      invalidate();
    },
    [db, invalidate, ready],
  );

  const deleteSubscription = useCallback(
    (id: string) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();
      db.run('UPDATE source_endpoints SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, id]);
      db.run(
        'UPDATE object_index SET deleted_flg = 1, updated_at = ? WHERE object_id = ? AND object_type = ?',
        [now, id, 'source_endpoint'],
      );
      invalidate();
    },
    [db, invalidate, ready],
  );

  const updateSyncResult = useCallback(
    (id: string, result: { etag?: string; lastModified?: string; totalItems?: number; error?: string }) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();

      if (result.error) {
        db.run(
          `UPDATE source_endpoints SET sync_status = 'error', consecutive_errors = consecutive_errors + 1, last_error_at = ?, updated_at = ? WHERE id = ?`,
          [now, now, id],
        );
      } else {
        const sets = ["sync_status = 'idle'", 'last_synced_at = ?', 'consecutive_errors = 0', 'updated_at = ?'];
        const params: unknown[] = [now, now];

        if (result.etag !== undefined) {
          sets.push('etag = ?');
          params.push(result.etag);
        }
        if (result.lastModified !== undefined) {
          sets.push('last_modified = ?');
          params.push(result.lastModified);
        }
        if (result.totalItems !== undefined) {
          sets.push('total_items = ?');
          params.push(result.totalItems);
        }

        params.push(id);
        db.run(`UPDATE source_endpoints SET ${sets.join(', ')} WHERE id = ?`, params);
      }

      invalidate();
    },
    [db, invalidate, ready],
  );

  const saveContentItems = useCallback(
    (endpointId: string, items: SaveContentItemInput[]): number => {
      if (!ready || !db || items.length === 0) return 0;

      const now = new Date().toISOString();
      let inserted = 0;

      db.transaction(() => {
        for (const item of items) {
          const id = generateId();
          const externalId = item.externalId ?? item.title;

          // Skip duplicates by external_id
          const existing = db.query<{ cnt: number }>(
            'SELECT COUNT(*) as cnt FROM content_items WHERE source_endpoint_id = ? AND external_id = ? AND deleted_flg = 0',
            [endpointId, externalId],
          );
          if (existing[0]?.cnt && existing[0].cnt > 0) continue;

          db.run(
            `INSERT INTO content_items (id, source_endpoint_id, external_id, title, content_type, raw_json, origin, processing_depth, status, created_at, updated_at, deleted_flg)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'lightweight', 'pending', ?, ?, 0)`,
            [
              id,
              endpointId,
              externalId,
              item.title,
              item.contentType ?? null,
              item.rawJson ?? null,
              item.origin ?? 'feed_auto',
              now,
              now,
            ],
          );
          inserted++;
        }

        // Update total_items count
        const count = db.query<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM content_items WHERE source_endpoint_id = ? AND deleted_flg = 0',
          [endpointId],
        );
        db.run('UPDATE source_endpoints SET total_items = ?, updated_at = ? WHERE id = ?', [
          count[0]?.cnt ?? 0,
          now,
          endpointId,
        ]);
      });

      invalidate();
      return inserted;
    },
    [db, invalidate, ready],
  );

  const promoteToArticle = useCallback(
    (contentItemId: string): string | null => {
      if (!ready || !db) return null;

      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM content_items WHERE id = ? AND deleted_flg = 0',
        [contentItemId],
      );
      if (rows.length === 0) return null;

      const item = rows[0];
      const raw = item.raw_json ? JSON.parse(item.raw_json as string) : {};

      const articleId = generateId();
      const now = new Date().toISOString();

      db.transaction(() => {
        db.run(
          `INSERT INTO articles (id, content_item_id, source_endpoint_id, title, source_url, author, media_type, summary, status, origin, published_at, fetched_at, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, ?, ?, ?, 'web_article', ?, 'unread', 'feed_auto', ?, ?, ?, ?, 0)`,
          [
            articleId,
            contentItemId,
            item.source_endpoint_id,
            item.title ?? 'Untitled',
            raw.url ?? null,
            raw.author ?? null,
            raw.summary ?? null,
            raw.publishedAt ?? null,
            now,
            now,
            now,
          ],
        );

        db.run(
          `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
           VALUES (?, 'article', ?, 'articles', 'sources', ?, ?, 'unread', 'feed_auto', 'private', ?, ?, ?, 0)`,
          [`article:${articleId}`, articleId, item.title ?? 'Untitled', raw.summary ?? null, `promote-${articleId}`, now, now],
        );

        db.run("UPDATE content_items SET status = 'promoted', updated_at = ? WHERE id = ?", [now, contentItemId]);
      });

      invalidate();
      return articleId;
    },
    [db, invalidate, ready],
  );

  return {
    createSubscription,
    pauseSubscription,
    resumeSubscription,
    deleteSubscription,
    updateSyncResult,
    saveContentItems,
    promoteToArticle,
  };
}
