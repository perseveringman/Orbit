import type { TableModule } from '../types.js';

export const objectSearchFtsTable: TableModule = {
  tableName: 'object_search_fts',

  createTableSql: `CREATE VIRTUAL TABLE IF NOT EXISTS object_search_fts USING fts5(
  object_uid UNINDEXED,
  title,
  summary,
  keywords,
  tokenize='unicode61'
);`,

  createIndexSqls: [],
};

export const objectChunksFtsTable: TableModule = {
  tableName: 'object_chunks_fts',

  createTableSql: `CREATE VIRTUAL TABLE IF NOT EXISTS object_chunks_fts USING fts5(
  object_uid UNINDEXED,
  block_id UNINDEXED,
  chunk_text,
  tokenize='unicode61'
);`,

  createIndexSqls: [],
};

export const ftsTables: readonly TableModule[] = [objectSearchFtsTable, objectChunksFtsTable];
