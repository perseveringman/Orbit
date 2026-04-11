// ---------------------------------------------------------------------------
// @orbit/agent-core – Compression Engine (M5)
// ---------------------------------------------------------------------------

import type { AgentMessage } from '../types.js';
import { generateId } from '../types.js';
import { TokenEstimator } from './token-estimator.js';

// ---- Public types ----

export interface CompressionStrategy {
  readonly name: string;
  readonly description: string;
  compress(
    messages: readonly AgentMessage[],
    options: CompressionOptions,
  ): CompressionResult;
}

export interface CompressionOptions {
  readonly targetTokens: number;
  readonly preserveHead: number;
  readonly preserveTail: number;
  readonly preserveToolResults: boolean;
}

export interface CompressionResult {
  readonly messages: readonly AgentMessage[];
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly ratio: number;
  readonly strategy: string;
  readonly removedCount: number;
  readonly summary?: string;
}

// ---- Helpers ----

function buildResult(
  original: readonly AgentMessage[],
  kept: readonly AgentMessage[],
  strategy: string,
  summary?: string,
): CompressionResult {
  const originalTokens = TokenEstimator.estimateMessages(original);
  const compressedTokens = TokenEstimator.estimateMessages(kept);
  return {
    messages: kept,
    originalTokens,
    compressedTokens,
    ratio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
    strategy,
    removedCount: original.length - kept.length,
    summary,
  };
}

// ---- Strategy 1: Head / Tail ----

export class HeadTailStrategy implements CompressionStrategy {
  readonly name = 'head-tail';
  readonly description = 'Keep first and last messages, compress middle';

  compress(
    messages: readonly AgentMessage[],
    options: CompressionOptions,
  ): CompressionResult {
    if (messages.length === 0) {
      return buildResult(messages, [], this.name);
    }

    const head = messages.slice(0, options.preserveHead);
    const tail = messages.slice(
      Math.max(options.preserveHead, messages.length - options.preserveTail),
    );

    // If head+tail already covers everything, nothing to compress
    if (head.length + tail.length >= messages.length) {
      return buildResult(messages, [...messages], this.name);
    }

    const middle = messages.slice(options.preserveHead, messages.length - options.preserveTail);

    // Build a short summary of the compressed middle
    const summaryText = `[Compressed ${middle.length} messages]`;
    const summaryMsg: AgentMessage = {
      id: generateId('cmp'),
      role: 'system',
      content: summaryText,
      timestamp: new Date().toISOString(),
    };

    let kept: AgentMessage[] = [...head, summaryMsg, ...tail];

    // If we still exceed budget, trim from the middle-adjacent tail
    if (
      TokenEstimator.estimateMessages(kept) > options.targetTokens &&
      kept.length > options.preserveHead + 1 + options.preserveTail
    ) {
      // Already minimal — return what we have
    }

    // Optionally preserve tool results from the middle
    if (options.preserveToolResults) {
      const toolResults = middle.filter((m) => m.role === 'tool');
      if (toolResults.length > 0) {
        kept = [...head, ...toolResults, summaryMsg, ...tail];
      }
    }

    return buildResult(messages, kept, this.name, summaryText);
  }
}

// ---- Strategy 2: Importance-based ----

export class ImportanceStrategy implements CompressionStrategy {
  readonly name = 'importance';
  readonly description =
    'Keep important messages (user, tool results), compress reasoning';

