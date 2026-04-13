// ---------------------------------------------------------------------------
// streaming-scheduler.ts – Orchestrates sentence-splitting, text-chunking,
// and emission-chain to produce a smooth typewriter streaming experience.
// ---------------------------------------------------------------------------

import { EmitChain } from './emit-chain.js';
import { SentenceSplitter, type SentenceSplitterOptions } from './sentence-splitter.js';
import { chunkText, type TextChunkerOptions } from './text-chunker.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StreamingSchedulerOptions {
  /** Enable sentence buffering. Default: true. */
  readonly enableSentenceSplit?: boolean;
  /** Sentence splitter tuning. */
  readonly sentenceSplitter?: SentenceSplitterOptions;
  /** Text chunker tuning. */
  readonly textChunker?: TextChunkerOptions;
  /** Base emit delay (ms). Default: 18. */
  readonly emitDelayMs?: number;
}

export type SchedulerEmitCallback = (text: string) => void;

// ---------------------------------------------------------------------------
// StreamingScheduler
// ---------------------------------------------------------------------------

/**
 * Coordinates the three-stage pipeline:
 *
 * ```
 * raw delta → SentenceSplitter → TextChunker → EmitChain → callback
 * ```
 *
 * Usage:
 * ```ts
 * const scheduler = new StreamingScheduler((text) => {
 *   dispatch({ type: 'STREAM_DELTA', delta: text, timestamp: Date.now() });
 * });
 *
 * // Feed deltas as they arrive from the LLM
 * scheduler.push('你好');
 * scheduler.push('世界！这是一段测试');
 *
 * // When the stream ends, flush remaining buffer
 * await scheduler.flush();
 * scheduler.dispose();
 * ```
 */
export class StreamingScheduler {
  private readonly splitter: SentenceSplitter | null;
  private readonly emitChain: EmitChain<string>;
  private readonly textChunkerOpts: TextChunkerOptions | undefined;
  private readonly enableSentenceSplit: boolean;
  private disposed = false;

  constructor(
    callback: SchedulerEmitCallback,
    options?: StreamingSchedulerOptions,
  ) {
    this.enableSentenceSplit = options?.enableSentenceSplit ?? true;
    this.splitter = this.enableSentenceSplit
      ? new SentenceSplitter(options?.sentenceSplitter)
      : null;
    this.emitChain = new EmitChain<string>(callback, options?.emitDelayMs ?? 18);
    this.textChunkerOpts = options?.textChunker;
  }

  /**
   * Push a text delta from the LLM. The scheduler will buffer, split, chunk,
   * and schedule emission automatically.
   */
  push(delta: string): void {
    if (this.disposed || !delta) return;

    if (this.splitter) {
      // Stage 1: buffer in sentence splitter
      this.splitter.add(delta);
      const sentences = this.splitter.getSentences();
      for (const sentence of sentences) {
        this.enqueueChunked(sentence);
      }
    } else {
      // Sentence splitting disabled – go directly to chunker
      this.enqueueChunked(delta);
    }
  }

  /**
   * Flush any remaining buffered text and wait for the emit chain to drain.
   * Call this when the stream signals completion.
   */
  async flush(): Promise<void> {
    if (this.splitter) {
      const remaining = this.splitter.getRemaining();
      if (remaining) {
        this.enqueueChunked(remaining);
      }
    }
    await this.emitChain.flush();
  }

  /** Clean up. Future push() calls will be ignored. */
  dispose(): void {
    this.disposed = true;
    this.splitter?.reset();
    this.emitChain.dispose();
  }

  // ---- internal ----

  private enqueueChunked(text: string): void {
    const chunks = chunkText(text, this.textChunkerOpts);
    for (const chunk of chunks) {
      this.emitChain.enqueue(chunk.text, { delayMs: chunk.delayMs });
    }
  }
}
