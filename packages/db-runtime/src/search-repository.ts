import type { DatabasePort } from '@orbit/platform-contracts';
import type { SearchRepository, SearchResult, SearchScope } from '@orbit/data-protocol';
import { keysToCamel } from './helpers.js';

export class SqliteSearchRepository implements SearchRepository {
  constructor(private readonly db: DatabasePort) {}

  async query(text: string, scope?: SearchScope): Promise<SearchResult[]> {
    if (!text.trim()) return [];

    const conditions: string[] = ['fts.object_search_fts MATCH ?'];
    const params: unknown[] = [text];

    const joins: string[] = [
      'JOIN object_index oi ON fts.object_uid = oi.object_uid',
    ];

    const filterConditions: string[] = ['oi.deleted_flg = 0'];

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
    const sql = `
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
