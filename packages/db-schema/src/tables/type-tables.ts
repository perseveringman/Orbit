import type { SqliteTableDef, TableModule } from '../types.js';
import { tableFromDef } from '../helpers.js';

// ---------------------------------------------------------------------------
// Direction family
// ---------------------------------------------------------------------------

const visionsDef: SqliteTableDef = {
  name: 'visions',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'statement', type: 'TEXT' },
    { name: 'time_horizon', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_visions_status', columns: ['status'] },
  ],
};

const directionsDef: SqliteTableDef = {
  name: 'directions',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'vision_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'priority', type: 'INTEGER' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_directions_vision', columns: ['vision_id'] },
    { name: 'idx_directions_status', columns: ['status'] },
  ],
};

const themesDef: SqliteTableDef = {
  name: 'themes',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'time_range_start', type: 'TEXT' },
    { name: 'time_range_end', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_themes_status', columns: ['status'] },
  ],
};

const goalsDef: SqliteTableDef = {
  name: 'goals',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'direction_id', type: 'TEXT' },
    { name: 'theme_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'measure', type: 'TEXT' },
    { name: 'target_value', type: 'TEXT' },
    { name: 'current_value', type: 'TEXT' },
    { name: 'deadline', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_goals_direction', columns: ['direction_id'] },
    { name: 'idx_goals_theme', columns: ['theme_id'] },
    { name: 'idx_goals_status', columns: ['status'] },
  ],
};

const commitmentsDef: SqliteTableDef = {
  name: 'commitments',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'goal_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'cadence', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_commitments_goal', columns: ['goal_id'] },
    { name: 'idx_commitments_status', columns: ['status'] },
  ],
};

const reviewsDef: SqliteTableDef = {
  name: 'reviews',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'review_type', type: 'TEXT' },
    { name: 'period_start', type: 'TEXT' },
    { name: 'period_end', type: 'TEXT' },
    { name: 'body', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'draft'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_reviews_type', columns: ['review_type'] },
    { name: 'idx_reviews_status', columns: ['status'] },
  ],
};

// ---------------------------------------------------------------------------
// Execution family
// ---------------------------------------------------------------------------

const projectsDef: SqliteTableDef = {
  name: 'projects',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'priority', type: 'INTEGER' },
    { name: 'start_date', type: 'TEXT' },
    { name: 'target_date', type: 'TEXT' },
    { name: 'completed_at', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_projects_status', columns: ['status'] },
  ],
};

const milestonesDef: SqliteTableDef = {
  name: 'milestones',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'project_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'target_date', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'pending'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_milestones_project', columns: ['project_id'] },
    { name: 'idx_milestones_status', columns: ['status'] },
  ],
};

const tasksDef: SqliteTableDef = {
  name: 'tasks',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'project_id', type: 'TEXT' },
    { name: 'milestone_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'todo'" },
    { name: 'priority', type: 'INTEGER' },
    { name: 'due_date', type: 'TEXT' },
    { name: 'completed_at', type: 'TEXT' },
    { name: 'assignee', type: 'TEXT' },
    { name: 'today_on', type: 'TEXT' },
    { name: 'focus_rank', type: 'INTEGER' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_tasks_project', columns: ['project_id'] },
    { name: 'idx_tasks_milestone', columns: ['milestone_id'] },
    { name: 'idx_tasks_status', columns: ['status'] },
    { name: 'idx_tasks_today_on', columns: ['today_on'] },
    { name: 'idx_tasks_focus_rank', columns: ['focus_rank'] },
  ],
};

const directivesDef: SqliteTableDef = {
  name: 'directives',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'source_type', type: 'TEXT' },
    { name: 'source_id', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_directives_status', columns: ['status'] },
  ],
};

// ---------------------------------------------------------------------------
// Input family
// ---------------------------------------------------------------------------

const articlesDef: SqliteTableDef = {
  name: 'articles',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'source_url', type: 'TEXT' },
    { name: 'author', type: 'TEXT' },
    { name: 'published_at', type: 'TEXT' },
    { name: 'summary', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'unread'" },
    { name: 'content_path', type: 'TEXT' },
    { name: 'feed_id', type: 'TEXT' },
    { name: 'origin', type: 'TEXT', notNull: true, defaultValue: "'feed_auto'" },
    { name: 'proposed_link_count', type: 'INTEGER', notNull: true, defaultValue: '0' },
    { name: 'active_link_count', type: 'INTEGER', notNull: true, defaultValue: '0' },
    { name: 'source_endpoint_quality', type: 'REAL', notNull: true, defaultValue: '0.0' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_articles_status', columns: ['status'] },
    { name: 'idx_articles_feed', columns: ['feed_id'] },
  ],
};

