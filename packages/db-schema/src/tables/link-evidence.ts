import type { TableModule } from '../types.js';

export const linkEvidenceTable: TableModule = {
  tableName: 'link_evidence',

  createTableSql: `CREATE TABLE IF NOT EXISTS link_evidence (
  id              TEXT PRIMARY KEY,
  link_id         TEXT NOT NULL REFERENCES links(link_id),
  evidence_type   TEXT NOT NULL,
  evidence_ref    TEXT,
  payload_json    TEXT,
  created_at      TEXT NOT NULL
);`,

  createIndexSqls: [
    `CREATE INDEX IF NOT EXISTS idx_le_link ON link_evidence(link_id);`,
    `CREATE INDEX IF NOT EXISTS idx_le_type ON link_evidence(evidence_type);`,
  ],
};
