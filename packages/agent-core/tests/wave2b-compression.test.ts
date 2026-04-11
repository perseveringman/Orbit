import { describe, expect, it, beforeEach } from 'vitest';

import {
  createCompressionStrategy,
  COMPRESSION_LEVEL_NAMES,
} from '../src/session/compression-levels.js';

import type {
  CompressionLevel,
  CompressionStrategy,
} from '../src/session/compression-levels.js';

// ===========================================================================
// Compression Levels
// ===========================================================================

describe('COMPRESSION_LEVEL_NAMES', () => {
  it('maps all 5 levels', () => {
    expect(COMPRESSION_LEVEL_NAMES[1]).toBe('turn');
    expect(COMPRESSION_LEVEL_NAMES[2]).toBe('session');
    expect(COMPRESSION_LEVEL_NAMES[3]).toBe('workspace');
    expect(COMPRESSION_LEVEL_NAMES[4]).toBe('lineage');
    expect(COMPRESSION_LEVEL_NAMES[5]).toBe('archive');
  });
});

describe('CompressionStrategy (createCompressionStrategy)', () => {
  let strategy: CompressionStrategy;

  const longInput = [
    'The quick brown fox jumps over the lazy dog.',
    'This is a detailed analysis of the problem at hand.',
    'We need to consider multiple factors before proceeding.',
    'First, the performance implications are significant.',
    'Second, there are security concerns to address.',
    'Third, we must ensure backwards compatibility.',
    'The team has discussed various approaches to solving this.',
    'After careful consideration, we recommend option B.',
    'This approach balances complexity with effectiveness.',
    'In conclusion, we should proceed with the phased rollout.',
  ].join('\n');

  beforeEach(() => {
    strategy = createCompressionStrategy();
  });

  // ---- estimateRatio ----

  it('estimateRatio returns decreasing ratios for higher levels', () => {
    const ratios: number[] = [];
    for (let level = 1; level <= 5; level++) {
      ratios.push(strategy.estimateRatio(level as CompressionLevel));
    }
    // Each level should have a lower ratio than the previous
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeLessThan(ratios[i - 1]);
    }
  });

  it('estimateRatio values are between 0 and 1', () => {
    for (let level = 1; level <= 5; level++) {
      const ratio = strategy.estimateRatio(level as CompressionLevel);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });

  // ---- compress ----

  it('compress at level 1 (turn) produces output', () => {
    const result = strategy.compress(longInput, 1);
    expect(result.level).toBe(1);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.metadata).toHaveProperty('levelName', 'turn');
  });

  it('compress at level 2 (session) produces more compressed output', () => {
    const r1 = strategy.compress(longInput, 1);
    const r2 = strategy.compress(longInput, 2);
    expect(r2.level).toBe(2);
    expect(r2.compressedTokens).toBeLessThanOrEqual(r1.originalTokens);
  });

  it('compress at level 3 (workspace) is more aggressive', () => {
    const result = strategy.compress(longInput, 3);
    expect(result.level).toBe(3);
    expect(result.summary.length).toBeLessThan(longInput.length);
  });

  it('compress at level 4 (lineage) is very compact', () => {
    const result = strategy.compress(longInput, 4);
    expect(result.level).toBe(4);
    expect(result.summary.length).toBeLessThan(longInput.length);
    expect(result.summary).toContain('Lineage summary');
  });

  it('compress at level 5 (archive) is maximally compact', () => {
    const result = strategy.compress(longInput, 5);
    expect(result.level).toBe(5);
    expect(result.summary.length).toBeLessThan(longInput.length);
    expect(result.summary).toContain('Archived');
  });

  it('compress returns correct metadata', () => {
    const result = strategy.compress(longInput, 3);
    expect(result.metadata).toHaveProperty('levelName', 'workspace');
    expect(result.metadata).toHaveProperty('ratio');
    expect(typeof result.metadata['ratio']).toBe('number');
  });

  it('compress handles empty input', () => {
    const result = strategy.compress('', 1);
    expect(result.originalTokens).toBe(0);
    expect(result.compressedTokens).toBe(0);
    expect(result.summary).toBe('');
  });

  it('compress handles short input gracefully', () => {
    const short = 'Hello world.';
    const result = strategy.compress(short, 1);
    expect(result.summary).toBe(short);
  });

  it('higher levels produce shorter or equal output', () => {
    const lengths: number[] = [];
    for (let level = 1; level <= 5; level++) {
      const result = strategy.compress(longInput, level as CompressionLevel);
      lengths.push(result.summary.length);
    }
    // Generally, higher levels should not produce longer output
    // (level 1 may keep more than level 5)
    expect(lengths[4]).toBeLessThanOrEqual(lengths[0]);
  });
});