const booksDef: SqliteTableDef = {
  name: 'books',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'author', type: 'TEXT' },
    { name: 'isbn', type: 'TEXT' },
    { name: 'publisher', type: 'TEXT' },
    { name: 'summary', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'unread'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_books_status', columns: ['status'] },
  ],
};

const highlightsDef: SqliteTableDef = {
  name: 'highlights',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'source_uid', type: 'TEXT' },
    { name: 'quote', type: 'TEXT', notNull: true },
    { name: 'note', type: 'TEXT' },
    { name: 'color', type: 'TEXT' },
    { name: 'location', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_highlights_source', columns: ['source_uid'] },
  ],
};

const notesDef: SqliteTableDef = {
  name: 'notes',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT' },
    { name: 'body', type: 'TEXT' },
    { name: 'note_type', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_notes_type', columns: ['note_type'] },
  ],
};

const assetsDef: SqliteTableDef = {
  name: 'assets',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT' },
    { name: 'mime_type', type: 'TEXT' },
    { name: 'file_path', type: 'TEXT' },
    { name: 'size', type: 'INTEGER' },
    { name: 'description', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_assets_mime_type', columns: ['mime_type'] },
  ],
};

const sourceEndpointsDef: SqliteTableDef = {
  name: 'source_endpoints',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'endpoint_type', type: 'TEXT', notNull: true },
    { name: 'url', type: 'TEXT' },
    { name: 'auth_config_json', type: 'TEXT' },
    { name: 'sync_status', type: 'TEXT', notNull: true, defaultValue: "'idle'" },
    { name: 'last_synced_at', type: 'TEXT' },
    { name: 'quality_score', type: 'REAL', notNull: true, defaultValue: '0.5' },
    { name: 'total_items', type: 'INTEGER', notNull: true, defaultValue: '0' },
    { name: 'confirmed_items', type: 'INTEGER', notNull: true, defaultValue: '0' },
    { name: 'consecutive_errors', type: 'INTEGER', notNull: true, defaultValue: '0' },
    { name: 'last_error_at', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_source_endpoints_type', columns: ['endpoint_type'] },
  ],
};

const contentItemsDef: SqliteTableDef = {
  name: 'content_items',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'source_endpoint_id', type: 'TEXT' },
    { name: 'external_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT' },
    { name: 'content_type', type: 'TEXT' },
    { name: 'raw_json', type: 'TEXT' },
    { name: 'origin', type: 'TEXT', notNull: true, defaultValue: "'feed_auto'" },
    { name: 'processing_depth', type: 'TEXT', notNull: true, defaultValue: "'lightweight'" },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'pending'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_content_items_endpoint', columns: ['source_endpoint_id'] },
    { name: 'idx_content_items_status', columns: ['status'] },
  ],
};

// ---------------------------------------------------------------------------
// Research family
// ---------------------------------------------------------------------------

const researchSpacesDef: SqliteTableDef = {
  name: 'research_spaces',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'question', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_research_spaces_status', columns: ['status'] },
  ],
};

const researchQuestionsDef: SqliteTableDef = {
  name: 'research_questions',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'research_space_id', type: 'TEXT' },
    { name: 'question', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'priority', type: 'INTEGER' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'open'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_rq_space', columns: ['research_space_id'] },
    { name: 'idx_rq_status', columns: ['status'] },
  ],
};

const sourceSetsDef: SqliteTableDef = {
  name: 'source_sets',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'research_space_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_source_sets_space', columns: ['research_space_id'] },
  ],
};

const researchClaimsDef: SqliteTableDef = {
  name: 'research_claims',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'research_space_id', type: 'TEXT' },
    { name: 'claim', type: 'TEXT', notNull: true },
    { name: 'evidence_summary', type: 'TEXT' },
    { name: 'confidence', type: 'REAL' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'draft'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_rc_space', columns: ['research_space_id'] },
    { name: 'idx_rc_status', columns: ['status'] },
  ],
};

