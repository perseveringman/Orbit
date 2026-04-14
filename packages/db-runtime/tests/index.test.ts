import { describe, it, expect } from 'vitest';
import {
  camelToSnake,
  snakeToCamel,
  keysToSnake,
  keysToCamel,
  getTableForType,
  TYPE_TO_TABLE,
  TABLE_TO_TYPE,
} from '../src/helpers.js';
import { bootstrapDatabase, runMigrations, initializeDatabase } from '../src/bootstrap.js';
import { SqliteObjectRepository } from '../src/object-repository.js';
import { SqliteLinkRepository } from '../src/link-repository.js';
import { SqliteEventRepository } from '../src/event-repository.js';
import { SqliteSearchRepository } from '../src/search-repository.js';
import { SqliteWriteTransaction } from '../src/write-transaction.js';
import { createRepositories } from '../src/create-repositories.js';
import { createCursor, parseCursor } from '@orbit/data-protocol';
import type { DatabasePort, SqlRow, SqlRunResult } from '@orbit/platform-contracts';

// ---------------------------------------------------------------------------
// Mock DatabasePort that records calls for assertion
// ---------------------------------------------------------------------------

interface CallRecord {
  method: 'query' | 'run' | 'exec' | 'transaction';
  sql?: string;
  params?: unknown[];
}

