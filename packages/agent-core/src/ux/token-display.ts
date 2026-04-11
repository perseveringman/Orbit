// ---------------------------------------------------------------------------
// @orbit/agent-core – Token Display (M11)
// Human-readable formatting for token counts and cost information.
// ---------------------------------------------------------------------------

import { getModelMetadata } from '../model-metadata.js';

// ---- Display info ----

export interface TokenDisplayInfo {
  readonly promptTokens: string;
  readonly completionTokens: string;
  readonly totalTokens: string;
  readonly estimatedCost: string;
  readonly contextUsage: number; // 0-1
  readonly contextBar: string;
}

// ---- TokenDisplay ----

export class TokenDisplay {
  /** Format token count for display (1234 → "1.2k", 500 → "500"). */
  static formatTokens(count: number): string {
    if (count < 0) return '0';
    if (count < 1000) return String(Math.round(count));
    if (count < 1_000_000) {
      const k = count / 1000;
      return k >= 100 ? `${Math.round(k)}k` : `${parseFloat(k.toFixed(1))}k`;
    }
    const m = count / 1_000_000;
    return `${parseFloat(m.toFixed(1))}M`;
  }

  /** Format cost in USD. */
  static formatCost(usd: number): string {
    if (usd <= 0) return '$0.00';
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    if (usd < 1) return `$${usd.toFixed(3)}`;
    return `$${usd.toFixed(2)}`;
  }

  /** Create context usage bar (default 10 chars wide). */
  static contextBar(used: number, max: number, width = 10): string {
    if (max <= 0) return '░'.repeat(width);
    const ratio = Math.min(used / max, 1);
    const filled = Math.round(ratio * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }

  /** Build full display info from token usage. */
  static getDisplayInfo(
    usage: { promptTokens: number; completionTokens: number; totalTokens: number },
    model?: string,
  ): TokenDisplayInfo {
    const meta = model ? getModelMetadata(model) : undefined;

    // Compute cost
    let cost = 0;
    if (meta) {
      cost =
        (usage.promptTokens / 1_000_000) * meta.costPer1MInput +
        (usage.completionTokens / 1_000_000) * meta.costPer1MOutput;
    }

    const contextWindow = meta?.contextWindow ?? 0;
    const contextUsage = contextWindow > 0 ? Math.min(usage.promptTokens / contextWindow, 1) : 0;

    return {
      promptTokens: TokenDisplay.formatTokens(usage.promptTokens),
      completionTokens: TokenDisplay.formatTokens(usage.completionTokens),
      totalTokens: TokenDisplay.formatTokens(usage.totalTokens),
      estimatedCost: TokenDisplay.formatCost(cost),
      contextUsage,
      contextBar: contextWindow > 0
        ? TokenDisplay.contextBar(usage.promptTokens, contextWindow)
        : '░'.repeat(10),
    };
  }
}
