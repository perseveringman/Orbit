import { useMemo } from 'react';
import type { DatabasePort } from '@orbit/platform-contracts';
import { useOrbitData } from './orbit-data-context';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReaderArticle {
  id: string;
  contentItemId: string | null;
  sourceEndpointId: string | null;
  title: string;
  sourceUrl: string | null;
  author: string | null;
  mediaType: string;
  language: string | null;
  summary: string | null;
  status: 'unread' | 'reading' | 'archived';
  readingProgress: number | null;
  origin: string;
  publishedAt: string | null;
  fetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReaderHighlight {
  id: string;
  sourceObjectType: string;
  sourceObjectId: string;
  anchorJson: string;
  quoteText: string;
  color: string | null;
  note: string | null;
  highlightKind: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleFilter {
  status?: 'unread' | 'reading' | 'archived';
  mediaType?: string;
  sourceEndpointId?: string;
  limit?: number;
}

// ── Row mappers ────────────────────────────────────────────────────────────

function rowToArticle(row: Record<string, unknown>): ReaderArticle {
  return {
    id: row.id as string,
    contentItemId: (row.content_item_id as string) ?? null,
    sourceEndpointId: (row.source_endpoint_id as string) ?? null,
    title: row.title as string,
    sourceUrl: (row.source_url as string) ?? null,
    author: (row.author as string) ?? null,
    mediaType: (row.media_type as string) || 'web_article',
    language: (row.language as string) ?? null,
    summary: (row.summary as string) ?? null,
    status: ((row.status as string) || 'unread') as ReaderArticle['status'],
    readingProgress: row.reading_progress != null ? Number(row.reading_progress) : null,
    origin: (row.origin as string) || 'user_save',
    publishedAt: (row.published_at as string) ?? null,
    fetchedAt: (row.fetched_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToHighlight(row: Record<string, unknown>): ReaderHighlight {
  return {
    id: row.id as string,
    sourceObjectType: row.source_object_type as string,
    sourceObjectId: row.source_object_id as string,
    anchorJson: row.anchor_json as string,
    quoteText: row.quote_text as string,
    color: (row.color as string) ?? null,
    note: (row.note as string) ?? null,
    highlightKind: (row.highlight_kind as string) || 'highlight',
    createdBy: (row.created_by as string) || 'manual',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useArticleList(filter?: ArticleFilter): { articles: ReaderArticle[]; loading: boolean } {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return { articles: [], loading: !ready };
    try {
      const wheres = ['deleted_flg = 0'];
      const params: unknown[] = [];

      if (filter?.status) {
        wheres.push('status = ?');
        params.push(filter.status);
      }
      if (filter?.mediaType) {
        wheres.push('media_type = ?');
        params.push(filter.mediaType);
      }
      if (filter?.sourceEndpointId) {
        wheres.push('source_endpoint_id = ?');
        params.push(filter.sourceEndpointId);
      }

      const limit = filter?.limit ?? 200;
      const sql = `SELECT * FROM articles WHERE ${wheres.join(' AND ')} ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = db.query<Record<string, unknown>>(sql, params);
      return { articles: rows.map(rowToArticle), loading: false };
    } catch {
      return { articles: [], loading: false };
    }
  }, [db, version, ready, filter?.status, filter?.mediaType, filter?.sourceEndpointId, filter?.limit]);
}

export function useArticle(id: string | null): ReaderArticle | null {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !id) return null;
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM articles WHERE id = ? AND deleted_flg = 0',
        [id],
      );
      return rows.length > 0 ? rowToArticle(rows[0]) : null;
    } catch {
      return null;
    }
  }, [db, id, version, ready]);
}

export function useHighlightsForArticle(articleId: string | null): ReaderHighlight[] {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !articleId) return [];
    try {
      const rows = db.query<Record<string, unknown>>(
        `SELECT * FROM highlights
         WHERE source_object_type = 'article' AND source_object_id = ? AND deleted_flg = 0
         ORDER BY created_at DESC`,
        [articleId],
      );
      return rows.map(rowToHighlight);
    } catch {
      return [];
    }
  }, [db, articleId, version, ready]);
}

export function useArticleCount(): { total: number; unread: number } {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return { total: 0, unread: 0 };
    try {
      const total = db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM articles WHERE deleted_flg = 0');
      const unread = db.query<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM articles WHERE deleted_flg = 0 AND status = 'unread'",
      );
      return { total: total[0]?.cnt ?? 0, unread: unread[0]?.cnt ?? 0 };
    } catch {
      return { total: 0, unread: 0 };
    }
  }, [db, version, ready]);
}
