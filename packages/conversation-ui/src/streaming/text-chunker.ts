// ---------------------------------------------------------------------------
// text-chunker.ts – Break large text deltas into smaller visual chunks
// ---------------------------------------------------------------------------
// When the backend pushes a large text delta (e.g. 50+ characters in one
// event), rendering it all at once defeats the typewriter illusion. This
// module splits long text into fixed-size groups so the emit chain can deliver
// them with inter-chunk delays, recreating natural typing rhythm.
// ---------------------------------------------------------------------------

export interface TextChunkerOptions {
  /** Deltas shorter than this are emitted as-is. Default: 6. */
  readonly thresholdLength?: number;
  /** Characters per chunk when splitting. Default: 2. */
  readonly chunkSize?: number;
  /** Delay between chunks (ms). Default: 20. */
  readonly chunkDelayMs?: number;
}

const DEFAULT_THRESHOLD = 6;
const DEFAULT_CHUNK_SIZE = 2;
const DEFAULT_CHUNK_DELAY = 20;

export interface TextChunk {
  readonly text: string;
  readonly delayMs: number;
}

/**
 * Split a text delta into an array of `TextChunk` objects.
 *
 * Short text (≤ threshold) → single chunk with base delay.
 * Long text (> threshold) → multiple chunks with inter-chunk delay.
 */
export function chunkText(
  text: string,
  options?: TextChunkerOptions,
): TextChunk[] {
  const threshold = options?.thresholdLength ?? DEFAULT_THRESHOLD;
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkDelay = options?.chunkDelayMs ?? DEFAULT_CHUNK_DELAY;

  if (text.length <= threshold) {
    return [{ text, delayMs: chunkDelay }];
  }

  const chunks: TextChunk[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push({
      text: text.slice(i, i + chunkSize),
      delayMs: chunkDelay,
    });
  }
  return chunks;
}
