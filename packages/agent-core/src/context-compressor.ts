// ---------------------------------------------------------------------------
// @orbit/agent-core – Context Compressor
// ---------------------------------------------------------------------------

import type { AgentMessage } from './types.js';
import { generateId } from './types.js';

// ---- Public types ----

export interface CompressionConfig {
  readonly protectFirstN: number;
  readonly protectLastTokens: number;
  readonly summaryRatio: number;
  readonly maxSummaryTokens: number;
}

export interface CompressionResult {
  readonly compressedMessages: readonly AgentMessage[];
  readonly summaryMessage: AgentMessage;
  readonly originalCount: number;
  readonly compressedCount: number;
  readonly estimatedTokensSaved: number;
}

// ---- Defaults ----

const DEFAULT_CONFIG: CompressionConfig = {
  protectFirstN: 2,
  protectLastTokens: 2000,
  summaryRatio: 0.3,
  maxSummaryTokens: 500,
};

// ---- ContextCompressor ----

export class ContextCompressor {
  private readonly config: CompressionConfig;

  constructor(config?: Partial<CompressionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Rough token estimation: ~4 chars per token (GPT-family heuristic).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Determine whether the message list exceeds the context limit
   * and should be compressed.
   */
  shouldCompress(
    messages: readonly AgentMessage[],
    contextLimit: number,
  ): boolean {
    const totalTokens = messages.reduce(
      (sum, m) => sum + this.estimateTokens(m.content),
      0,
    );
    return totalTokens > contextLimit;
  }

  /**
   * Prune verbose tool results from messages. Replaces tool-result
   * content longer than 500 chars with a truncated version.
   */
  pruneToolResults(
    messages: readonly AgentMessage[],
  ): readonly AgentMessage[] {
    const MAX_TOOL_RESULT = 500;
    return messages.map((m) => {
      if (m.role === 'tool' && m.content.length > MAX_TOOL_RESULT) {
        return {
          ...m,
          content: m.content.slice(0, MAX_TOOL_RESULT) + '\n… [truncated]',
        };
      }
      return m;
    });
  }

  /**
   * Compress a message history:
   * 1. Protect the first N messages (system prompt + first exchange).
   * 2. Protect the most recent messages within the tail token budget.
   * 3. Summarise the middle section via the provided `summarizer` callback.
   */
  async compress(
    messages: readonly AgentMessage[],
    contextLimit: number,
    summarizer: (text: string) => Promise<string>,
  ): Promise<CompressionResult> {
    const pruned = this.pruneToolResults(messages);

    // 1. Head protection
    const head = pruned.slice(0, this.config.protectFirstN);

    // 2. Tail protection – walk backwards until token budget exhausted
    const tailBudget = this.config.protectLastTokens;
    let tailTokens = 0;
    let tailStart = pruned.length;
    for (let i = pruned.length - 1; i >= this.config.protectFirstN; i--) {
      const t = this.estimateTokens(pruned[i].content);
      if (tailTokens + t > tailBudget) break;
      tailTokens += t;
      tailStart = i;
    }
    const tail = pruned.slice(tailStart);

    // 3. Middle section → summarize
    const middle = pruned.slice(this.config.protectFirstN, tailStart);
    const middleTokens = middle.reduce(
      (sum, m) => sum + this.estimateTokens(m.content),
      0,
    );

    let summaryText: string;
    if (middle.length === 0) {
      summaryText = '(no middle section to summarize)';
    } else {
      const middleText = middle
        .map((m) => `[${m.role}] ${m.content}`)
        .join('\n');
      const prompt =
        `Summarize the following conversation turns concisely, ` +
        `preserving key decisions and tool results:\n\n${middleText}`;
      summaryText = await summarizer(prompt);
    }

    const summaryMessage: AgentMessage = {
      id: generateId('sum'),
      role: 'system',
      content: `[Conversation summary]\n${summaryText}`,
      timestamp: new Date().toISOString(),
    };

    const compressedMessages = [...head, summaryMessage, ...tail];

    return {
      compressedMessages,
      summaryMessage,
      originalCount: messages.length,
      compressedCount: compressedMessages.length,
      estimatedTokensSaved: middleTokens - this.estimateTokens(summaryText),
    };
  }
}
