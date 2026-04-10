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
