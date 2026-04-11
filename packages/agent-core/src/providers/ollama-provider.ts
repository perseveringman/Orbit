// ---------------------------------------------------------------------------
// @orbit/agent-core – Ollama Provider (OpenAI-compatible)
// ---------------------------------------------------------------------------

import type { ProviderConfig } from '../llm-provider.js';
import { OpenAIProvider } from './openai-provider.js';

// ---- Ollama Provider ----

/**
 * Provider for local Ollama instances.
 * Ollama exposes an OpenAI-compatible API at /v1, so we extend
 * OpenAIProvider with Ollama-specific defaults.
 */
export class OllamaProvider extends OpenAIProvider {
  constructor(config?: Partial<ProviderConfig>) {
    super({
      name: 'ollama',
      baseUrl: config?.baseUrl ?? 'http://localhost:11434/v1',
      defaultModel: config?.defaultModel ?? 'llama3.1',
      timeoutMs: config?.timeoutMs ?? 120_000, // local models can be slower
      maxRetries: config?.maxRetries ?? 1,
      headers: config?.headers,
      // No API key needed for local Ollama
    });
  }
}
