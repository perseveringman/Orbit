import { getBootstrapSql, SCHEMA_MIGRATIONS_SQL, migrations } from '@orbit/db-schema';
import type { DatabasePort } from '@orbit/platform-contracts';

/**
 * Initialize a fresh database with the full schema.
 * Idempotent — safe to call on an already-initialized database.
 */
export function bootstrapDatabase(db: DatabasePort): void {
  // 1. Create migration tracking table
  db.exec(SCHEMA_MIGRATIONS_SQL);

  // 2. Check if already bootstrapped
  const rows = db.query<{ version: number }>(
    'SELECT version FROM schema_migrations WHERE version = 1',
  );
  if (rows.length > 0) return;

  // 3. Run bootstrap DDL
  db.exec(getBootstrapSql());

  // 4. Record v1 migration
  db.run(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'))",
    [1, 'initial_schema'],
  );
}

/**
 * Run any pending migrations.
 * Returns the number of migrations applied.
 */
export function runMigrations(db: DatabasePort): number {
  const applied = db.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  let count = 0;
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    // Version 1 is the bootstrap — handled by bootstrapDatabase()
    if (migration.sql.length === 0 && migration.version === 1) continue;

    db.transaction(() => {
      for (const stmt of migration.sql) {
        db.exec(stmt);
      }
      db.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'))",
        [migration.version, migration.name],
      );
    });
    count++;
  }
  return count;
}

/**
 * Full database initialization: bootstrap + migrate.
 */
export function initializeDatabase(
  db: DatabasePort,
): { bootstrapped: boolean; migrationsRun: number } {
  const wasFresh =
    db.query<{ name: string }>(
      'SELECT name FROM sqlite_master WHERE type = ? AND name = ?',
      ['table', 'schema_migrations'],
    ).length === 0;

  bootstrapDatabase(db);
  const migrationsRun = runMigrations(db);

  return { bootstrapped: wasFresh, migrationsRun };
}
