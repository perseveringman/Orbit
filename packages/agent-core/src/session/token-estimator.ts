// ---------------------------------------------------------------------------
// @orbit/agent-core – Token Estimator
// ---------------------------------------------------------------------------

import type { AgentMessage } from '../types.js';

/**
 * Lightweight token estimation without external tokeniser dependencies.
 * Uses ~4 chars/token for Latin text, ~2 chars/token for CJK-heavy text.
 */
export class TokenEstimator {
  /** Estimate token count for a plain string. */
  static estimate(text: string): number {
    if (text.length === 0) return 0;
    const charsPerToken = TokenEstimator.hasCJK(text) ? 2 : 4;
    return Math.ceil(text.length / charsPerToken);
  }

  /** Estimate tokens for a single message (content + tool call overhead). */
  static estimateMessage(message: AgentMessage): number {
    let tokens = TokenEstimator.estimate(message.content);
    // Each message has ~4 tokens of framing overhead (role, separators)
    tokens += 4;
    if (message.toolCalls) {
      for (const tc of message.toolCalls) {
        tokens += TokenEstimator.estimate(tc.name);
        tokens += TokenEstimator.estimate(tc.arguments);
        tokens += 3; // overhead per tool call
      }
    }
    return tokens;
  }

  /** Estimate total tokens for an array of messages. */
  static estimateMessages(messages: readonly AgentMessage[]): number {
    return messages.reduce(
      (sum, m) => sum + TokenEstimator.estimateMessage(m),
      0,
    );
  }

  /** Return true if the messages fit within the given token budget. */
  static fitsInBudget(
    messages: readonly AgentMessage[],
    maxTokens: number,
  ): boolean {
    return TokenEstimator.estimateMessages(messages) <= maxTokens;
  }

  /**
   * Detect whether a string contains CJK characters.
   * If ≥20 % of the sampled characters are CJK, treat the whole string as CJK.
   */
  private static hasCJK(text: string): boolean {
    // Sample up to 200 chars to avoid scanning huge strings
    const sample = text.length > 200 ? text.slice(0, 200) : text;
    let cjkCount = 0;
    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i);
      if (
        (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
        (code >= 0x3000 && code <= 0x303f) || // CJK Symbols & Punctuation
        (code >= 0x3040 && code <= 0x309f) || // Hiragana
        (code >= 0x30a0 && code <= 0x30ff) || // Katakana
        (code >= 0xac00 && code <= 0xd7af)    // Hangul Syllables
      ) {
        cjkCount++;
      }
    }
    return cjkCount / sample.length >= 0.2;
  }
}
