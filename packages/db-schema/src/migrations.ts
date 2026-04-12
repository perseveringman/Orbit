export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: readonly string[];
}

/** Migration tracking table — created before any migrations run. */
export const SCHEMA_MIGRATIONS_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL
);`;

/**
 * Registered migrations. Version numbers must be unique and monotonically increasing.
 * Each migration contains an array of SQL statements to execute in a single transaction.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: [
      // Version 1 is the bootstrap — handled by getBootstrapSql().
      // This entry exists so the migration table records that v1 has been applied.
    ],
  },
  {
    version: 2,
    name: 'add_reading_system_fields',
    sql: [
      "ALTER TABLE content_items ADD COLUMN origin TEXT NOT NULL DEFAULT 'feed_auto';",
      "ALTER TABLE content_items ADD COLUMN processing_depth TEXT NOT NULL DEFAULT 'lightweight';",
      "ALTER TABLE articles ADD COLUMN origin TEXT NOT NULL DEFAULT 'feed_auto';",
      "ALTER TABLE articles ADD COLUMN proposed_link_count INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE articles ADD COLUMN active_link_count INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE articles ADD COLUMN source_endpoint_quality REAL NOT NULL DEFAULT 0.0;",
      "ALTER TABLE source_endpoints ADD COLUMN quality_score REAL NOT NULL DEFAULT 0.5;",
      "ALTER TABLE source_endpoints ADD COLUMN total_items INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE source_endpoints ADD COLUMN confirmed_items INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE source_endpoints ADD COLUMN consecutive_errors INTEGER NOT NULL DEFAULT 0;",
      'ALTER TABLE source_endpoints ADD COLUMN last_error_at TEXT;',
    ],
  },
];

/** Returns the SQL to apply a specific migration (wrapped in a transaction). */
export function getMigrationSql(migration: Migration): string {
  const lines: string[] = [
    'BEGIN TRANSACTION;',
    ...migration.sql,
    `INSERT INTO schema_migrations (version, name, applied_at) VALUES (${migration.version}, '${migration.name}', datetime('now'));`,
    'COMMIT;',
  ];
  return lines.join('\n');
}
