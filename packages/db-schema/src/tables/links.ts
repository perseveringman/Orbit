import type { TableModule } from '../types.js';

export const linksTable: TableModule = {
  tableName: 'links',

  createTableSql: `CREATE TABLE IF NOT EXISTS links (
  link_id        TEXT PRIMARY KEY,
  source_uid     TEXT NOT NULL REFERENCES object_index(object_uid),
  target_uid     TEXT NOT NULL REFERENCES object_index(object_uid),
  relation_type  TEXT NOT NULL,
  origin         TEXT NOT NULL,
  source_channel TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  confidence     REAL,
  why_summary    TEXT,
  context_json   TEXT,
  weight         REAL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_flg    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_uid, target_uid, relation_type)
);`,

  createIndexSqls: [
    `CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_uid, deleted_flg);`,
    `CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_uid, deleted_flg);`,
    `CREATE INDEX IF NOT EXISTS idx_links_relation ON links(relation_type, deleted_flg);`,
    `CREATE INDEX IF NOT EXISTS idx_links_origin ON links(origin, status, deleted_flg);`,
  ],
};
