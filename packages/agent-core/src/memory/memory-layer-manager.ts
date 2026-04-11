// ---------------------------------------------------------------------------
// @orbit/agent-core – Memory Layer Manager (M4)
// ---------------------------------------------------------------------------

import type { MemoryEntry, MemoryLayer } from '../types.js';
import { generateId, MEMORY_LAYERS } from '../types.js';
import type { MemoryStore, ScoredMemory } from './memory-store.js';

// ---- Configuration ----

export interface LayerConfig {
  readonly layer: MemoryLayer;
  readonly maxEntries: number;
  readonly ttlMs?: number;
  readonly priority: number;
}

export const DEFAULT_LAYER_CONFIGS: readonly LayerConfig[] = [
  { layer: 'L0-turn', maxEntries: 100, ttlMs: undefined, priority: 6 },
  { layer: 'L1-session', maxEntries: 500, ttlMs: 24 * 60 * 60 * 1000, priority: 5 },
  { layer: 'L2-object', maxEntries: 1000, ttlMs: undefined, priority: 4 },
  { layer: 'L3-user-longterm', maxEntries: 200, ttlMs: undefined, priority: 3 },
  { layer: 'L4-procedural', maxEntries: 100, ttlMs: undefined, priority: 2 },
  { layer: 'L5-archive', maxEntries: 10000, ttlMs: undefined, priority: 1 },
];

// ---- Layer stats ----

export interface LayerStats {
  readonly layer: MemoryLayer;
  readonly count: number;
  readonly maxEntries: number;
  readonly oldestTimestamp?: number;
}

// ---- MemoryLayerManager ----

export class MemoryLayerManager {
  private readonly store: MemoryStore;
  private readonly configs: Map<MemoryLayer, LayerConfig>;

  constructor(store: MemoryStore, configs?: readonly LayerConfig[]) {
    this.store = store;
    this.configs = new Map<MemoryLayer, LayerConfig>();
    for (const c of configs ?? DEFAULT_LAYER_CONFIGS) {
      this.configs.set(c.layer, c);
    }
  }

  /** Add memory to a specific layer. */
  async add(
    layer: MemoryLayer,
    content: string,
    metadata?: {
      tags?: readonly string[];
      sessionId?: string;
      source?: string;
    },
  ): Promise<MemoryEntry> {
    const now = new Date();
    const config = this.configs.get(layer);
    let expiresAt: string | undefined;
    if (config?.ttlMs !== undefined) {
      expiresAt = new Date(now.getTime() + config.ttlMs).toISOString();
    }

    const entry: MemoryEntry = {
      id: generateId('mem'),
      layer,
      content,
      sourceSessionId: metadata?.sessionId,
      sourceObjectId: metadata?.source,
      confidence: 1.0,
      expiresAt,
      createdAt: now.toISOString(),
    };

    await this.store.add(entry);
    return entry;
  }

  /** Recall memories across layers, higher-priority layers first. */
  async recall(
    query: string,
    options?: {
      layers?: readonly MemoryLayer[];
      limit?: number;
      minRelevance?: number;
    },
  ): Promise<readonly ScoredMemory[]> {
    const targetLayers = options?.layers ?? [...MEMORY_LAYERS];
    const limit = options?.limit ?? 20;
    const minRelevance = options?.minRelevance ?? 0;

    // Collect results per layer
    const allResults: ScoredMemory[] = [];
    for (const layer of targetLayers) {
      const results = await this.store.query({
        text: query,
        layer,
        minRelevance,
      });
      allResults.push(...results);
    }

    // Sort by layer priority (desc), then by score (desc)
    allResults.sort((a, b) => {
      const pa = this.configs.get(a.entry.layer)?.priority ?? 0;
      const pb = this.configs.get(b.entry.layer)?.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return b.score - a.score;
    });

    return allResults.slice(0, limit);
  }

  /** Promote memory from one layer to another. */
  async promote(
    entryId: string,
    targetLayer: MemoryLayer,
  ): Promise<boolean> {
    // Query all to find the entry
    const results = await this.store.query({});
    const match = results.find((r) => r.entry.id === entryId);
    if (!match) return false;

    const oldEntry = match.entry;
    await this.store.remove(entryId);

    const config = this.configs.get(targetLayer);
    let expiresAt: string | undefined;
    if (config?.ttlMs !== undefined) {
      expiresAt = new Date(Date.now() + config.ttlMs).toISOString();
    }

    const promoted: MemoryEntry = {
      ...oldEntry,
      layer: targetLayer,
      expiresAt,
    };
    await this.store.add(promoted);
    return true;
  }

  /** Evict expired and overflow entries. Returns number of evicted entries. */
  async evict(): Promise<number> {
    let totalEvicted = 0;
    const now = Date.now();

    // Pass 1: remove expired entries
    const all = await this.store.query({});
    for (const { entry } of all) {
      if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= now) {
        const removed = await this.store.remove(entry.id);
        if (removed) totalEvicted++;
      }
    }

    // Pass 2: enforce per-layer maxEntries (remove oldest first)
    for (const [layer, config] of this.configs) {
      const layerResults = await this.store.query({ layer });
      if (layerResults.length <= config.maxEntries) continue;

      // Sort by createdAt ascending (oldest first)
      const sorted = [...layerResults].sort(
        (a, b) =>
          new Date(a.entry.createdAt).getTime() -
          new Date(b.entry.createdAt).getTime(),
      );

      const overflow = sorted.length - config.maxEntries;
      for (let i = 0; i < overflow; i++) {
        const removed = await this.store.remove(sorted[i].entry.id);
        if (removed) totalEvicted++;
      }
    }

    return totalEvicted;
  }

  /** Get statistics for each configured layer. */
  async getStats(): Promise<readonly LayerStats[]> {
    const stats: LayerStats[] = [];
    for (const [layer, config] of this.configs) {
      const results = await this.store.query({ layer });
      let oldest: number | undefined;
      for (const { entry } of results) {
        const ts = new Date(entry.createdAt).getTime();
        if (oldest === undefined || ts < oldest) oldest = ts;
      }
      stats.push({
        layer,
        count: results.length,
        maxEntries: config.maxEntries,
        oldestTimestamp: oldest,
      });
    }
    return stats;
  }

  /** Expose the underlying store. */
  getStore(): MemoryStore {
    return this.store;
  }
}