function createMockDatabasePort(overrides?: {
  queryResults?: Map<string, SqlRow[]>;
  execErrors?: Map<string, Error>;
}): DatabasePort & { calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const queryResults = overrides?.queryResults ?? new Map<string, SqlRow[]>();
  const execErrors = overrides?.execErrors ?? new Map<string, Error>();

  return {
    calls,
    async connect() {
      return { driver: 'mock', connectedAt: new Date().toISOString() };
    },
    async close() {},
    query<T extends SqlRow = SqlRow>(sql: string, params?: unknown[]): T[] {
      calls.push({ method: 'query', sql, params });
      // Check for matching result
      for (const [pattern, rows] of queryResults) {
        if (sql.includes(pattern)) return rows as T[];
      }
      return [] as T[];
    },
    run(sql: string, params?: unknown[]): SqlRunResult {
      calls.push({ method: 'run', sql, params });
      return { changes: 1, lastInsertRowid: 0 };
    },
    exec(sql: string): void {
      calls.push({ method: 'exec', sql });
      for (const [pattern, error] of execErrors) {
        if (sql.includes(pattern)) throw error;
      }
    },
    transaction<T>(fn: () => T): T {
      calls.push({ method: 'transaction' });
      return fn();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: Helpers
// ---------------------------------------------------------------------------

describe('helpers', () => {
  describe('camelToSnake', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('objectUid')).toBe('object_uid');
      expect(camelToSnake('createdAt')).toBe('created_at');
      expect(camelToSnake('id')).toBe('id');
      expect(camelToSnake('payloadJson')).toBe('payload_json');
      expect(camelToSnake('whySummary')).toBe('why_summary');
    });
  });

  describe('snakeToCamel', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('object_uid')).toBe('objectUid');
      expect(snakeToCamel('created_at')).toBe('createdAt');
      expect(snakeToCamel('id')).toBe('id');
      expect(snakeToCamel('payload_json')).toBe('payloadJson');
      expect(snakeToCamel('deleted_flg')).toBe('deletedFlg');
    });
  });

  describe('keysToSnake', () => {
    it('converts all keys from camelCase to snake_case', () => {
      const result = keysToSnake({
        objectUid: 'task:123',
        createdAt: '2025-01-01',
        deletedFlg: false,
      });
      expect(result).toEqual({
        object_uid: 'task:123',
        created_at: '2025-01-01',
        deleted_flg: false,
      });
    });
  });

  describe('keysToCamel', () => {
    it('converts all keys from snake_case to camelCase', () => {
      const result = keysToCamel({
        object_uid: 'task:123',
        created_at: '2025-01-01',
        deleted_flg: 0,
      });
      expect(result).toEqual({
        objectUid: 'task:123',
        createdAt: '2025-01-01',
        deletedFlg: 0,
      });
    });
  });

  describe('TYPE_TO_TABLE', () => {
    it('maps all core types correctly', () => {
      expect(TYPE_TO_TABLE.task).toBe('tasks');
      expect(TYPE_TO_TABLE.article).toBe('articles');
      expect(TYPE_TO_TABLE.research_space).toBe('research_spaces');
      expect(TYPE_TO_TABLE.journal_summary).toBe('journal_summaries');
      expect(TYPE_TO_TABLE.ai_chat).toBe('ai_chats');
      expect(TYPE_TO_TABLE.vision).toBe('visions');
    });

    it('has reverse mapping', () => {
      expect(TABLE_TO_TYPE.tasks).toBe('task');
      expect(TABLE_TO_TYPE.articles).toBe('article');
      expect(TABLE_TO_TYPE.research_spaces).toBe('research_space');
    });
  });

  describe('getTableForType', () => {
    it('returns the correct table name', () => {
      expect(getTableForType('task')).toBe('tasks');
      expect(getTableForType('note')).toBe('notes');
    });

    it('throws for unknown types', () => {
      expect(() => getTableForType('unknown_type_xyz')).toThrow('Unknown object type');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Bootstrap
// ---------------------------------------------------------------------------

describe('bootstrap', () => {
  describe('bootstrapDatabase', () => {
    it('creates migration table and runs bootstrap DDL', () => {
      const db = createMockDatabasePort();
      bootstrapDatabase(db);

      const execCalls = db.calls.filter((c) => c.method === 'exec');
      expect(execCalls.length).toBeGreaterThanOrEqual(2);
      // First exec should be the migration tracking table
      expect(execCalls[0]!.sql).toContain('schema_migrations');
      // One of the later execs should be the bootstrap DDL
      expect(execCalls.some((call) => call.sql?.includes('PRAGMA'))).toBe(true);

      // Fresh bootstrap should record all known migrations as applied
      const runCalls = db.calls.filter((c) => c.method === 'run');
      expect(runCalls.length).toBe(2);
      expect(runCalls[0]!.sql).toContain('INSERT INTO schema_migrations');
      expect(runCalls[0]!.params).toEqual([1, 'initial_schema']);
      expect(runCalls[1]!.params).toEqual([2, 'add_reading_system_fields']);
    });

    it('skips bootstrap if already initialized', () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          ['SELECT version FROM schema_migrations WHERE version = 1', [{ version: 1 }]],
        ]),
      });

      bootstrapDatabase(db);

      // Should only exec the migration table creation
      const execCalls = db.calls.filter((c) => c.method === 'exec');
      expect(execCalls.length).toBe(1);
      expect(execCalls[0]!.sql).toContain('schema_migrations');
    });

    it('falls back to plain search tables when FTS5 is unavailable', () => {
      const db = createMockDatabasePort({
        execErrors: new Map([
          ['__orbit_fts5_probe', new Error('no such module: fts5')],
        ]),
      });

      bootstrapDatabase(db);

      const execCalls = db.calls.filter((c) => c.method === 'exec');
      const bootstrapCall = execCalls[execCalls.length - 1]!;
      expect(bootstrapCall.sql).toContain('CREATE TABLE IF NOT EXISTS object_search_fts');
      expect(bootstrapCall.sql).toContain('CREATE TABLE IF NOT EXISTS object_chunks_fts');
      expect(bootstrapCall.sql).not.toContain('CREATE VIRTUAL TABLE IF NOT EXISTS object_search_fts USING fts5');
    });
  });

  describe('runMigrations', () => {
    it('runs pending migrations', () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          ['SELECT version FROM schema_migrations ORDER BY version', [{ version: 1 }]],
        ]),
      });

      const count = runMigrations(db);

      // Should have run migration v2 (add_reading_system_fields)
      expect(count).toBe(1);
      const transactionCalls = db.calls.filter((c) => c.method === 'transaction');
      expect(transactionCalls.length).toBe(1);
    });

    it('returns 0 when all migrations applied', () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          [
            'SELECT version FROM schema_migrations ORDER BY version',
            [{ version: 1 }, { version: 2 }],
          ],
        ]),
      });

      const count = runMigrations(db);
      expect(count).toBe(0);
    });

    it('marks migration applied when schema already has the migrated columns', () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          ['SELECT version FROM schema_migrations ORDER BY version', [{ version: 1 }]],
          ['PRAGMA table_info(content_items)', [{ name: 'origin' }, { name: 'processing_depth' }]],
          [
            'PRAGMA table_info(articles)',
            [
              { name: 'origin' },
              { name: 'proposed_link_count' },
              { name: 'active_link_count' },
              { name: 'source_endpoint_quality' },
            ],
          ],
          [
            'PRAGMA table_info(source_endpoints)',
            [
              { name: 'quality_score' },
              { name: 'total_items' },
              { name: 'confirmed_items' },
              { name: 'consecutive_errors' },
              { name: 'last_error_at' },
            ],
          ],
        ]),
      });

      const count = runMigrations(db);

      expect(count).toBe(1);
      const execCalls = db.calls.filter((c) => c.method === 'exec');
      expect(execCalls.some((call) => call.sql?.includes('ALTER TABLE articles ADD COLUMN origin'))).toBe(false);
      const runCalls = db.calls.filter((c) => c.method === 'run');
      expect(runCalls[0]!.params).toEqual([2, 'add_reading_system_fields']);
    });
  });

  describe('initializeDatabase', () => {
    it('reports fresh database correctly', () => {
      const db = createMockDatabasePort();

      const result = initializeDatabase(db);

      expect(result.bootstrapped).toBe(true);
    });

    it('reports existing database correctly', () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          ['SELECT name FROM sqlite_master', [{ name: 'schema_migrations' }]],
          ['SELECT version FROM schema_migrations WHERE version = 1', [{ version: 1 }]],
          ['SELECT version FROM schema_migrations ORDER BY version', [{ version: 1 }, { version: 2 }]],
        ]),
      });

      const result = initializeDatabase(db);

      expect(result.bootstrapped).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: ObjectRepository
