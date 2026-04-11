// ---------------------------------------------------------------------------
// @orbit/agent-core – Model Metadata Catalog
// ---------------------------------------------------------------------------

import type { TokenUsage } from './types.js';

// ---- Model metadata interface ----

export interface ModelMetadata {
  readonly id: string;
  readonly provider: string;
  readonly displayName: string;
  readonly contextWindow: number;
  readonly maxOutput: number;
  readonly costPer1MInput: number;
  readonly costPer1MOutput: number;
  readonly supportsVision: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsFunctionCalling: boolean;
  readonly supportsThinking: boolean;
}

// ---- Curated model catalog ----

export const MODEL_CATALOG = [
  // OpenAI
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    maxOutput: 16_384,
    costPer1MInput: 2.5,
    costPer1MOutput: 10.0,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: false,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128_000,
    maxOutput: 16_384,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.6,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: false,
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    displayName: 'GPT-4 Turbo',
    contextWindow: 128_000,
    maxOutput: 4_096,
    costPer1MInput: 10.0,
    costPer1MOutput: 30.0,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: false,
  },
  {
    id: 'o3-mini',
    provider: 'openai',
    displayName: 'o3-mini',
    contextWindow: 200_000,
    maxOutput: 100_000,
    costPer1MInput: 1.1,
    costPer1MOutput: 4.4,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: true,
  },

  // Anthropic
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200_000,
    maxOutput: 8_192,
    costPer1MInput: 3.0,
    costPer1MOutput: 15.0,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200_000,
    maxOutput: 8_192,
    costPer1MInput: 0.8,
    costPer1MOutput: 4.0,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: false,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
    maxOutput: 8_192,
    costPer1MInput: 3.0,
    costPer1MOutput: 15.0,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: false,
  },
  {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    displayName: 'Claude 3 Opus',
    contextWindow: 200_000,
    maxOutput: 4_096,
    costPer1MInput: 15.0,
    costPer1MOutput: 75.0,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: false,
  },

  // Ollama (local, zero cost)
  {
    id: 'llama3.1',
    provider: 'ollama',
    displayName: 'Llama 3.1',
    contextWindow: 128_000,
    maxOutput: 4_096,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsThinking: false,
  },
  {
    id: 'mistral',
    provider: 'ollama',
    displayName: 'Mistral',
    contextWindow: 32_000,
    maxOutput: 4_096,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: false,
    supportsThinking: false,
  },
] as const satisfies readonly ModelMetadata[];

// ---- Lookup helpers ----

/**
 * Look up metadata for a model by its ID.
 */
export function getModelMetadata(modelId: string): ModelMetadata | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

/**
 * Estimate cost in USD for a given model and token usage.
 * Returns 0 if the model is unknown.
 */
export function estimateCost(model: string, usage: TokenUsage): number {
  const meta = getModelMetadata(model);
  if (!meta) return 0;

  const inputCost = (usage.promptTokens / 1_000_000) * meta.costPer1MInput;
  const outputCost = (usage.completionTokens / 1_000_000) * meta.costPer1MOutput;
  return inputCost + outputCost;
}
