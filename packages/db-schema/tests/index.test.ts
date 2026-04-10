import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  TABLE_NAMES,
  getAllCreateTableStatements,
  getAllCreateIndexStatements,
  getBootstrapSql,
  SCHEMA_MIGRATIONS_SQL,
  objectIndexTable,
  linksTable,
  eventsTable,
  linkEvidenceTable,
  fileIndexTable,
  ftsTables,
  typeTables,
  agentViews,
} from '../src/index.js';

describe('db-schema', () => {
  // -----------------------------------------------------------------------
  // SQL validity
  // -----------------------------------------------------------------------

  it('all CREATE TABLE statements are syntactically valid SQL', () => {
    const db = new DatabaseSync(':memory:');
    try {
      // Execute all table creation statements — if any is invalid, SQLite will throw
      const stmts = getAllCreateTableStatements();
      expect(stmts.length).toBeGreaterThan(0);
      for (const sql of stmts) {
        db.exec(sql);
      }
    } finally {
      db.close();
    }
  });

  it('all CREATE INDEX statements are valid after tables exist', () => {
    const db = new DatabaseSync(':memory:');
    try {
      for (const sql of getAllCreateTableStatements()) {
        db.exec(sql);
      }
      const indexes = getAllCreateIndexStatements();
      expect(indexes.length).toBeGreaterThan(0);
      for (const sql of indexes) {
        db.exec(sql);
      }
    } finally {
      db.close();
    }
  });

  // -----------------------------------------------------------------------
  // Bootstrap SQL
  // -----------------------------------------------------------------------

  it('getBootstrapSql() produces executable DDL that creates all tables', () => {
    const db = new DatabaseSync(':memory:');
    try {
      const bootstrap = getBootstrapSql();
      expect(bootstrap).toContain('object_index');
      expect(bootstrap).toContain('links');
      expect(bootstrap).toContain('events');
      db.exec(bootstrap);

      // Verify core tables exist by querying sqlite_master
      const tables = (
        db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all() as Array<{
          name: string;
        }>
      ).map((r) => r.name);

      // Check key tables are present
      expect(tables).toContain('object_index');
      expect(tables).toContain('links');
      expect(tables).toContain('events');
      expect(tables).toContain('link_evidence');
      expect(tables).toContain('file_index');
      expect(tables).toContain('tasks');
      expect(tables).toContain('projects');
      expect(tables).toContain('tags');
      expect(tables).toContain('ai_chats');

      // Check views
      expect(tables).toContain('agent_items_v');
      expect(tables).toContain('agent_links_v');
      expect(tables).toContain('agent_events_v');
    } finally {
      db.close();
    }
  });

  it('bootstrap SQL includes all tables from TABLE_NAMES', () => {
    const bootstrap = getBootstrapSql();
    for (const name of TABLE_NAMES) {
      expect(bootstrap).toContain(name);
    }
  });

  // -----------------------------------------------------------------------
  // TABLE_NAMES completeness
  // -----------------------------------------------------------------------

  it('TABLE_NAMES has no duplicates', () => {
    const set = new Set(TABLE_NAMES);
    expect(set.size).toBe(TABLE_NAMES.length);
  });

  it('TABLE_NAMES includes all core tables', () => {
    const expected = [
      'object_index',
      'file_index',
      'links',
      'link_evidence',
      'events',
      'object_search_fts',
      'object_chunks_fts',
      'agent_items_v',
      'agent_links_v',
      'agent_events_v',
    ];
    for (const name of expected) {
      expect(TABLE_NAMES).toContain(name);
    }
  });

  it('TABLE_NAMES includes all domain type tables', () => {
    const typeTableNames = typeTables.map((t) => t.tableName);
    for (const name of typeTableNames) {
      expect(TABLE_NAMES).toContain(name);
    }
  });

  // -----------------------------------------------------------------------
  // Core table structure checks
  // -----------------------------------------------------------------------

  it('object_index table has required columns', () => {
    expect(objectIndexTable.createTableSql).toContain('object_uid');
    expect(objectIndexTable.createTableSql).toContain('object_type');
    expect(objectIndexTable.createTableSql).toContain('canonical_table');
    expect(objectIndexTable.createTableSql).toContain('layer');
    expect(objectIndexTable.createTableSql).toContain('version_token');
    expect(objectIndexTable.createTableSql).toContain('deleted_flg');
    expect(objectIndexTable.createTableSql).toContain('UNIQUE(object_type, object_id)');
  });

  it('links table has merged columns from doc 09 and doc 12', () => {
    expect(linksTable.createTableSql).toContain('source_uid');
    expect(linksTable.createTableSql).toContain('target_uid');
    expect(linksTable.createTableSql).toContain('relation_type');
    expect(linksTable.createTableSql).toContain('origin');
    expect(linksTable.createTableSql).toContain('source_channel');
    expect(linksTable.createTableSql).toContain('status');
    expect(linksTable.createTableSql).toContain('confidence');
    expect(linksTable.createTableSql).toContain('why_summary');
    expect(linksTable.createTableSql).toContain('weight');
    expect(linksTable.createTableSql).toContain('deleted_flg');
  });

  it('events table has event sourcing columns', () => {
    expect(eventsTable.createTableSql).toContain('stream_uid');
    expect(eventsTable.createTableSql).toContain('event_type');
    expect(eventsTable.createTableSql).toContain('actor_type');
    expect(eventsTable.createTableSql).toContain('causation_id');
    expect(eventsTable.createTableSql).toContain('correlation_id');
    expect(eventsTable.createTableSql).toContain('payload_json');
  });

  // -----------------------------------------------------------------------
  // FTS tables
  // -----------------------------------------------------------------------

  it('FTS tables use fts5', () => {
    for (const fts of ftsTables) {
      expect(fts.createTableSql).toContain('fts5');
      expect(fts.createTableSql).toContain('unicode61');
    }
  });

  // -----------------------------------------------------------------------
  // Migration framework
  // -----------------------------------------------------------------------

  it('schema_migrations table can be created', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(SCHEMA_MIGRATIONS_SQL);
      db.exec("INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, 'test', '2025-01-01');");
      const rows = db.prepare('SELECT * FROM schema_migrations').all() as Array<{
        version: number;
        name: string;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]!.name).toBe('test');
    } finally {
      db.close();
    }
  });

  // -----------------------------------------------------------------------
  // Full roundtrip: bootstrap + insert data
  // -----------------------------------------------------------------------

  it('can insert and query data after bootstrap', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(getBootstrapSql());

      // Insert into object_index
      db.exec(`INSERT INTO object_index
        (object_uid, object_type, object_id, canonical_table, layer, origin, visibility, version_token, created_at, updated_at)
        VALUES ('task:tsk_001', 'task', 'tsk_001', 'tasks', 'source', 'human', 'private', 'v1', '2025-01-01', '2025-01-01');`);

      // Insert into tasks type table
      db.exec(`INSERT INTO tasks
        (id, title, status, created_at, updated_at)
        VALUES ('tsk_001', 'Test task', 'todo', '2025-01-01', '2025-01-01');`);

      // Query via agent view
      const items = db.prepare('SELECT * FROM agent_items_v WHERE object_type = ?').all('task') as Array<{
        object_uid: string;
        title: unknown;
      }>;
      expect(items).toHaveLength(1);
      expect(items[0]!.object_uid).toBe('task:tsk_001');
    } finally {
      db.close();
    }
  });
});