// ---------------------------------------------------------------------------

describe('SqliteObjectRepository', () => {
  describe('query', () => {
    it('builds correct SQL for type filter', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteObjectRepository(db);

      await repo.query({ objectType: 'task' });

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      // First call is the main query, second is the count
      expect(queryCalls.length).toBe(2);
      expect(queryCalls[0]!.sql).toContain('object_type = ?');
      expect(queryCalls[0]!.params).toContain('task');
    });

    it('builds correct SQL for multiple filters', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteObjectRepository(db);

      await repo.query({
        objectType: 'note',
        status: 'active',
        origin: 'human',
        layer: 'wiki',
      });

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      const sql = queryCalls[0]!.sql!;
      expect(sql).toContain('object_type = ?');
      expect(sql).toContain('status = ?');
      expect(sql).toContain('origin = ?');
      expect(sql).toContain('layer = ?');
    });

    it('handles cursor-based pagination', async () => {
      const cursor = createCursor('2025-01-01T00:00:00Z', 'task:abc123');
      const db = createMockDatabasePort();
      const repo = new SqliteObjectRepository(db);

      await repo.query({ cursor });

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      const sql = queryCalls[0]!.sql!;
      expect(sql).toContain('updated_at < ?');
      expect(sql).toContain('object_uid < ?');
    });

    it('applies default limit of 50', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteObjectRepository(db);

      await repo.query({});

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      // Limit is 50 + 1 (for hasMore detection)
      expect(queryCalls[0]!.params).toContain(51);
    });
  });

  describe('read', () => {
    it('queries by object_uid', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteObjectRepository(db);

      const result = await repo.read('task:abc' as any);

      expect(result).toBeNull();
      const queryCalls = db.calls.filter((c) => c.method === 'query');
      expect(queryCalls[0]!.sql).toContain('WHERE object_uid = ?');
      expect(queryCalls[0]!.params).toEqual(['task:abc']);
    });
  });

  describe('write', () => {
    it('inserts into type table and object_index', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteObjectRepository(db);

      const result = await repo.write('task', {
        title: 'My Task',
        status: 'active',
      });

      expect(result.objectType).toBe('task');
      expect(result.title).toBe('My Task');
      expect(result.canonicalTable).toBe('tasks');
      expect(result.deletedFlg).toBe(false);
      expect(result.objectUid).toMatch(/^task:/);

      const runCalls = db.calls.filter((c) => c.method === 'run');
      // 3 runs: type table insert, object_index insert, FTS insert
      expect(runCalls.length).toBe(3);
      expect(runCalls[0]!.sql).toContain('INSERT OR REPLACE INTO tasks');
      expect(runCalls[1]!.sql).toContain('INSERT OR REPLACE INTO object_index');
      expect(runCalls[2]!.sql).toContain('INSERT OR REPLACE INTO object_search_fts');
    });
  });

  describe('delete', () => {
    it('soft-deletes in type table and object_index', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteObjectRepository(db);

      await repo.delete('task:abc123' as any);

      const runCalls = db.calls.filter((c) => c.method === 'run');
      expect(runCalls.length).toBe(2);
      expect(runCalls[0]!.sql).toContain('UPDATE tasks SET deleted_flg = 1');
      expect(runCalls[1]!.sql).toContain('UPDATE object_index SET deleted_flg = 1');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: LinkRepository
// ---------------------------------------------------------------------------

describe('SqliteLinkRepository', () => {
  describe('write', () => {
    it('maps WriteLinkInput fields to snake_case columns', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteLinkRepository(db);

      const result = await repo.write({
        sourceUid: 'task:1' as any,
        targetUid: 'note:2' as any,
        relationType: 'references',
        origin: 'human',
        sourceChannel: 'manual',
        confidence: 0.9,
        whySummary: 'User linked it',
      });

      expect(result.relationType).toBe('references');
      expect(result.sourceChannel).toBe('manual');
      expect(result.confidence).toBe(0.9);
      expect(result.status).toBe('active');

      const runCalls = db.calls.filter((c) => c.method === 'run');
      expect(runCalls[0]!.sql).toContain('INSERT OR REPLACE INTO links');
      expect(runCalls[0]!.sql).toContain('source_uid');
      expect(runCalls[0]!.sql).toContain('target_uid');
      expect(runCalls[0]!.sql).toContain('relation_type');
      expect(runCalls[0]!.sql).toContain('source_channel');
      expect(runCalls[0]!.sql).toContain('why_summary');
    });
  });

  describe('list', () => {
    it('builds correct SQL with filters', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteLinkRepository(db);

      await repo.list({ relationType: 'references', origin: 'ai', status: 'active' });

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      const sql = queryCalls[0]!.sql!;
      expect(sql).toContain('relation_type = ?');
      expect(sql).toContain('origin = ?');
      expect(sql).toContain('status = ?');
      expect(sql).toContain('deleted_flg = 0');
    });
  });

  describe('backlinks', () => {
    it('filters by target_uid', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteLinkRepository(db);

      await repo.backlinks('note:123' as any);

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      const sql = queryCalls[0]!.sql!;
      expect(sql).toContain('target_uid = ?');
      expect(queryCalls[0]!.params![0]).toBe('note:123');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: EventRepository
// ---------------------------------------------------------------------------

describe('SqliteEventRepository', () => {
  describe('append', () => {
    it('inserts an event with generated ID', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteEventRepository(db);

      const result = await repo.append({
        eventType: 'task.created',
        actorType: 'user',
        payloadJson: '{"title":"test"}',
        streamUid: 'task:abc' as any,
      });

      expect(result.eventType).toBe('task.created');
      expect(result.actorType).toBe('user');
      expect(result.streamUid).toBe('task:abc');
      expect(result.eventId).toBeTruthy();

      const runCalls = db.calls.filter((c) => c.method === 'run');
      expect(runCalls[0]!.sql).toContain('INSERT INTO events');
    });
  });

  describe('listByStream', () => {
    it('queries by stream_uid', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteEventRepository(db);

      await repo.listByStream('task:abc' as any);

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      expect(queryCalls[0]!.sql).toContain('stream_uid = ?');
      expect(queryCalls[0]!.sql).toContain('ORDER BY occurred_at ASC');
    });
  });

  describe('replay', () => {
    it('uses cursor for position', async () => {
      const cursor = createCursor('2025-01-01T00:00:00Z', 'evt_123');
      const db = createMockDatabasePort();
      const repo = new SqliteEventRepository(db);

      await repo.replay(cursor, 10);

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      expect(queryCalls[0]!.sql).toContain('occurred_at > ?');
      expect(queryCalls[0]!.sql).toContain('event_id > ?');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: SearchRepository
// ---------------------------------------------------------------------------

describe('SqliteSearchRepository', () => {
  describe('query', () => {
    it('uses FTS5 MATCH syntax', async () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          ['SELECT sql FROM sqlite_master', [{ sql: 'CREATE VIRTUAL TABLE object_search_fts USING fts5(title, summary, keywords)' }]],
        ]),
      });
      const repo = new SqliteSearchRepository(db);

      await repo.query('hello world');

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      expect(queryCalls[1]!.sql).toContain('object_search_fts MATCH ?');
      expect(queryCalls[1]!.params![0]).toBe('hello world');
    });

    it('applies scope filters', async () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          ['SELECT sql FROM sqlite_master', [{ sql: 'CREATE VIRTUAL TABLE object_search_fts USING fts5(title, summary, keywords)' }]],
        ]),
      });
      const repo = new SqliteSearchRepository(db);

      await repo.query('test', {
        objectTypes: ['task', 'note'],
        layers: ['wiki'],
        updatedSince: '2025-01-01',
      });

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      const sql = queryCalls[1]!.sql!;
      expect(sql).toContain('oi.object_type IN');
      expect(sql).toContain('oi.layer IN');
      expect(sql).toContain('oi.updated_at >');
    });

    it('falls back to LIKE queries when FTS5 is unavailable', async () => {
      const db = createMockDatabasePort({
        queryResults: new Map([
          ['SELECT sql FROM sqlite_master', [{ sql: 'CREATE TABLE object_search_fts (object_uid TEXT PRIMARY KEY, title TEXT, summary TEXT, keywords TEXT)' }]],
        ]),
      });
      const repo = new SqliteSearchRepository(db);

      await repo.query('hello world');

      const queryCalls = db.calls.filter((c) => c.method === 'query');
      expect(queryCalls[1]!.sql).toContain('fts.title LIKE ?');
      expect(queryCalls[1]!.sql).toContain('ORDER BY oi.updated_at DESC');
      expect(queryCalls[1]!.params!.slice(0, 3)).toEqual([
        '%hello world%',
        '%hello world%',
        '%hello world%',
      ]);
    });

    it('returns empty for blank text', async () => {
      const db = createMockDatabasePort();
      const repo = new SqliteSearchRepository(db);

      const results = await repo.query('  ');
      expect(results).toEqual([]);
      expect(db.calls.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: WriteTransaction
// ---------------------------------------------------------------------------

describe('SqliteWriteTransaction', () => {
  it('executes all steps in order within a transaction', async () => {
    const db = createMockDatabasePort();
    const tx = new SqliteWriteTransaction(db);

    const result = await tx
      .writeObject('task', { title: 'My Task', status: 'active' })
      .syncIndex()
      .writeLinks([
        {
          sourceUid: 'task:placeholder' as any,
          targetUid: 'note:1' as any,
          relationType: 'references',
          origin: 'human',
        },
      ])
      .appendEvents([
        {
          eventType: 'task.created',
          actorType: 'user',
          payloadJson: '{}',
        },
      ])
      .execute();

    expect(result.objectUid).toMatch(/^task:/);
    expect(result.versionToken).toBeTruthy();
    expect(result.linksCreated).toBe(1);
    expect(result.eventsAppended).toBe(1);

    // Verify transaction was used
    const transactionCalls = db.calls.filter((c) => c.method === 'transaction');
    expect(transactionCalls.length).toBe(1);
  });

  it('throws if execute called without writeObject', async () => {
    const db = createMockDatabasePort();
    const tx = new SqliteWriteTransaction(db);

    await expect(tx.execute()).rejects.toThrow('writeObject() must be called');
  });
});

// ---------------------------------------------------------------------------
// Tests: createRepositories
// ---------------------------------------------------------------------------

describe('createRepositories', () => {
  it('creates all repository instances', () => {
    const db = createMockDatabasePort();
    const repos = createRepositories(db);

    expect(repos.objects).toBeInstanceOf(SqliteObjectRepository);
    expect(repos.links).toBeInstanceOf(SqliteLinkRepository);
    expect(repos.events).toBeInstanceOf(SqliteEventRepository);
    expect(repos.search).toBeInstanceOf(SqliteSearchRepository);
    expect(repos.writeTransactions).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: Cursor integration
// ---------------------------------------------------------------------------

describe('cursor utilities', () => {
  it('createCursor + parseCursor roundtrip', () => {
    const cursor = createCursor('2025-06-01T12:00:00Z', 'task:abc123');
    const parsed = parseCursor(cursor);
    expect(parsed).toEqual({
      updatedAt: '2025-06-01T12:00:00Z',
      id: 'task:abc123',
    });
  });
});
