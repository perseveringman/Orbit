import type { TableModule } from '../types.js';

export const fileIndexTable: TableModule = {
  tableName: 'file_index',

  createTableSql: `CREATE TABLE IF NOT EXISTS file_index (
  object_id            TEXT PRIMARY KEY,
  layer                TEXT NOT NULL,
  canonical_path       TEXT NOT NULL,
  bundle_path          TEXT,
  mtime                TEXT,
  size                 INTEGER,
  content_hash         TEXT,
  parse_status         TEXT NOT NULL DEFAULT 'pending',
  parse_error          TEXT,
  frontmatter_snapshot TEXT,
  deleted_flg          INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);`,

  createIndexSqls: [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_fi_canonical_path ON file_index(canonical_path);`,
    `CREATE INDEX IF NOT EXISTS idx_fi_layer ON file_index(layer, deleted_flg);`,
    `CREATE INDEX IF NOT EXISTS idx_fi_content_hash ON file_index(content_hash);`,
    `CREATE INDEX IF NOT EXISTS idx_fi_parse_status ON file_index(parse_status);`,
  ],
};
