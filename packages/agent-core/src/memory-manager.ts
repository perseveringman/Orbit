// ---------------------------------------------------------------------------
// @orbit/agent-core – Memory Manager
// ---------------------------------------------------------------------------

import type { MemoryEntry, MemoryLayer } from './types.js';
import { generateId } from './types.js';

// ---- Public types ----

export interface MemoryRecallQuery {
  readonly scope: MemoryLayer | 'all';
  readonly query: string;
  readonly maxEntries?: number;
  readonly objectId?: string;
  readonly sessionId?: string;
}

export interface MemoryStore {
  recall(query: MemoryRecallQuery): Promise<readonly MemoryEntry[]>;
  store(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry>;
  remove(id: string): Promise<void>;
  getByLayer(layer: MemoryLayer): Promise<readonly MemoryEntry[]>;
}

// ---- Context fencing constants ----

const MEMORY_FENCE_OPEN = '<memory-context>';
const MEMORY_FENCE_CLOSE = '</memory-context>';
const FENCE_ESCAPE_RE = /<\/?memory-context>/gi;

// ---- MemoryManager ----

export class MemoryManager {
  private readonly store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  /**
   * Wraps recalled memory entries in fenced `<memory-context>` tags
   * to prevent model confusion between recalled facts and live conversation.
   */
  buildContextBlock(entries: readonly MemoryEntry[]): string {
    if (entries.length === 0) return '';

    const lines = entries.map(
      (e) => `[${e.layer}] (confidence=${e.confidence.toFixed(2)}) ${e.content}`,
    );
    return `${MEMORY_FENCE_OPEN}\n${lines.join('\n')}\n${MEMORY_FENCE_CLOSE}`;
  }

  /**
   * Recall relevant memory for the current turn.
   */
  async recallForTurn(
    query: string,
    sessionId: string,
  ): Promise<readonly MemoryEntry[]> {
    return this.store.recall({
      scope: 'all',
      query,
      sessionId,
      maxEntries: 10,
    });
  }

  /**
   * Store a new memory entry from the current turn.
   */
  async storeFromTurn(
    content: string,
    layer: MemoryLayer,
    sourceRef?: { objectId?: string; sessionId?: string },
  ): Promise<MemoryEntry> {
    return this.store.store({
      layer,
      content,
      sourceObjectId: sourceRef?.objectId,
      sourceSessionId: sourceRef?.sessionId,
      confidence: 1.0,
    });
  }

  /**
   * Compress an entire session into a single archive memory entry.
   */
  async compressSession(sessionId: string): Promise<MemoryEntry> {
    const sessionEntries = await this.store.recall({
      scope: 'L1-session',
      query: '',
      sessionId,
    });

    const combined = sessionEntries.map((e) => e.content).join('\n');
    const summary = `Session ${sessionId} compressed: ${combined.slice(0, 500)}`;

    return this.store.store({
      layer: 'L5-archive',
      content: summary,
      sourceSessionId: sessionId,
      confidence: 0.8,
    });
  }

  /**
   * Strip memory-context fence tags from user-supplied text to prevent
   * injection of fake memory blocks.
   */
  sanitizeContext(text: string): string {
    return text.replace(FENCE_ESCAPE_RE, '');
  }

  /**
   * Helper – expose the underlying store for advanced operations.
   */
  getStore(): MemoryStore {
    return this.store;
  }
}

// ---- In-memory MemoryStore implementation (for testing / light usage) ----

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async recall(query: MemoryRecallQuery): Promise<readonly MemoryEntry[]> {
    let results = [...this.entries.values()];

    if (query.scope !== 'all') {
      const layer = query.scope;
      results = results.filter((e) => e.layer === layer);
    }
    if (query.sessionId) {
      const sid = query.sessionId;
      results = results.filter((e) => e.sourceSessionId === sid);
    }
    if (query.objectId) {
      const oid = query.objectId;
      results = results.filter((e) => e.sourceObjectId === oid);
    }
    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter((e) => e.content.toLowerCase().includes(q));
    }
    if (query.maxEntries) {
      results = results.slice(0, query.maxEntries);
    }
    return results;
  }

  async store(
    entry: Omit<MemoryEntry, 'id' | 'createdAt'>,
  ): Promise<MemoryEntry> {
    const full: MemoryEntry = {
      ...entry,
      id: generateId('mem'),
      createdAt: new Date().toISOString(),
    };
    this.entries.set(full.id, full);
    return full;
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async getByLayer(layer: MemoryLayer): Promise<readonly MemoryEntry[]> {
    return [...this.entries.values()].filter((e) => e.layer === layer);
  }
}
