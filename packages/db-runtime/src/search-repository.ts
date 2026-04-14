import type { DatabasePort } from '@orbit/platform-contracts';
import type { SearchRepository, SearchResult, SearchScope } from '@orbit/data-protocol';
import { keysToCamel } from './helpers.js';

type SearchMode = 'fts5' | 'fallback';

function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

export class SqliteSearchRepository implements SearchRepository {
  private searchMode: SearchMode | null = null;

  constructor(private readonly db: DatabasePort) {}

  private resolveSearchMode(): SearchMode {
    if (this.searchMode) return this.searchMode;

    const rows = this.db.query<{ sql: string | null }>(
      'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
      ['table', 'object_search_fts'],
    );
    const schemaSql = rows[0]?.sql ?? '';

    this.searchMode =
      schemaSql.toLowerCase().includes('virtual table') && schemaSql.toLowerCase().includes('fts5')
        ? 'fts5'
        : 'fallback';
    return this.searchMode;
  }

  async query(text: string, scope?: SearchScope): Promise<SearchResult[]> {
    if (!text.trim()) return [];

    const joins: string[] = [
      'JOIN object_index oi ON fts.object_uid = oi.object_uid',
    ];

    const filterConditions: string[] = ['oi.deleted_flg = 0'];
    const mode = this.resolveSearchMode();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (mode === 'fts5') {
      conditions.push('fts.object_search_fts MATCH ?');
      params.push(text);
    } else {
      const escaped = `%${escapeLikePattern(text)}%`;
      conditions.push("(fts.title LIKE ? ESCAPE '\\' OR fts.summary LIKE ? ESCAPE '\\' OR fts.keywords LIKE ? ESCAPE '\\')");
      params.push(escaped, escaped, escaped);
    }

    if (scope?.objectTypes && scope.objectTypes.length > 0) {
      const placeholders = scope.objectTypes.map(() => '?').join(', ');
      filterConditions.push(`oi.object_type IN (${placeholders})`);
      params.push(...scope.objectTypes);
    }
    if (scope?.layers && scope.layers.length > 0) {
      const placeholders = scope.layers.map(() => '?').join(', ');
      filterConditions.push(`oi.layer IN (${placeholders})`);
      params.push(...scope.layers);
    }
    if (scope?.updatedSince) {
      filterConditions.push('oi.updated_at > ?');
      params.push(scope.updatedSince);
    }
    if (scope?.updatedBefore) {
      filterConditions.push('oi.updated_at < ?');
      params.push(scope.updatedBefore);
    }

    const allConditions = [...conditions, ...filterConditions];
    const sql = mode === 'fts5'
      ? `
        SELECT
          fts.object_uid,
          oi.object_type,
          oi.title,
          snippet(object_search_fts, 2, '<b>', '</b>', '...', 32) AS snippet,
          rank AS score
        FROM object_search_fts fts
        ${joins.join(' ')}
        WHERE ${allConditions.join(' AND ')}
        ORDER BY rank
        LIMIT 50`
      : `
        SELECT
          fts.object_uid,
          oi.object_type,
          oi.title,
          COALESCE(NULLIF(fts.summary, ''), NULLIF(oi.summary, ''), oi.title) AS snippet,
          0 AS score
        FROM object_search_fts fts
        ${joins.join(' ')}
        WHERE ${allConditions.join(' AND ')}
        ORDER BY oi.updated_at DESC
        LIMIT 50`;

    const rows = this.db.query<Record<string, unknown>>(sql, params);

    return rows.map((row) => {
      const camel = keysToCamel(row);
      return {
        objectUid: camel.objectUid as string,
        objectType: camel.objectType as string,
        title: (camel.title as string) ?? null,
        snippet: (camel.snippet as string) ?? null,
        score: typeof camel.score === 'number' ? camel.score : 0,
        highlights: [],
      } as SearchResult;
    });
  }
}
