// ---------------------------------------------------------------------------
// @orbit/agent-core – Memory Store (M4)
// ---------------------------------------------------------------------------

import type { MemoryEntry, MemoryLayer } from '../types.js';

// ---- Query & result types ----

export interface MemoryQuery {
  readonly text?: string;
  readonly layer?: MemoryLayer;
  readonly tags?: readonly string[];
  readonly limit?: number;
  readonly minRelevance?: number;
  readonly since?: number;
  readonly sessionId?: string;
}

export interface ScoredMemory {
  readonly entry: MemoryEntry;
  readonly score: number;
}

// ---- Abstract store interface ----

export interface MemoryStore {
  add(entry: MemoryEntry): Promise<void>;
  query(q: MemoryQuery): Promise<readonly ScoredMemory[]>;
  remove(id: string): Promise<boolean>;
  clear(layer?: MemoryLayer): Promise<number>;
  count(layer?: MemoryLayer): Promise<number>;
}

// ---- Helpers ----

/** Tokenise text into lowercase words (letters/digits only). */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9\u4e00-\u9fff]+/g) ?? [];
}

// ---- In-memory store with term-frequency scoring ----

export class InMemoryStore implements MemoryStore {
  private entries: MemoryEntry[] = [];

  async add(entry: MemoryEntry): Promise<void> {
    this.entries.push(entry);
  }

  async query(q: MemoryQuery): Promise<readonly ScoredMemory[]> {
    let candidates = this.entries;

    if (q.layer) {
      const layer = q.layer;
      candidates = candidates.filter((e) => e.layer === layer);
    }
    if (q.sessionId) {
      const sid = q.sessionId;
      candidates = candidates.filter((e) => e.sourceSessionId === sid);
    }
    if (q.since !== undefined) {
      const since = q.since;
      candidates = candidates.filter(
        (e) => new Date(e.createdAt).getTime() >= since,
      );
    }
    if (q.tags && q.tags.length > 0) {
      const tagSet = new Set(q.tags);
      candidates = candidates.filter((e) => {
        // Tags are encoded in content as "#tag" tokens
        return q.tags!.some((t) => e.content.includes(`#${t}`));
      });
    }

    let scored: ScoredMemory[];

    if (q.text) {
      const queryText = q.text;
      scored = candidates.map((entry) => ({
        entry,
        score: this.score(entry, queryText),
      }));
    } else {
      scored = candidates.map((entry) => ({ entry, score: 1 }));
    }

    if (q.minRelevance !== undefined) {
      const min = q.minRelevance;
      scored = scored.filter((s) => s.score >= min);
    }

    scored.sort((a, b) => b.score - a.score);

    if (q.limit !== undefined) {
      scored = scored.slice(0, q.limit);
    }

    return scored;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    return true;
  }

  async clear(layer?: MemoryLayer): Promise<number> {
    if (layer === undefined) {
      const count = this.entries.length;
      this.entries = [];
      return count;
    }
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.layer !== layer);
    return before - this.entries.length;
  }

  async count(layer?: MemoryLayer): Promise<number> {
    if (layer === undefined) return this.entries.length;
    return this.entries.filter((e) => e.layer === layer).length;
  }

  /** Simple term-frequency overlap scoring with exact-phrase boost. */
  private score(entry: MemoryEntry, query: string): number {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return 0;

    const entryTokens = tokenize(entry.content);
    if (entryTokens.length === 0) return 0;

    const allUnique = new Set([...queryTokens, ...entryTokens]);
    const entryTokenSet = new Set(entryTokens);
    const matchCount = queryTokens.filter((t) => entryTokenSet.has(t)).length;

    let base = matchCount / allUnique.size;

    // Exact phrase boost
    if (entry.content.toLowerCase().includes(query.toLowerCase())) {
      base = Math.min(1, base + 0.3);
    }

    return Math.round(base * 1000) / 1000;
  }
}
