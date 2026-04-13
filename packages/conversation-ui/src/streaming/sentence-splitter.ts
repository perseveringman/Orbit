// ---------------------------------------------------------------------------
// sentence-splitter.ts – Semantic sentence buffering for streaming text
// ---------------------------------------------------------------------------
// AI models push text token-by-token. Rendering each token individually causes
// a jittery "flicker" effect. This class buffers incoming text and releases it
// in sentence-sized chunks aligned to natural punctuation boundaries, producing
// a smoother reading experience.
//
// Supports both Chinese (。！？) and Western (.!?) punctuation. A configurable
// minimum buffer length (default 20 chars) prevents releasing very short
// fragments.
// ---------------------------------------------------------------------------

export interface SentenceSplitterOptions {
  /** Minimum characters before attempting to split. Default: 20. */
  readonly minBufferLength?: number;
  /** Minimum characters per output sentence. Default: 20. */
  readonly minSentenceLength?: number;
}

const DEFAULT_MIN_BUFFER = 20;
const DEFAULT_MIN_SENTENCE = 20;

// Punctuation that signals a sentence boundary.
const SENTENCE_BOUNDARY = /([。！!?？\n.;；])/;

export class SentenceSplitter {
  private buffer = '';
  private readonly minBuffer: number;
  private readonly minSentence: number;

  constructor(options?: SentenceSplitterOptions) {
    this.minBuffer = options?.minBufferLength ?? DEFAULT_MIN_BUFFER;
    this.minSentence = options?.minSentenceLength ?? DEFAULT_MIN_SENTENCE;
  }

  /** Append incoming text to the internal buffer. */
  add(text: string): void {
    this.buffer += text;
  }

  /**
   * Attempt to extract complete sentences from the buffer.
   * Returns an array of sentence strings (may be empty if not enough text has
   * accumulated). Incomplete trailing text is kept in the buffer.
   */
  getSentences(): string[] {
    if (this.buffer.length < this.minBuffer) return [];

    const parts = this.buffer.split(SENTENCE_BOUNDARY).filter(Boolean);
    if (parts.length <= 1) {
      // No sentence boundary found – keep buffering.
      return [];
    }

    const sentences = this.combineParts(parts);
    // The last part is likely an incomplete sentence – keep it.
    this.buffer = sentences.pop() ?? '';
    return sentences;
  }

  /** Return whatever text remains in the buffer and clear it. */
  getRemaining(): string {
    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }

  /** Peek at the current buffer without consuming. */
  peek(): string {
    return this.buffer;
  }

  /** Reset the splitter state. */
  reset(): void {
    this.buffer = '';
  }

  // ---- internal ----

  /**
   * Re-join split parts so that each output string is at least
   * `minSentence` characters long and ends on a boundary character.
   */
  private combineParts(parts: string[]): string[] {
    const combined: string[] = [];
    let current = '';
    for (const part of parts) {
      current += part;
      if (current.length >= this.minSentence && SENTENCE_BOUNDARY.test(current.slice(-1))) {
        combined.push(current);
        current = '';
      }
    }
    // Push any leftover (incomplete sentence or short tail).
    if (current.length > 0) {
      combined.push(current);
    }
    return combined;
  }
}
