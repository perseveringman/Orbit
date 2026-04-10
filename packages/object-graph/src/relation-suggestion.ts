import type { Link, LinkStatus, ObjectUid } from './types.js';

// ── Suggestion sources ──

export type SuggestionSource =
  | 'text_similarity'
  | 'co_occurrence'
  | 'provenance_chain'
  | 'temporal_proximity'
  | 'behavioral_pattern';

// ── Signal breakdown ──

export interface SuggestionSignal {
  readonly source: SuggestionSource;
  readonly score: number;
  readonly detail: string | null;
}

// ── Relation suggestion ──

export interface RelationSuggestion {
  readonly suggestionId: string;
  readonly sourceUid: ObjectUid;
  readonly targetUid: ObjectUid;
  readonly relationType: string;
  readonly confidence: number;
  readonly whySummary: string;
  readonly signals: readonly SuggestionSignal[];
  readonly status: Extract<LinkStatus, 'proposed' | 'active' | 'rejected'>;
  readonly createdAt: string;
}

// ── Suppress rules ──

export interface SuppressRule {
  readonly sourceUid?: ObjectUid;
  readonly targetUid?: ObjectUid;
  readonly relationType?: string;
  readonly reason: string;
}

// ── Engine interface ──

/**
 * AI relation suggestion engine.
 *
 * Status machine:  proposed → active | rejected
 *
 * - `suggest` generates candidate relations for a set of context objects.
 * - `accept` promotes a suggestion to an active Link.
 * - `reject` marks a suggestion as rejected (with reason); the engine must
 *   avoid re-suggesting the same link in the short term.
 * - `rewrite` accepts the suggestion but changes its relation type.
 * - `suppress` installs a pattern-based rule to prevent future suggestions.
 */
export interface RelationSuggestionEngine {
  suggest(contextUids: ObjectUid[]): Promise<RelationSuggestion[]>;
  accept(suggestionId: string): Promise<Link>;
  reject(suggestionId: string, reason: string): Promise<void>;
  rewrite(suggestionId: string, newRelationType: string): Promise<Link>;
  suppress(pattern: SuppressRule): Promise<void>;
}
