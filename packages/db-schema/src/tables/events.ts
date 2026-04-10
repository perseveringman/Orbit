import type { TableModule } from '../types.js';

export const eventsTable: TableModule = {
  tableName: 'events',

  createTableSql: `CREATE TABLE IF NOT EXISTS events (
  event_id        TEXT PRIMARY KEY,
  stream_uid      TEXT,
  event_type      TEXT NOT NULL,
  actor_type      TEXT NOT NULL,
  actor_id        TEXT,
  causation_id    TEXT,
  correlation_id  TEXT,
  payload_json    TEXT NOT NULL,
  occurred_at     TEXT NOT NULL,
  created_at      TEXT NOT NULL
);`,

  createIndexSqls: [
    `CREATE INDEX IF NOT EXISTS idx_events_stream ON events(stream_uid, occurred_at);`,
    `CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, occurred_at);`,
    `CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_type, occurred_at);`,
    `CREATE INDEX IF NOT EXISTS idx_events_causation ON events(causation_id);`,
    `CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);`,
  ],
};
