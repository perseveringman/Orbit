// ---------------------------------------------------------------------------
// @orbit/agent-core – OpenAI-compatible Provider
// ---------------------------------------------------------------------------

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  TokenUsage,
} from '../types.js';
import {
  toOpenAIMessages,
  fromOpenAIResponse,
  toOpenAITools,
} from '../llm-adapter.js';
import type { LLMProvider, ProviderConfig, StreamChunk } from '../llm-provider.js';
import { parseSSEStream } from '../stream-utils.js';
import { RateLimiter, jitteredBackoff } from '../rate-limiter.js';

// ---- Error class ----

export class OpenAIAPIError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly responseBody?: string,
  ) {
    super(message);
    this.name = 'OpenAIAPIError';
  }
}

// ---- OpenAI Provider ----

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  protected readonly config: ProviderConfig;
  protected readonly rateLimiter = new RateLimiter();

  constructor(config: Partial<ProviderConfig> & { apiKey?: string }) {
    this.config = {
      name: config.name ?? 'openai',
      baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
      defaultModel: config.defaultModel ?? 'gpt-4o',
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs ?? 60_000,
      maxRetries: config.maxRetries ?? 2,
      headers: config.headers,
    };
    this.name = this.config.name;
  }

  // ---- Non-streaming completion ----

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const body = this.buildRequestBody(request, false);
    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/chat/completions`,
      body,
    );

    const json = (await response.json()) as Record<string, unknown>;
    return fromOpenAIResponse(json);
  }

  // ---- Streaming completion ----

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk> {
    const body = this.buildRequestBody(request, true);
    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/chat/completions`,
      body,
    );

    for await (const event of parseSSEStream(response)) {
      yield* this.mapOpenAIStreamEvent(event);
    }
  }

  // ---- Internal helpers ----

  protected buildRequestBody(
    request: ChatCompletionRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model || this.config.defaultModel,
      messages: toOpenAIMessages(request.messages),
      stream,
    };

    if (request.tools && request.tools.length > 0) {
      body['tools'] = toOpenAITools(request.tools);
    }
    if (request.temperature !== undefined) {
      body['temperature'] = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      body['max_tokens'] = request.maxTokens;
    }
    if (stream) {
      body['stream_options'] = { include_usage: true };
    }

    return body;
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  protected async fetchWithRetry(
    url: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Rate-limit wait
      const wait = this.rateLimiter.shouldWait(this.name);
      if (wait > 0) {
        await sleep(wait);
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs,
        );

        const response = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Update rate-limit state from headers
        this.rateLimiter.updateFromHeaders(this.name, response.headers);

        if (response.ok) return response;

        const responseText = await response.text().catch(() => '');

        // Retry on 429 and 5xx
        if (response.status === 429 || response.status >= 500) {
          lastError = new OpenAIAPIError(
            `HTTP ${response.status}: ${responseText}`,
            response.status,
            responseText,
          );
          if (attempt < this.config.maxRetries) {
            await sleep(jitteredBackoff(attempt));
            continue;
          }
        }

        throw new OpenAIAPIError(
          `OpenAI API error ${response.status}: ${responseText}`,
          response.status,
          responseText,
        );
      } catch (error) {
        if (error instanceof OpenAIAPIError) throw error;

        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.config.maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error('OpenAI request failed');
  }

  protected *mapOpenAIStreamEvent(
    event: Record<string, unknown>,
  ): Generator<StreamChunk> {
    const choices = event['choices'] as
      | readonly Record<string, unknown>[]
      | undefined;

    if (choices) {
      for (const choice of choices) {
        const delta = choice['delta'] as Record<string, unknown> | undefined;
        const finishReason = choice['finish_reason'] as string | null;

        if (delta) {
          // Text content
          const content = delta['content'] as string | undefined;
          if (content) {
            yield { type: 'text-delta', text: content };
          }

          // Tool calls
          const toolCalls = delta['tool_calls'] as
            | readonly Record<string, unknown>[]
            | undefined;
          if (toolCalls) {
            for (const tc of toolCalls) {
              const fn = tc['function'] as Record<string, unknown> | undefined;
              const tcId = tc['id'] as string | undefined;

              if (tcId && fn?.['name']) {
                yield {
                  type: 'tool-call-start',
                  toolCallId: tcId,
                  name: fn['name'] as string,
                };
              }

              if (fn?.['arguments']) {
                // For delta chunks without id, we need to use index to map
                const id = tcId ?? `tc_${tc['index'] ?? 0}`;
                yield {
                  type: 'tool-call-delta',
                  toolCallId: id,
                  arguments: fn['arguments'] as string,
                };
              }
            }
          }
        }

        if (finishReason) {
          yield { type: 'done', finishReason };
        }
      }
    }

    // Usage info (sent in the final chunk when stream_options.include_usage is set)
    const rawUsage = event['usage'] as Record<string, unknown> | undefined;
    if (rawUsage) {
      const usage: TokenUsage = {
        promptTokens: (rawUsage['prompt_tokens'] as number) ?? 0,
        completionTokens: (rawUsage['completion_tokens'] as number) ?? 0,
        totalTokens: (rawUsage['total_tokens'] as number) ?? 0,
      };
      yield { type: 'usage', usage };
    }
  }
}

// ---- Utility ----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
