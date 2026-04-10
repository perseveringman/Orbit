// Types
export type { SqliteColumnType, SqliteColumnDef, SqliteIndexDef, SqliteTableDef, TableModule } from './types.js';

// Helpers
export { renderCreateTableSql, renderCreateIndexSql, tableFromDef } from './helpers.js';

// Core tables
export { objectIndexTable } from './tables/object-index.js';
export { linksTable } from './tables/links.js';
export { eventsTable } from './tables/events.js';
export { objectSearchFtsTable, objectChunksFtsTable, ftsTables } from './tables/fts.js';
export { linkEvidenceTable } from './tables/link-evidence.js';
export { fileIndexTable } from './tables/file-index.js';

// Domain type tables
export { typeTables } from './tables/type-tables.js';

// Agent views
export {
  agentItemsView,
  agentLinksView,
  agentEventsView,
  agentViews,
  AGENT_ITEMS_VIEW_NAME,
  AGENT_LINKS_VIEW_NAME,
  AGENT_EVENTS_VIEW_NAME,
} from './tables/agent-views.js';

// Schema orchestrator
export {
  TABLE_NAMES,
  getAllCreateTableStatements,
  getAllCreateIndexStatements,
  getBootstrapSql,
} from './schema.js';

// Migrations
export {
  SCHEMA_MIGRATIONS_SQL,
  migrations,
  getMigrationSql,
} from './migrations.js';
export type { Migration } from './migrations.js';
