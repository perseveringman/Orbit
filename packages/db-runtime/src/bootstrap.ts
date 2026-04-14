import {
  getBootstrapSql,
  objectChunksFtsTable,
  objectSearchFtsTable,
  SCHEMA_MIGRATIONS_SQL,
  migrations,
} from '@orbit/db-schema';
import type { DatabasePort } from '@orbit/platform-contracts';

const OBJECT_SEARCH_FTS_FALLBACK_SQL = `CREATE TABLE IF NOT EXISTS object_search_fts (
  object_uid TEXT PRIMARY KEY,
  title TEXT,
  summary TEXT,
  keywords TEXT
);`;

const OBJECT_CHUNKS_FTS_FALLBACK_SQL = `CREATE TABLE IF NOT EXISTS object_chunks_fts (
  object_uid TEXT NOT NULL,
  block_id TEXT NOT NULL,
  chunk_text TEXT,
  PRIMARY KEY (object_uid, block_id)
);`;

function isMissingFts5Module(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('fts5') || message.includes('no such module');
}

function supportsFts5(db: DatabasePort): boolean {
  try {
    db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS __orbit_fts5_probe USING fts5(content);');
    db.exec('DROP TABLE IF EXISTS __orbit_fts5_probe;');
    return true;
  } catch (error) {
    if (isMissingFts5Module(error)) {
      return false;
    }
    throw error;
  }
}

function getBootstrapSqlForDatabase(db: DatabasePort): string {
  const sql = getBootstrapSql();
  if (supportsFts5(db)) {
    return sql;
  }

  return sql
    .replace(objectSearchFtsTable.createTableSql, OBJECT_SEARCH_FTS_FALLBACK_SQL)
    .replace(objectChunksFtsTable.createTableSql, OBJECT_CHUNKS_FTS_FALLBACK_SQL);
}

function tableHasColumn(db: DatabasePort, table: string, column: string): boolean {
  const rows = db.query<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

function migrationAlreadySatisfied(db: DatabasePort, version: number): boolean {
  if (version !== 2) return false;

  return [
    ['content_items', 'origin'],
    ['content_items', 'processing_depth'],
    ['articles', 'origin'],
    ['articles', 'proposed_link_count'],
    ['articles', 'active_link_count'],
    ['articles', 'source_endpoint_quality'],
    ['source_endpoints', 'quality_score'],
    ['source_endpoints', 'total_items'],
    ['source_endpoints', 'confirmed_items'],
    ['source_endpoints', 'consecutive_errors'],
    ['source_endpoints', 'last_error_at'],
  ].every(([table, column]) => tableHasColumn(db, table, column));
}

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
  db.exec(getBootstrapSqlForDatabase(db));

  // 4. Fresh bootstrap materializes the latest schema, so mark all known
  // migrations as already applied.
  for (const migration of migrations) {
    db.run(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'))",
      [migration.version, migration.name],
    );
  }
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

    if (migrationAlreadySatisfied(db, migration.version)) {
      db.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'))",
        [migration.version, migration.name],
      );
      count++;
      continue;
    }

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
