import { describe, expect, it, beforeEach } from 'vitest';

import type { MemoryEntry, MemoryLayer } from '../src/types.js';
import { generateId } from '../src/types.js';
import {
  InMemoryStore,
  type MemoryStore,
  type ScoredMemory,
} from '../src/memory/memory-store.js';
import {
  MemoryLayerManager,
  DEFAULT_LAYER_CONFIGS,
} from '../src/memory/memory-layer-manager.js';
import { ContextBuilder } from '../src/memory/context-builder.js';

// ---- Helpers ----

function makeEntry(
  overrides: Partial<MemoryEntry> & { content: string; layer: MemoryLayer },
): MemoryEntry {
  return {
    id: overrides.id ?? generateId('mem'),
    layer: overrides.layer,
    content: overrides.content,
    confidence: overrides.confidence ?? 1.0,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    sourceSessionId: overrides.sourceSessionId,
    sourceObjectId: overrides.sourceObjectId,
    expiresAt: overrides.expiresAt,
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  } as MemoryEntry;
}

// ===========================================================================
// InMemoryStore
// ===========================================================================

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('add and count', async () => {
    expect(await store.count()).toBe(0);
    await store.add(makeEntry({ content: 'hello', layer: 'L0-turn' }));
    expect(await store.count()).toBe(1);
    expect(await store.count('L0-turn')).toBe(1);
    expect(await store.count('L1-session')).toBe(0);
  });

  it('query returns all when no filters', async () => {
    await store.add(makeEntry({ content: 'a', layer: 'L0-turn' }));
    await store.add(makeEntry({ content: 'b', layer: 'L1-session' }));
    const results = await store.query({});
    expect(results).toHaveLength(2);
  });

  it('query filters by layer', async () => {
    await store.add(makeEntry({ content: 'a', layer: 'L0-turn' }));
    await store.add(makeEntry({ content: 'b', layer: 'L1-session' }));
    const results = await store.query({ layer: 'L0-turn' });
    expect(results).toHaveLength(1);
    expect(results[0].entry.content).toBe('a');
  });

  it('query filters by sessionId', async () => {
    await store.add(
      makeEntry({ content: 'a', layer: 'L0-turn', sourceSessionId: 's1' }),
    );
    await store.add(
      makeEntry({ content: 'b', layer: 'L0-turn', sourceSessionId: 's2' }),
    );
    const results = await store.query({ sessionId: 's1' });
    expect(results).toHaveLength(1);
    expect(results[0].entry.content).toBe('a');
  });

  it('query with text matching scores results', async () => {
    await store.add(
      makeEntry({
        content: 'the quick brown fox',
        layer: 'L0-turn',
      }),
    );
    await store.add(
      makeEntry({
        content: 'a slow green turtle',
        layer: 'L0-turn',
      }),
    );
    const results = await store.query({ text: 'quick fox' });
    expect(results).toHaveLength(2);
    // "quick brown fox" should score higher
    expect(results[0].entry.content).toContain('quick');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('query respects limit', async () => {
    for (let i = 0; i < 10; i++) {
      await store.add(makeEntry({ content: `item ${i}`, layer: 'L0-turn' }));
    }
    const results = await store.query({ limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('query respects minRelevance', async () => {
    await store.add(
      makeEntry({ content: 'exact match phrase', layer: 'L0-turn' }),
    );
    await store.add(
      makeEntry({ content: 'completely unrelated content here', layer: 'L0-turn' }),
    );
    const results = await store.query({ text: 'exact match phrase', minRelevance: 0.5 });
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('remove returns true for existing entry', async () => {
    const entry = makeEntry({ id: 'x1', content: 'hi', layer: 'L0-turn' });
    await store.add(entry);
    expect(await store.remove('x1')).toBe(true);
    expect(await store.count()).toBe(0);
  });

  it('remove returns false for non-existing entry', async () => {
    expect(await store.remove('nope')).toBe(false);
  });

  it('clear without layer removes all', async () => {
    await store.add(makeEntry({ content: 'a', layer: 'L0-turn' }));
    await store.add(makeEntry({ content: 'b', layer: 'L1-session' }));
    const cleared = await store.clear();
    expect(cleared).toBe(2);
    expect(await store.count()).toBe(0);
  });

  it('clear with layer removes only that layer', async () => {
    await store.add(makeEntry({ content: 'a', layer: 'L0-turn' }));
    await store.add(makeEntry({ content: 'b', layer: 'L1-session' }));
    const cleared = await store.clear('L0-turn');
    expect(cleared).toBe(1);
    expect(await store.count()).toBe(1);
    expect(await store.count('L1-session')).toBe(1);
  });
});

// ===========================================================================
// Scoring
// ===========================================================================

describe('Scoring', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('higher scores for better term overlap', async () => {
    await store.add(
      makeEntry({ content: 'machine learning neural network', layer: 'L0-turn' }),
    );
    await store.add(
      makeEntry({ content: 'cooking recipes for dinner', layer: 'L0-turn' }),
    );
    const results = await store.query({ text: 'machine learning' });
    expect(results[0].entry.content).toContain('machine');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('exact phrase match gets a boost', async () => {
    await store.add(
      makeEntry({ content: 'hello world program', layer: 'L0-turn' }),
    );
    await store.add(
      makeEntry({
        content: 'world program hello extra words padding more text',
        layer: 'L0-turn',
      }),
    );
    const results = await store.query({ text: 'hello world' });
    // The first entry contains the exact phrase "hello world"
    expect(results[0].entry.content).toBe('hello world program');
  });

  it('empty query text returns score 1 for all', async () => {
    await store.add(makeEntry({ content: 'anything', layer: 'L0-turn' }));
    const results = await store.query({});
    expect(results[0].score).toBe(1);
  });
});

// ===========================================================================
// MemoryLayerManager
// ===========================================================================

describe('MemoryLayerManager', () => {
  let store: InMemoryStore;
  let manager: MemoryLayerManager;

  beforeEach(() => {
    store = new InMemoryStore();
    manager = new MemoryLayerManager(store);
  });

  it('add creates entry with correct layer', async () => {
    const entry = await manager.add('L0-turn', 'test content');
    expect(entry.layer).toBe('L0-turn');
    expect(entry.content).toBe('test content');
    expect(entry.id).toBeTruthy();
  });

  it('add with metadata stores sessionId', async () => {
    const entry = await manager.add('L1-session', 'data', {
      sessionId: 's1',
    });
    expect(entry.sourceSessionId).toBe('s1');
  });

  it('recall returns results across layers', async () => {
    await manager.add('L0-turn', 'quick search result');
    await manager.add('L1-session', 'quick session note');
    await manager.add('L5-archive', 'archived quick data');

    const results = await manager.recall('quick');
    expect(results.length).toBe(3);
  });

  it('recall respects layer filter', async () => {
    await manager.add('L0-turn', 'quick in turn');
    await manager.add('L1-session', 'quick in session');

    const results = await manager.recall('quick', { layers: ['L0-turn'] });
    expect(results.length).toBe(1);
    expect(results[0].entry.layer).toBe('L0-turn');
  });

  it('recall prioritises higher-priority layers', async () => {
    await manager.add('L5-archive', 'keyword data');
    await manager.add('L0-turn', 'keyword data');

    const results = await manager.recall('keyword');
    expect(results[0].entry.layer).toBe('L0-turn');
    expect(results[1].entry.layer).toBe('L5-archive');
  });

  it('promote moves entry to target layer', async () => {
    const entry = await manager.add('L1-session', 'important fact');
    const ok = await manager.promote(entry.id, 'L3-user-longterm');
    expect(ok).toBe(true);

    expect(await store.count('L1-session')).toBe(0);
    expect(await store.count('L3-user-longterm')).toBe(1);
  });

  it('promote returns false for missing entry', async () => {
    expect(await manager.promote('nonexistent', 'L0-turn')).toBe(false);
  });

  it('getStats returns per-layer statistics', async () => {
    await manager.add('L0-turn', 'a');
    await manager.add('L0-turn', 'b');
    await manager.add('L1-session', 'c');

    const stats = await manager.getStats();
    const turnStat = stats.find((s) => s.layer === 'L0-turn');
    expect(turnStat?.count).toBe(2);
    const sessionStat = stats.find((s) => s.layer === 'L1-session');
    expect(sessionStat?.count).toBe(1);
  });
});

// ===========================================================================
// Eviction
// ===========================================================================

describe('Eviction', () => {
  it('evicts entries whose TTL has expired', async () => {
    const store = new InMemoryStore();
    // Use a custom config with very short TTL
    const manager = new MemoryLayerManager(store, [
      { layer: 'L1-session', maxEntries: 100, ttlMs: 1, priority: 5 },
    ]);

    await manager.add('L1-session', 'will expire');

    // Wait for expiry
    await new Promise((r) => setTimeout(r, 10));

    const evicted = await manager.evict();
    expect(evicted).toBe(1);
    expect(await store.count('L1-session')).toBe(0);
  });

  it('evicts oldest entries when over maxEntries', async () => {
    const store = new InMemoryStore();
    const manager = new MemoryLayerManager(store, [
      { layer: 'L0-turn', maxEntries: 3, ttlMs: undefined, priority: 6 },
    ]);

    for (let i = 0; i < 5; i++) {
      await manager.add('L0-turn', `entry-${i}`);
      // Small delay so timestamps differ
      await new Promise((r) => setTimeout(r, 2));
    }

    const evicted = await manager.evict();
    expect(evicted).toBe(2);
    expect(await store.count('L0-turn')).toBe(3);

    // The oldest entries (0,1) should be gone; newest (2,3,4) remain
    const remaining = await store.query({ layer: 'L0-turn' });
    const contents = remaining.map((r) => r.entry.content);
    expect(contents).not.toContain('entry-0');
    expect(contents).not.toContain('entry-1');
    expect(contents).toContain('entry-4');
  });
});

// ===========================================================================
// ContextBuilder
// ===========================================================================

describe('ContextBuilder', () => {
  let store: InMemoryStore;
  let manager: MemoryLayerManager;
  let builder: ContextBuilder;

  beforeEach(() => {
    store = new InMemoryStore();
    manager = new MemoryLayerManager(store);
    builder = new ContextBuilder(manager);
  });

  it('buildContext returns blocks within budget', async () => {
    // Add a lot of content
    for (let i = 0; i < 20; i++) {
      await manager.add('L0-turn', `keyword content block number ${i}`);
    }

    const blocks = await builder.buildContext('keyword', {
      maxTokens: 100,
      reservedForResponse: 20,
      reservedForSystem: 20,
    });

    const totalTokens = blocks.reduce((s, b) => s + b.tokenEstimate, 0);
    expect(totalTokens).toBeLessThanOrEqual(60); // 100 - 20 - 20
  });

  it('buildContext returns empty for zero budget', async () => {
    await manager.add('L0-turn', 'keyword hello');
    const blocks = await builder.buildContext('keyword', {
      maxTokens: 10,
      reservedForResponse: 5,
      reservedForSystem: 5,
    });
    expect(blocks).toHaveLength(0);
  });

  it('buildContext groups by layer', async () => {
    await manager.add('L0-turn', 'keyword turn data');
    await manager.add('L1-session', 'keyword session data');

    const blocks = await builder.buildContext('keyword', {
      maxTokens: 2000,
      reservedForResponse: 100,
      reservedForSystem: 100,
    });

    expect(blocks.length).toBe(2);
    // Higher priority first
    expect(blocks[0].priority).toBeGreaterThanOrEqual(blocks[1].priority);
  });

  it('formatForLLM produces fenced blocks', () => {
    const blocks = [
      {
        label: 'Turn Memory',
        content: 'hello world',
        tokenEstimate: 3,
        priority: 6,
      },
      {
        label: 'Session Memory',
        content: 'foo bar',
        tokenEstimate: 2,
        priority: 5,
      },
    ];

    const formatted = builder.formatForLLM(blocks);
    expect(formatted).toContain('<memory-context layer="Turn Memory">');
    expect(formatted).toContain('hello world');
    expect(formatted).toContain('</memory-context>');
    expect(formatted).toContain('<memory-context layer="Session Memory">');
  });

  it('formatForLLM returns empty string for empty blocks', () => {
    expect(builder.formatForLLM([])).toBe('');
  });

  it('estimateTokens approximates ~4 chars per token', () => {
    expect(builder.estimateTokens('abcd')).toBe(1);
    expect(builder.estimateTokens('abcdefgh')).toBe(2);
    expect(builder.estimateTokens('a')).toBe(1); // ceil
  });
});
