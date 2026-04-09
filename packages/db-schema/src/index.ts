export const ORBIT_SQLITE_TABLES = {
  workspaces: 'workspaces',
  devices: 'devices',
  feeds: 'feeds',
  articles: 'articles',
  highlights: 'highlights',
  tags: 'tags',
  articleTags: 'article_tags',
  syncCheckpoints: 'sync_checkpoints',
  blobs: 'blobs',
} as const;

export type SqliteColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

export interface SqliteColumnDef {
  readonly name: string;
  readonly type: SqliteColumnType;
  readonly notNull?: boolean;
  readonly primaryKey?: boolean;
  readonly defaultValue?: string;
}

export interface SqliteIndexDef {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique?: boolean;
}

export interface SqliteTableDef {
  readonly name: string;
  readonly columns: readonly SqliteColumnDef[];
  readonly indexes?: readonly SqliteIndexDef[];
}

export const orbitSqliteSchema: readonly SqliteTableDef[] = [
  {
    name: ORBIT_SQLITE_TABLES.workspaces,
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'slug', type: 'TEXT', notNull: true },
      { name: 'owner_user_id', type: 'TEXT', notNull: true },
      { name: 'created_at', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'TEXT', notNull: true },
    ],
    indexes: [{ name: 'idx_workspaces_slug', columns: ['slug'], unique: true }],
  },
  {
    name: ORBIT_SQLITE_TABLES.devices,
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'workspace_id', type: 'TEXT', notNull: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'platform', type: 'TEXT', notNull: true },
      { name: 'last_seen_at', type: 'TEXT' },
    ],
    indexes: [{ name: 'idx_devices_workspace', columns: ['workspace_id'] }],
  },
  {
    name: ORBIT_SQLITE_TABLES.feeds,
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'workspace_id', type: 'TEXT', notNull: true },
      { name: 'title', type: 'TEXT', notNull: true },
      { name: 'site_url', type: 'TEXT', notNull: true },
      { name: 'feed_url', type: 'TEXT', notNull: true },
      { name: 'created_at', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'TEXT', notNull: true },
    ],
    indexes: [{ name: 'idx_feeds_workspace', columns: ['workspace_id'] }],
  },
  {
    name: ORBIT_SQLITE_TABLES.articles,
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'workspace_id', type: 'TEXT', notNull: true },
      { name: 'feed_id', type: 'TEXT', notNull: true },
      { name: 'title', type: 'TEXT', notNull: true },
      { name: 'source_url', type: 'TEXT', notNull: true },
      { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'unread'" },
      { name: 'published_at', type: 'TEXT' },
      { name: 'created_at', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'TEXT', notNull: true },
      { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
    ],
    indexes: [
      { name: 'idx_articles_workspace_status', columns: ['workspace_id', 'status'] },
      { name: 'idx_articles_feed', columns: ['feed_id'] },
    ],
  },
  {
    name: ORBIT_SQLITE_TABLES.highlights,
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'workspace_id', type: 'TEXT', notNull: true },
      { name: 'article_id', type: 'TEXT', notNull: true },
      { name: 'quote', type: 'TEXT', notNull: true },
      { name: 'color', type: 'TEXT', notNull: true },
      { name: 'note', type: 'TEXT' },
      { name: 'created_at', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'TEXT', notNull: true },
    ],
    indexes: [{ name: 'idx_highlights_article', columns: ['article_id'] }],
  },
  {
    name: ORBIT_SQLITE_TABLES.tags,
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'workspace_id', type: 'TEXT', notNull: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'color', type: 'TEXT' },
      { name: 'created_at', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'TEXT', notNull: true },
    ],
    indexes: [{ name: 'idx_tags_workspace_name', columns: ['workspace_id', 'name'], unique: true }],
  },
  {
    name: ORBIT_SQLITE_TABLES.articleTags,
    columns: [
      { name: 'article_id', type: 'TEXT', primaryKey: true },
      { name: 'tag_id', type: 'TEXT', primaryKey: true },
      { name: 'created_at', type: 'TEXT', notNull: true },
    ],
    indexes: [{ name: 'idx_article_tags_tag', columns: ['tag_id'] }],
  },
  {
    name: ORBIT_SQLITE_TABLES.syncCheckpoints,
    columns: [
      { name: 'workspace_id', type: 'TEXT', primaryKey: true },
      { name: 'device_id', type: 'TEXT', notNull: true },
      { name: 'cursor', type: 'TEXT' },
      { name: 'server_time', type: 'TEXT', notNull: true },
      { name: 'updated_at', type: 'TEXT', notNull: true },
    ],
    indexes: [{ name: 'idx_sync_checkpoints_device', columns: ['device_id'] }],
  },
  {
    name: ORBIT_SQLITE_TABLES.blobs,
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'workspace_id', type: 'TEXT', notNull: true },
      { name: 'sha256', type: 'TEXT', notNull: true },
      { name: 'mime_type', type: 'TEXT', notNull: true },
      { name: 'byte_length', type: 'INTEGER', notNull: true },
      { name: 'created_at', type: 'TEXT', notNull: true },
    ],
    indexes: [{ name: 'idx_blobs_workspace', columns: ['workspace_id'] }],
  },
];

export function renderCreateTableSql(table: SqliteTableDef): string {
  const columnSql = table.columns
    .map((column) => {
      const fragments = [column.name, column.type];

      if (column.primaryKey) {
        fragments.push('PRIMARY KEY');
      }

      if (column.notNull) {
        fragments.push('NOT NULL');
      }

      if (column.defaultValue !== undefined) {
        fragments.push(`DEFAULT ${column.defaultValue}`);
      }

      return fragments.join(' ');
    })
    .join(', ');

  return `CREATE TABLE IF NOT EXISTS ${table.name} (${columnSql});`;
}

export function renderCreateIndexSql(tableName: string, index: SqliteIndexDef): string {
  const unique = index.unique ? 'UNIQUE ' : '';
  return `CREATE ${unique}INDEX IF NOT EXISTS ${index.name} ON ${tableName} (${index.columns.join(', ')});`;
}

export const orbitSqliteBootstrapSql = orbitSqliteSchema.flatMap((table) => [
  renderCreateTableSql(table),
  ...(table.indexes ?? []).map((index) => renderCreateIndexSql(table.name, index)),
]);
