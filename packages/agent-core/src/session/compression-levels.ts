// ---------------------------------------------------------------------------
// @orbit/agent-core – 5-Level Compression (M5 – Wave 2-B)
// ---------------------------------------------------------------------------

// ---- Types ----

export type CompressionLevel = 1 | 2 | 3 | 4 | 5;

export const COMPRESSION_LEVEL_NAMES: Record<CompressionLevel, string> = {
  1: 'turn',
  2: 'session',
  3: 'workspace',
  4: 'lineage',
  5: 'archive',
};

export interface CompressionLevelResult {
  readonly level: CompressionLevel;
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly summary: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CompressionStrategy {
  compress(input: string, level: CompressionLevel): CompressionLevelResult;
  estimateRatio(level: CompressionLevel): number;
}

// ---- Ratio estimates per level (higher level → more aggressive) ----

const LEVEL_RATIOS: Record<CompressionLevel, number> = {
  1: 0.7,  // Turn: light summarization
  2: 0.4,  // Session: moderate reduction
  3: 0.25, // Workspace: cross-session condensation
  4: 0.15, // Lineage: session-chain distillation
  5: 0.08, // Archive: maximum compression for long-term storage
};

// ---- Token estimation (simple char-based, matching TokenEstimator approach) ----

function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  // CJK chars count as ~0.5 tokens each, ASCII ~0.25
  let cjk = 0;
  let ascii = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x2e80) cjk++;
    else ascii++;
  }
  return Math.ceil(cjk / 2 + ascii / 4);
}

// ---- Compression helpers per level ----

function compressTurn(input: string): string {
  // Level 1: Trim individual turn, keep key sentences
  const sentences = input.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  if (sentences.length <= 3) return input;
  // Keep first, last, and longest sentence
  const sorted = [...sentences].sort((a, b) => b.length - a.length);
  const kept = new Set([sentences[0], sentences[sentences.length - 1], sorted[0]]);
  return [...kept].join(' ');
}

function compressSession(input: string): string {
  // Level 2: Summarise a full session
  const lines = input.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 5) return input;
  // Keep first 2 and last 2 lines plus a count note
  const head = lines.slice(0, 2);
  const tail = lines.slice(-2);
  const omitted = lines.length - 4;
  return [...head, `[…${omitted} lines omitted…]`, ...tail].join('\n');
}

function compressWorkspace(input: string): string {
  // Level 3: Cross-session workspace summary
  const lines = input.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 3) return input;
  const head = lines.slice(0, 1);
  const tail = lines.slice(-1);
  const omitted = lines.length - 2;
  return [...head, `[…${omitted} lines condensed…]`, ...tail].join('\n');
}

function compressLineage(input: string): string {
  // Level 4: Distil a session chain
  const lines = input.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 2) return input;
  return `[Lineage summary: ${lines.length} entries] ${lines[0]}`;
}

function compressArchive(input: string): string {
  // Level 5: Maximum archival compression
  const tokens = estimateTokens(input);
  const firstLine = input.split('\n')[0] ?? '';
  return `[Archived: ~${tokens} tokens] ${firstLine.slice(0, 120)}`;
}

const COMPRESSORS: Record<CompressionLevel, (input: string) => string> = {
  1: compressTurn,
  2: compressSession,
  3: compressWorkspace,
  4: compressLineage,
  5: compressArchive,
};

// ---- Factory ----

export function createCompressionStrategy(): CompressionStrategy {
  function compress(input: string, level: CompressionLevel): CompressionLevelResult {
    const originalTokens = estimateTokens(input);
    const compressor = COMPRESSORS[level];
    const summary = compressor(input);
    const compressedTokens = estimateTokens(summary);

    return {
      level,
      originalTokens,
      compressedTokens,
      summary,
      metadata: {
        levelName: COMPRESSION_LEVEL_NAMES[level],
        ratio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      },
    };
  }

  function estimateRatio(level: CompressionLevel): number {
    return LEVEL_RATIOS[level];
  }

  return { compress, estimateRatio };
}
