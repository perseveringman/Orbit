import type { TableModule } from './types.js';
import { objectIndexTable } from './tables/object-index.js';
import { fileIndexTable } from './tables/file-index.js';
import { linksTable } from './tables/links.js';
import { linkEvidenceTable } from './tables/link-evidence.js';
import { eventsTable } from './tables/events.js';
import { ftsTables } from './tables/fts.js';
import { typeTables } from './tables/type-tables.js';
import { agentViews } from './tables/agent-views.js';

// ---------------------------------------------------------------------------
// Dependency-ordered table registry
// Core infrastructure tables come first (object_index, file_index),
// then relation tables (links, link_evidence), events, type tables,
// FTS virtual tables, and finally views.
// ---------------------------------------------------------------------------

const coreTables: readonly TableModule[] = [
  objectIndexTable,
  fileIndexTable,
  linksTable,
  linkEvidenceTable,
  eventsTable,
];

const allTableModules: readonly TableModule[] = [
  ...coreTables,
  ...typeTables,
  ...ftsTables,
  ...agentViews,
];

/** All table (and view) names in dependency order. */
export const TABLE_NAMES = allTableModules.map((m) => m.tableName) as readonly string[];

/** Returns all CREATE TABLE / CREATE VIRTUAL TABLE / CREATE VIEW statements in dependency order. */
export function getAllCreateTableStatements(): readonly string[] {
  return allTableModules.map((m) => m.createTableSql);
}

/** Returns all CREATE INDEX statements. */
export function getAllCreateIndexStatements(): readonly string[] {
  return allTableModules.flatMap((m) => m.createIndexSqls);
}

/** Returns the complete DDL for bootstrapping a fresh database. */
export function getBootstrapSql(): string {
  const statements: string[] = [];

  // PRAGMA settings for performance
  statements.push('PRAGMA journal_mode = WAL;');
  statements.push('PRAGMA foreign_keys = ON;');

  // Tables, views, and indexes in dependency order
  for (const mod of allTableModules) {
    statements.push(mod.createTableSql);
    for (const idx of mod.createIndexSqls) {
      statements.push(idx);
    }
  }

  return statements.join('\n');
}
