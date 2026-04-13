// ---------------------------------------------------------------------------
// emit-chain.ts – Promise-based serial emission with micro-delay
// ---------------------------------------------------------------------------
// Inspired by the "Promise 发射链" pattern: ensures strict FIFO ordering of
// text chunks while inserting small delays to give the browser breathing room.
// When the page is hidden, delays are skipped so data accumulates instantly and
// is ready when the user switches back.
// ---------------------------------------------------------------------------

/** Options for a single enqueue call. */
export interface EmitOptions {
  /** Delay in ms before the chunk is emitted. Default: 6. */
  readonly delayMs?: number;
}

/** Callback invoked for each chunk in order. */
export type EmitCallback<T> = (chunk: T) => void;

/**
 * A serial emission queue that delivers chunks one-at-a-time through a
 * Promise chain, inserting configurable micro-delays between them.
 *
 * ```
 * const chain = new EmitChain<string>((text) => dispatch(text));
 * chain.enqueue('Hello');
 * chain.enqueue(' world');
 * await chain.flush();
 * ```
 */
export class EmitChain<T> {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  private flushed = false;
  private readonly callback: EmitCallback<T>;
  private readonly defaultDelayMs: number;

  constructor(callback: EmitCallback<T>, defaultDelayMs = 6) {
    this.callback = callback;
    this.defaultDelayMs = defaultDelayMs;
  }

  /** Number of items still waiting in the queue. */
  get size(): number {
    return this.pending;
  }

  /**
   * Enqueue a chunk. It will be delivered via the callback after all
   * previously queued chunks, with an optional micro-delay in between.
   */
  enqueue(chunk: T, options?: EmitOptions): void {
    if (this.flushed) return;
    this.pending++;
    const delayMs = options?.delayMs ?? this.defaultDelayMs;

    this.chain = this.chain.then(
      () =>
        new Promise<void>((resolve) => {
          const emit = () => {
            this.callback(chunk);
            this.pending--;
            resolve();
          };

          // Skip delay when the page is hidden – no visual benefit,
          // and setTimeout throttling in background tabs would slow things down.
          if (delayMs > 0 && !isPageHidden()) {
            setTimeout(emit, delayMs);
          } else {
            emit();
          }
        }),
    );
  }

  /** Wait for all queued chunks to be delivered. */
  async flush(): Promise<void> {
    await this.chain;
  }

  /** Mark as disposed – future enqueue calls are no-ops. */
  dispose(): void {
    this.flushed = true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}
