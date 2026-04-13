import type { DatabasePort, SqlRow, SqlRunResult, DatabaseConnection } from '@orbit/platform-contracts';
import initSqlJs, { type Database } from 'sql.js';

/**
 * Creates a DatabasePort backed by sql.js (WASM SQLite in the browser).
 * The database is in-memory — data persists until page refresh.
 */
export async function createBrowserDatabasePort(): Promise<DatabasePort> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
  });
  const db: Database = new SQL.Database();

  return {
    async connect(): Promise<DatabaseConnection> {
      return { driver: 'sql.js', connectedAt: new Date().toISOString() };
    },
    async close(): Promise<void> {
      db.close();
    },
    query<T extends SqlRow = SqlRow>(sql: string, params?: unknown[]): T[] {
      const stmt = db.prepare(sql);
      if (params && params.length > 0) {
        stmt.bind(params as (string | number | null | Uint8Array)[]);
      }
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    },
    run(sql: string, params?: unknown[]): SqlRunResult {
      db.run(sql, params as (string | number | null | Uint8Array)[] | undefined);
      const changes = db.getRowsModified();
      const lastRow = db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid =
        lastRow.length > 0 && lastRow[0].values.length > 0
          ? (lastRow[0].values[0][0] as number)
          : 0;
      return { changes, lastInsertRowid };
    },
    exec(sql: string): void {
      db.run(sql);
    },
    transaction<T>(fn: () => T): T {
      db.run('BEGIN TRANSACTION');
      try {
        const result = fn();
        db.run('COMMIT');
        return result;
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
    },
  };
}