const researchGapsDef: SqliteTableDef = {
  name: 'research_gaps',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'research_space_id', type: 'TEXT' },
    { name: 'description', type: 'TEXT', notNull: true },
    { name: 'priority', type: 'INTEGER' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'open'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_rg_space', columns: ['research_space_id'] },
    { name: 'idx_rg_status', columns: ['status'] },
  ],
};

const researchArtifactsDef: SqliteTableDef = {
  name: 'research_artifacts',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'research_space_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'artifact_type', type: 'TEXT' },
    { name: 'body', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'draft'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_ra_space', columns: ['research_space_id'] },
    { name: 'idx_ra_status', columns: ['status'] },
  ],
};

// ---------------------------------------------------------------------------
// Output family
// ---------------------------------------------------------------------------

const documentsDef: SqliteTableDef = {
  name: 'documents',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'body', type: 'TEXT' },
    { name: 'document_type', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'draft'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_documents_type', columns: ['document_type'] },
    { name: 'idx_documents_status', columns: ['status'] },
  ],
};

const draftsDef: SqliteTableDef = {
  name: 'drafts',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'document_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'body', type: 'TEXT' },
    { name: 'version', type: 'INTEGER', notNull: true, defaultValue: '1' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'in_progress'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_drafts_document', columns: ['document_id'] },
    { name: 'idx_drafts_status', columns: ['status'] },
  ],
};

const postsDef: SqliteTableDef = {
  name: 'posts',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'body', type: 'TEXT' },
    { name: 'platform', type: 'TEXT' },
    { name: 'published_at', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'draft'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_posts_platform', columns: ['platform'] },
    { name: 'idx_posts_status', columns: ['status'] },
  ],
};

const voiceProfilesDef: SqliteTableDef = {
  name: 'voice_profiles',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'tone', type: 'TEXT' },
    { name: 'style_json', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
};

const outputVariantsDef: SqliteTableDef = {
  name: 'output_variants',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'document_id', type: 'TEXT' },
    { name: 'voice_profile_id', type: 'TEXT' },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'body', type: 'TEXT' },
    { name: 'format', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'draft'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_ov_document', columns: ['document_id'] },
    { name: 'idx_ov_voice_profile', columns: ['voice_profile_id'] },
  ],
};

// ---------------------------------------------------------------------------
// Time family
// ---------------------------------------------------------------------------

const actionLogsDef: SqliteTableDef = {
  name: 'action_logs',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'action_type', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'object_uid', type: 'TEXT' },
    { name: 'occurred_at', type: 'TEXT', notNull: true },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_action_logs_type', columns: ['action_type'] },
    { name: 'idx_action_logs_occurred', columns: ['occurred_at'] },
    { name: 'idx_action_logs_object', columns: ['object_uid'] },
  ],
};

const dayNotesDef: SqliteTableDef = {
  name: 'day_notes',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'date', type: 'TEXT', notNull: true },
    { name: 'body', type: 'TEXT' },
    { name: 'mood', type: 'TEXT' },
    { name: 'energy', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_day_notes_date', columns: ['date'], unique: true },
  ],
};

const journalSummariesDef: SqliteTableDef = {
  name: 'journal_summaries',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'period_type', type: 'TEXT', notNull: true },
    { name: 'period_start', type: 'TEXT', notNull: true },
    { name: 'period_end', type: 'TEXT', notNull: true },
    { name: 'body', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_js_period_type', columns: ['period_type'] },
    { name: 'idx_js_period_start', columns: ['period_start'] },
  ],
};

const behaviorInsightsDef: SqliteTableDef = {
  name: 'behavior_insights',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'insight_type', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'evidence_json', type: 'TEXT' },
    { name: 'confidence', type: 'REAL' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_bi_type', columns: ['insight_type'] },
  ],
};

// ---------------------------------------------------------------------------
// Agent family
// ---------------------------------------------------------------------------

const agentSessionsDef: SqliteTableDef = {
  name: 'agent_sessions',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'agent_type', type: 'TEXT', notNull: true },
    { name: 'purpose', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'started_at', type: 'TEXT', notNull: true },
    { name: 'ended_at', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_as_agent_type', columns: ['agent_type'] },
    { name: 'idx_as_status', columns: ['status'] },
  ],
};

