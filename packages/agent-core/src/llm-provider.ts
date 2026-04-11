// ---------------------------------------------------------------------------
// @orbit/agent-core – LLM Provider Abstraction & Registry
// ---------------------------------------------------------------------------

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  TokenUsage,
} from './types.js';

// ---- Provider config ----

export interface ProviderConfig {
  readonly name: string;
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly headers?: Readonly<Record<string, string>>;
}

// ---- Stream chunk types ----

export type StreamChunk =
  | { readonly type: 'text-delta'; readonly text: string }
  | { readonly type: 'thinking-delta'; readonly text: string }
  | { readonly type: 'tool-call-start'; readonly toolCallId: string; readonly name: string }
  | { readonly type: 'tool-call-delta'; readonly toolCallId: string; readonly arguments: string }
  | { readonly type: 'tool-call-end'; readonly toolCallId: string }
  | { readonly type: 'usage'; readonly usage: TokenUsage }
  | { readonly type: 'done'; readonly finishReason: string };

// ---- LLM Provider interface ----

/**
 * Unified interface for LLM providers. Supports both full completion
 * and streaming modes.
 */
export interface LLMProvider {
  readonly name: string;

  /**
   * Non-streaming chat completion.
   */
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * Streaming chat completion yielding incremental chunks.
   */
  chatCompletionStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk>;
}

// ---- Provider Registry ----

/**
 * Central registry for managing multiple LLM providers.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, LLMProvider>();
  private defaultName: string | undefined;

  /**
   * Register a provider. The first registered provider becomes the default.
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    if (this.defaultName === undefined) {
      this.defaultName = provider.name;
    }
  }

  /**
   * Get a provider by name.
   */
  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the default provider.
   * @throws if no providers are registered
   */
  getDefault(): LLMProvider {
    if (this.defaultName === undefined) {
      throw new Error('ProviderRegistry: no providers registered');
    }
    const provider = this.providers.get(this.defaultName);
    if (!provider) {
      throw new Error(`ProviderRegistry: default provider "${this.defaultName}" not found`);
    }
    return provider;
  }

  /**
   * List all registered provider names.
   */
  list(): readonly string[] {
    return [...this.providers.keys()];
  }

  /**
   * Set a registered provider as the default.
   * @throws if the named provider is not registered
   */
  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`ProviderRegistry: provider "${name}" not registered`);
    }
    this.defaultName = name;
  }
}
