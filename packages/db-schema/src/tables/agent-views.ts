import type { TableModule } from '../types.js';

// Agent views project core tables into simplified read-only abstractions

export const AGENT_ITEMS_VIEW_NAME = 'agent_items_v';
export const AGENT_LINKS_VIEW_NAME = 'agent_links_v';
export const AGENT_EVENTS_VIEW_NAME = 'agent_events_v';

export const agentItemsView: TableModule = {
  tableName: AGENT_ITEMS_VIEW_NAME,

  createTableSql: `CREATE VIEW IF NOT EXISTS agent_items_v AS
SELECT
  object_uid,
  object_type,
  object_id,
  title,
  summary,
  status,
  layer,
  origin,
  created_at,
  updated_at
FROM object_index
WHERE deleted_flg = 0;`,

  createIndexSqls: [],
};

export const agentLinksView: TableModule = {
  tableName: AGENT_LINKS_VIEW_NAME,

  createTableSql: `CREATE VIEW IF NOT EXISTS agent_links_v AS
SELECT
  link_id,
  source_uid,
  target_uid,
  relation_type,
  origin,
  status,
  confidence,
  why_summary,
  created_at
FROM links
WHERE deleted_flg = 0;`,

  createIndexSqls: [],
};

export const agentEventsView: TableModule = {
  tableName: AGENT_EVENTS_VIEW_NAME,

  createTableSql: `CREATE VIEW IF NOT EXISTS agent_events_v AS
SELECT
  event_id,
  stream_uid,
  event_type,
  actor_type,
  actor_id,
  payload_json,
  occurred_at
FROM events;`,

  createIndexSqls: [],
};

export const agentViews: readonly TableModule[] = [agentItemsView, agentLinksView, agentEventsView];
