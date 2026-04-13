import { useCallback } from 'react';
import { useOrbitData } from './orbit-data-context';

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface SaveArticleInput {
  title: string;
  sourceUrl: string;
  author?: string | null;
  summary?: string | null;
  mediaType?: string;
  language?: string | null;
  publishedAt?: string | null;
  sourceEndpointId?: string | null;
  contentItemId?: string | null;
  origin?: string;
}

export function useReaderMutations() {
  const { db, repos, invalidate, ready } = useOrbitData();

  const saveArticleFromUrl = useCallback(
    (input: SaveArticleInput): string | null => {
      if (!ready || !db) return null;

      const id = generateId();
      const now = new Date().toISOString();
      const mediaType = input.mediaType || 'web_article';
      const origin = input.origin || 'user_save';

      db.transaction(() => {
        db.run(
          `INSERT INTO articles (id, content_item_id, source_endpoint_id, title, source_url, author, media_type, language, summary, status, origin, published_at, fetched_at, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unread', ?, ?, ?, ?, ?, 0)`,
          [
            id,
            input.contentItemId ?? null,
            input.sourceEndpointId ?? null,
            input.title,
            input.sourceUrl,
            input.author ?? null,
            mediaType,
            input.language ?? null,
            input.summary ?? null,
            origin,
            input.publishedAt ?? null,
            now,
            now,
            now,
          ],
        );

        db.run(
          `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
           VALUES (?, 'article', ?, 'articles', 'sources', ?, ?, 'unread', ?, 'private', ?, ?, ?, 0)`,
          [`article:${id}`, id, input.title, input.summary ?? null, origin, `save-${id}`, now, now],
        );

        db.run(
          `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
           VALUES (?, ?, ?, ?)`,
          [`article:${id}`, input.title, input.summary ?? '', input.author ?? ''],
        );

        if (repos) {
          repos.events.append({
            streamUid: `article:${id}`,
            eventType: 'article.saved',
            actorType: 'user',
            payloadJson: JSON.stringify({ title: input.title, url: input.sourceUrl, mediaType }),
          });
        }
      });

      invalidate();
      return id;
    },
    [db, repos, invalidate, ready],
  );

  const updateArticleStatus = useCallback(
    (articleId: string, newStatus: 'unread' | 'reading' | 'archived') => {
      if (!ready || !db) return;
      const now = new Date().toISOString();

      db.run('UPDATE articles SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, articleId]);
      db.run(
        'UPDATE object_index SET status = ?, updated_at = ? WHERE object_id = ? AND object_type = ?',
        [newStatus, now, articleId, 'article'],
      );

      invalidate();
    },
    [db, invalidate, ready],
  );

  const updateReadingProgress = useCallback(
    (articleId: string, progress: number) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();
      const clamped = Math.max(0, Math.min(1, progress));

      db.run('UPDATE articles SET reading_progress = ?, updated_at = ? WHERE id = ?', [clamped, now, articleId]);
      invalidate();
    },
    [db, invalidate, ready],
  );

  const deleteArticle = useCallback(
    (articleId: string) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();

      db.run('UPDATE articles SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, articleId]);
      db.run(
        'UPDATE object_index SET deleted_flg = 1, updated_at = ? WHERE object_id = ? AND object_type = ?',
        [now, articleId, 'article'],
      );

      invalidate();
    },
    [db, invalidate, ready],
  );

  const createHighlight = useCallback(
    (input: {
      articleId: string;
      quoteText: string;
      color?: string;
      note?: string;
      anchorJson?: string;
      highlightKind?: string;
    }): string | null => {
      if (!ready || !db) return null;

      const id = generateId();
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO highlights (id, source_object_type, source_object_id, anchor_json, quote_text, color, note, highlight_kind, created_by, created_at, updated_at, deleted_flg)
         VALUES (?, 'article', ?, ?, ?, ?, ?, ?, 'manual', ?, ?, 0)`,
        [
          id,
          input.articleId,
          input.anchorJson ?? '{}',
          input.quoteText,
          input.color ?? 'yellow',
          input.note ?? null,
          input.highlightKind ?? 'highlight',
          now,
          now,
        ],
      );

      invalidate();
      return id;
    },
    [db, invalidate, ready],
  );

  const deleteHighlight = useCallback(
    (highlightId: string) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();
      db.run('UPDATE highlights SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, highlightId]);
      invalidate();
    },
    [db, invalidate, ready],
  );

  return {
    saveArticleFromUrl,
    updateArticleStatus,
    updateReadingProgress,
    deleteArticle,
    createHighlight,
    deleteHighlight,
  };
}
