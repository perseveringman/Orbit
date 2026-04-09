import { describe, expect, it } from 'vitest';

import { ORBIT_SQLITE_TABLES, orbitSqliteSchema, renderCreateTableSql } from '../src/index';

describe('db-schema', () => {
  it('输出 SQLite 建表语句', () => {
    const workspaceTable = orbitSqliteSchema.find((table) => table.name === ORBIT_SQLITE_TABLES.workspaces);

    expect(workspaceTable?.columns.some((column) => column.name === 'id')).toBe(true);
    expect(renderCreateTableSql(workspaceTable!)).toContain('CREATE TABLE IF NOT EXISTS workspaces');
  });
});