const agentRunsDef: SqliteTableDef = {
  name: 'agent_runs',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'session_id', type: 'TEXT' },
    { name: 'run_type', type: 'TEXT', notNull: true },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'running'" },
    { name: 'input_json', type: 'TEXT' },
    { name: 'output_json', type: 'TEXT' },
    { name: 'started_at', type: 'TEXT', notNull: true },
    { name: 'ended_at', type: 'TEXT' },
    { name: 'error', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_ar_session', columns: ['session_id'] },
    { name: 'idx_ar_status', columns: ['status'] },
  ],
};

const agentTasksDef: SqliteTableDef = {
  name: 'agent_tasks',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'run_id', type: 'TEXT' },
    { name: 'task_type', type: 'TEXT', notNull: true },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'pending'" },
    { name: 'input_json', type: 'TEXT' },
    { name: 'output_json', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_at_run', columns: ['run_id'] },
    { name: 'idx_at_status', columns: ['status'] },
  ],
};

const capabilityCallsDef: SqliteTableDef = {
  name: 'capability_calls',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'run_id', type: 'TEXT' },
    { name: 'capability', type: 'TEXT', notNull: true },
    { name: 'input_json', type: 'TEXT' },
    { name: 'output_json', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'pending'" },
    { name: 'latency_ms', type: 'INTEGER' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_cc_run', columns: ['run_id'] },
    { name: 'idx_cc_capability', columns: ['capability'] },
  ],
};

const approvalRequestsDef: SqliteTableDef = {
  name: 'approval_requests',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'run_id', type: 'TEXT' },
    { name: 'request_type', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'pending'" },
    { name: 'response_json', type: 'TEXT' },
    { name: 'requested_at', type: 'TEXT', notNull: true },
    { name: 'responded_at', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_apr_run', columns: ['run_id'] },
    { name: 'idx_apr_status', columns: ['status'] },
  ],
};

// ---------------------------------------------------------------------------
// Standalone domain tables
// ---------------------------------------------------------------------------

const tagsDef: SqliteTableDef = {
  name: 'tags',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'color', type: 'TEXT' },
    { name: 'tag_type', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  uniqueConstraints: [['name']],
  indexes: [
    { name: 'idx_tags_type', columns: ['tag_type'] },
  ],
};

const aiChatsDef: SqliteTableDef = {
  name: 'ai_chats',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'title', type: 'TEXT' },
    { name: 'context_uid', type: 'TEXT' },
    { name: 'model', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: "'active'" },
    { name: 'created_at', type: 'TEXT', notNull: true },
    { name: 'updated_at', type: 'TEXT', notNull: true },
    { name: 'deleted_flg', type: 'INTEGER', notNull: true, defaultValue: '0' },
  ],
  indexes: [
    { name: 'idx_ai_chats_context', columns: ['context_uid'] },
    { name: 'idx_ai_chats_status', columns: ['status'] },
  ],
};

// ---------------------------------------------------------------------------
// All type-table definitions collected
// ---------------------------------------------------------------------------

const allTypeDefs: readonly SqliteTableDef[] = [
  // Direction
  visionsDef,
  directionsDef,
  themesDef,
  goalsDef,
  commitmentsDef,
  reviewsDef,
  // Execution
  projectsDef,
  milestonesDef,
  tasksDef,
  directivesDef,
  // Input
  articlesDef,
  booksDef,
  highlightsDef,
  notesDef,
  assetsDef,
  sourceEndpointsDef,
  contentItemsDef,
  // Research
  researchSpacesDef,
  researchQuestionsDef,
  sourceSetsDef,
  researchClaimsDef,
  researchGapsDef,
  researchArtifactsDef,
  // Output
  documentsDef,
  draftsDef,
  postsDef,
  voiceProfilesDef,
  outputVariantsDef,
  // Time
  actionLogsDef,
  dayNotesDef,
  journalSummariesDef,
  behaviorInsightsDef,
  // Agent
  agentSessionsDef,
  agentRunsDef,
  agentTasksDef,
  capabilityCallsDef,
  approvalRequestsDef,
  // Standalone
  tagsDef,
  aiChatsDef,
];

export const typeTables: readonly TableModule[] = allTypeDefs.map(tableFromDef);
