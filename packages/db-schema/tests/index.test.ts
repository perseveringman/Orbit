import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { ORBIT_SQLITE_TABLES, orbitSqliteBootstrapSql, orbitSqliteSchema, renderCreateTableSql } from '../src/index';

describe('db-schema', () => {
  it('输出 SQLite 建表语句', () => {
    const workspaceTable = orbitSqliteSchema.find((table) => table.name === ORBIT_SQLITE_TABLES.workspaces);

    expect(workspaceTable?.columns.some((column) => column.name === 'id')).toBe(true);
    expect(renderCreateTableSql(workspaceTable!)).toContain('CREATE TABLE IF NOT EXISTS workspaces');
  });

  it('为 P0 项目任务循环声明最小表与索引', () => {
    const projectsTable = orbitSqliteSchema.find((table) => table.name === ORBIT_SQLITE_TABLES.projects);
    const tasksTable = orbitSqliteSchema.find((table) => table.name === ORBIT_SQLITE_TABLES.tasks);
    const articleTagsTable = orbitSqliteSchema.find((table) => table.name === ORBIT_SQLITE_TABLES.articleTags);

    expect(projectsTable?.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['id', 'workspace_id', 'title', 'status', 'last_reviewed_at', 'deleted_at']),
    );
    expect(projectsTable?.indexes).toEqual(
      expect.arrayContaining([expect.objectContaining({ columns: ['workspace_id', 'status'] })]),
    );

    expect(tasksTable?.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'id',
        'workspace_id',
        'project_id',
        'title',
        'status',
        'today_on',
        'focus_rank',
        'completed_at',
        'last_reviewed_at',
        'deleted_at',
      ]),
    );
    expect(tasksTable?.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columns: ['workspace_id', 'status'] }),
        expect.objectContaining({ columns: ['workspace_id', 'today_on'] }),
        expect.objectContaining({ columns: ['workspace_id', 'focus_rank'] }),
        expect.objectContaining({ columns: ['project_id'] }),
      ]),
    );
    expect(renderCreateTableSql(tasksTable!)).toContain('CREATE TABLE IF NOT EXISTS tasks');
    expect(renderCreateTableSql(articleTagsTable!)).toContain('PRIMARY KEY (article_id, tag_id)');
    expect(orbitSqliteBootstrapSql.some((sql) => sql.includes('ON tasks (workspace_id, focus_rank)'))).toBe(true);
  });

  it('生成的 bootstrap SQL 可以直接在 SQLite 中执行', () => {
    const database = new DatabaseSync(':memory:');

    try {
      database.exec(orbitSqliteBootstrapSql.join('\n'));

      const primaryKeyColumns = database
        .prepare('PRAGMA table_info(article_tags);')
        .all() as Array<{ name: string; pk: number }>;

      expect(primaryKeyColumns.filter((column) => column.pk > 0).map((column) => column.name)).toEqual([
        'article_id',
        'tag_id',
      ]);
    } finally {
      database.close();
    }
  });

  it('拒绝向 article_tags 插入包含 NULL 主键列的记录', () => {
    const database = new DatabaseSync(':memory:');

    try {
      database.exec(orbitSqliteBootstrapSql.join('\n'));

      expect(() => {
        database.exec("INSERT INTO article_tags (article_id, tag_id, created_at) VALUES (NULL, 'tag-1', '2026-02-10T00:00:00.000Z');");
      }).toThrow();

      expect(() => {
        database.exec("INSERT INTO article_tags (article_id, tag_id, created_at) VALUES ('article-1', NULL, '2026-02-10T00:00:00.000Z');");
      }).toThrow();
    } finally {
      database.close();
    }
  });
});