  compress(
    messages: readonly AgentMessage[],
    options: CompressionOptions,
  ): CompressionResult {
    if (messages.length === 0) {
      return buildResult(messages, [], this.name);
    }

    const head = messages.slice(0, options.preserveHead);
    const tail = messages.slice(
      Math.max(options.preserveHead, messages.length - options.preserveTail),
    );

    if (head.length + tail.length >= messages.length) {
      return buildResult(messages, [...messages], this.name);
    }

    const middleStart = options.preserveHead;
    const middleEnd = messages.length - options.preserveTail;
    const middle = messages.slice(middleStart, middleEnd);

    // Score and sort middle messages by importance (descending)
    const scored = middle.map((m, idx) => ({
      message: m,
      score: this.scoreImportance(m, middleStart + idx, messages.length),
    }));
    scored.sort((a, b) => b.score - a.score);

    // Greedily add important messages until budget is reached
    const headTailTokens =
      TokenEstimator.estimateMessages(head) +
      TokenEstimator.estimateMessages(tail);
    let budget = options.targetTokens - headTailTokens;
    // Reserve a small amount for a summary marker
    budget -= 20;

    const keptMiddle: Array<{ message: AgentMessage; originalIndex: number }> = [];
    for (const s of scored) {
      const mt = TokenEstimator.estimateMessage(s.message);
      if (budget - mt >= 0) {
        const originalIndex = messages.indexOf(s.message);
        keptMiddle.push({ message: s.message, originalIndex });
        budget -= mt;
      }
    }

    // Restore original order for the kept middle messages
    keptMiddle.sort((a, b) => a.originalIndex - b.originalIndex);

    const removedCount = middle.length - keptMiddle.length;
    const summaryText =
      removedCount > 0
        ? `[Compressed ${removedCount} low-importance messages]`
        : undefined;

    const kept: AgentMessage[] = [...head];
    if (summaryText) {
      kept.push({
        id: generateId('cmp'),
        role: 'system',
        content: summaryText,
        timestamp: new Date().toISOString(),
      });
    }
    kept.push(...keptMiddle.map((k) => k.message));
    kept.push(...tail);

    return buildResult(messages, kept, this.name, summaryText);
  }

  private scoreImportance(
    message: AgentMessage,
    index: number,
    total: number,
  ): number {
    let score: number;

    switch (message.role) {
      case 'user':
        score = 1.0;
        break;
      case 'tool':
        score = 0.8;
        break;
      case 'assistant':
        score = message.toolCalls && message.toolCalls.length > 0 ? 0.7 : 0.3;
        break;
      case 'system':
        score = 0.9;
        break;
      default:
        score = 0.5;
    }

    // Recency boost: last 20 % of messages get +0.3
    if (index >= total * 0.8) {
      score += 0.3;
    }

    return score;
  }
}

// ---- Strategy 3: Sliding Window ----

export class SlidingWindowStrategy implements CompressionStrategy {
  readonly name = 'sliding-window';
  readonly description = 'Keep the most recent messages within token budget';

  compress(
    messages: readonly AgentMessage[],
    options: CompressionOptions,
  ): CompressionResult {
    if (messages.length === 0) {
      return buildResult(messages, [], this.name);
    }

    const head = messages.slice(0, options.preserveHead);
    const headTokens = TokenEstimator.estimateMessages(head);

    // Walk backwards from the end to fill the remaining budget
    let budget = options.targetTokens - headTokens;
    const window: AgentMessage[] = [];

    for (let i = messages.length - 1; i >= options.preserveHead; i--) {
      const mt = TokenEstimator.estimateMessage(messages[i]);
      if (budget - mt < 0) break;
      window.unshift(messages[i]);
      budget -= mt;
    }

    const kept = [...head, ...window];
    return buildResult(messages, kept, this.name);
  }
}

// ---- Compression Engine ----

export class CompressionEngine {
  private readonly strategies = new Map<string, CompressionStrategy>();

  constructor() {
    // Register built-in strategies
    this.addStrategy(new HeadTailStrategy());
    this.addStrategy(new ImportanceStrategy());
    this.addStrategy(new SlidingWindowStrategy());
  }

  addStrategy(strategy: CompressionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Compress using a named strategy or auto-select based on message count.
   */
  compress(
    messages: readonly AgentMessage[],
    options: CompressionOptions & { strategy?: string },
  ): CompressionResult {
    const { strategy: strategyName, ...compressOpts } = options;

    const strategy = strategyName
      ? this.strategies.get(strategyName)
      : this.selectStrategy(messages.length);

    if (!strategy) {
      throw new Error(`Unknown compression strategy: ${strategyName}`);
    }

    return strategy.compress(messages, compressOpts);
  }

  /**
   * Auto-select:
   * - ≤10 messages → sliding-window (simple, effective)
   * - 11–50 messages → head-tail
   * - >50 messages → importance (more sophisticated filtering)
   */
  private selectStrategy(messageCount: number): CompressionStrategy {
    if (messageCount <= 10) {
      return this.strategies.get('sliding-window')!;
    }
    if (messageCount <= 50) {
      return this.strategies.get('head-tail')!;
    }
    return this.strategies.get('importance')!;
  }

  listStrategies(): readonly string[] {
    return [...this.strategies.keys()];
  }
}

/** Create a CompressionEngine pre-loaded with the three built-in strategies. */
export function createDefaultCompressionEngine(): CompressionEngine {
  return new CompressionEngine();
}
