// ---------------------------------------------------------------------------
// @orbit/agent-core – Context Builder (M4)
// ---------------------------------------------------------------------------

import type { MemoryLayer } from '../types.js';
import type { ScoredMemory } from './memory-store.js';
import type { MemoryLayerManager } from './memory-layer-manager.js';

// ---- Types ----

export interface ContextBlock {
  readonly label: string;
  readonly content: string;
  readonly tokenEstimate: number;
  readonly priority: number;
}

export interface ContextBudget {
  readonly maxTokens: number;
  readonly reservedForResponse: number;
  readonly reservedForSystem: number;
}

// ---- Layer display names ----

const LAYER_LABELS: Record<MemoryLayer, string> = {
  'L0-turn': 'Turn Memory',
  'L1-session': 'Session Memory',
  'L2-object': 'Object Memory',
  'L3-user-longterm': 'User Long-term Memory',
  'L4-procedural': 'Procedural Memory',
  'L5-archive': 'Archive Memory',
};

const LAYER_PRIORITIES: Record<MemoryLayer, number> = {
  'L0-turn': 6,
  'L1-session': 5,
  'L2-object': 4,
  'L3-user-longterm': 3,
  'L4-procedural': 2,
  'L5-archive': 1,
};

// ---- ContextBuilder ----

export class ContextBuilder {
  constructor(private readonly layerManager: MemoryLayerManager) {}

  /** Build context blocks from memory layers for a given query. */
  async buildContext(
    query: string,
    budget: ContextBudget,
  ): Promise<readonly ContextBlock[]> {
    const availableTokens =
      budget.maxTokens - budget.reservedForResponse - budget.reservedForSystem;

    if (availableTokens <= 0) return [];

    const memories = await this.layerManager.recall(query, { limit: 50 });
    if (memories.length === 0) return [];

    // Group by layer
    const grouped = new Map<MemoryLayer, ScoredMemory[]>();
    for (const mem of memories) {
      const layer = mem.entry.layer;
      const arr = grouped.get(layer) ?? [];
      arr.push(mem);
      grouped.set(layer, arr);
    }

    // Sort layers by priority (desc)
    const sortedLayers = [...grouped.keys()].sort(
      (a, b) => (LAYER_PRIORITIES[b] ?? 0) - (LAYER_PRIORITIES[a] ?? 0),
    );

    // Build blocks within token budget
    const blocks: ContextBlock[] = [];
    let usedTokens = 0;

    for (const layer of sortedLayers) {
      const entries = grouped.get(layer)!;
      const lines: string[] = [];

      for (const { entry, score } of entries) {
        const line = `[score=${score.toFixed(2)}] ${entry.content}`;
        const lineTokens = this.estimateTokens(line);

        if (usedTokens + lineTokens > availableTokens) break;
        lines.push(line);
        usedTokens += lineTokens;
      }

      if (lines.length === 0) continue;

      const content = lines.join('\n');
      blocks.push({
        label: LAYER_LABELS[layer] ?? layer,
        content,
        tokenEstimate: this.estimateTokens(content),
        priority: LAYER_PRIORITIES[layer] ?? 0,
      });

      if (usedTokens >= availableTokens) break;
    }

    return blocks;
  }

  /** Format context blocks into a fenced string for LLM consumption. */
  formatForLLM(blocks: readonly ContextBlock[]): string {
    if (blocks.length === 0) return '';

    return blocks
      .map(
        (b) =>
          `<memory-context layer="${b.label}">\n${b.content}\n</memory-context>`,
      )
      .join('\n');
  }

  /** Estimate token count (~4 chars per token). */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
