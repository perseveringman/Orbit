import type { TableModule } from '../types.js';

export const objectIndexTable: TableModule = {
  tableName: 'object_index',

  createTableSql: `CREATE TABLE IF NOT EXISTS object_index (
  object_uid       TEXT PRIMARY KEY,
  object_type      TEXT NOT NULL,
  object_id        TEXT NOT NULL,
  canonical_table  TEXT NOT NULL,
  layer            TEXT NOT NULL,
  source_file_id   TEXT,
  title            TEXT,
  summary          TEXT,
  status           TEXT,
  origin           TEXT NOT NULL DEFAULT 'human',
  visibility       TEXT NOT NULL DEFAULT 'private',
  version_token    TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_flg      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(object_type, object_id)
);`,

  createIndexSqls: [
    `CREATE INDEX IF NOT EXISTS idx_oi_type_updated ON object_index(object_type, updated_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_oi_layer_type ON object_index(layer, object_type, deleted_flg, updated_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_oi_origin_updated ON object_index(origin, updated_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_oi_source_file ON object_index(source_file_id);`,
  ],
};
