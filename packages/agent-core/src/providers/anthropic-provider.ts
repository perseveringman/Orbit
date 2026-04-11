// ---------------------------------------------------------------------------
// @orbit/agent-core – Anthropic Provider
// ---------------------------------------------------------------------------

import type {
  AgentMessage,
  AgentToolCall,
  ChatCompletionChoice,
  ChatCompletionRequest,
  ChatCompletionResponse,
  TokenUsage,
  ToolDefinition,
} from '../types.js';
import { generateId } from '../types.js';
import type { LLMProvider, ProviderConfig, StreamChunk } from '../llm-provider.js';
import { RateLimiter, jitteredBackoff } from '../rate-limiter.js';

// ---- Error class ----

export class AnthropicAPIError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly responseBody?: string,
  ) {
    super(message);
    this.name = 'AnthropicAPIError';
  }
}

// ---- Anthropic Provider ----

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly config: ProviderConfig;
  private readonly rateLimiter = new RateLimiter();

  constructor(config: Partial<ProviderConfig> & { apiKey?: string }) {
    this.config = {
      name: config.name ?? 'anthropic',
      baseUrl: config.baseUrl ?? 'https://api.anthropic.com',
      defaultModel: config.defaultModel ?? 'claude-sonnet-4-20250514',
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs ?? 60_000,
      maxRetries: config.maxRetries ?? 2,
      headers: config.headers,
      useBearerAuth: config.useBearerAuth,
    };
  }

  private messagesUrl(): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    return base.endsWith('/v1')
      ? `${base}/messages`
      : `${base}/v1/messages`;
  }

  // ---- Non-streaming completion ----

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const body = this.buildRequestBody(request, false);
    const response = await this.fetchWithRetry(
      this.messagesUrl(),
      body,
    );

    const json = (await response.json()) as Record<string, unknown>;
    return this.fromAnthropicResponse(json);
  }

  // ---- Streaming completion ----

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk> {
    const body = this.buildRequestBody(request, true);
    const response = await this.fetchWithRetry(
      this.messagesUrl(),
      body,
    );

    yield* this.parseAnthropicStream(response);
  }

  // ---- Request building ----

  private buildRequestBody(
    request: ChatCompletionRequest,
    stream: boolean,
  ): Record<string, unknown> {
    // Anthropic: system is a separate top-level param, not a message
    const systemMessages = request.messages.filter((m) => m.role === 'system');
    const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: request.model || this.config.defaultModel,
      messages: nonSystemMessages.map((m) => this.toAnthropicMessage(m)),
      max_tokens: request.maxTokens ?? 4096,
      stream,
    };

    if (systemMessages.length > 0) {
      body['system'] = systemMessages.map((m) => m.content).join('\n\n');
    }

    if (request.tools && request.tools.length > 0) {
      body['tools'] = request.tools.map((t) => this.toAnthropicTool(t));
    }

    if (request.temperature !== undefined) {
      body['temperature'] = request.temperature;
    }

    return body;
  }

  private toAnthropicMessage(msg: AgentMessage): Record<string, unknown> {
    if (msg.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId ?? '',
            content: msg.content,
          },
        ],
      };
    }

    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const content: Record<string, unknown>[] = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        let input: unknown;
        try {
          input = JSON.parse(tc.arguments);
        } catch {
          input = {};
        }
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input,
        });
      }
      return { role: 'assistant', content };
    }

    return {
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    };
  }

  private toAnthropicTool(tool: ToolDefinition): Record<string, unknown> {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    };
  }

  // ---- Response parsing ----

  private fromAnthropicResponse(
    raw: Record<string, unknown>,
  ): ChatCompletionResponse {
    const content = raw['content'] as readonly Record<string, unknown>[] | undefined;
    const rawUsage = (raw['usage'] ?? {}) as Record<string, unknown>;

    let textContent = '';
    const toolCalls: AgentToolCall[] = [];

    if (content) {
      for (const block of content) {
        if (block['type'] === 'text') {
          textContent += (block['text'] as string) ?? '';
        } else if (block['type'] === 'thinking') {
          // Include thinking in metadata, append to content for now
          textContent += (block['thinking'] as string) ?? '';
        } else if (block['type'] === 'tool_use') {
          toolCalls.push({
            id: (block['id'] as string) ?? generateId('tc'),
            name: (block['name'] as string) ?? '',
            arguments: JSON.stringify(block['input'] ?? {}),
          });
        }
      }
    }

    const stopReason = raw['stop_reason'] as string | undefined;

    const usage: TokenUsage = {
      promptTokens: (rawUsage['input_tokens'] as number) ?? 0,
      completionTokens: (rawUsage['output_tokens'] as number) ?? 0,
      totalTokens:
        ((rawUsage['input_tokens'] as number) ?? 0) +
        ((rawUsage['output_tokens'] as number) ?? 0),
      cacheReadTokens: rawUsage['cache_read_input_tokens'] as number | undefined,
      cacheWriteTokens: rawUsage['cache_creation_input_tokens'] as number | undefined,
    };

    const message: AgentMessage = {
      id: (raw['id'] as string) ?? generateId('msg'),
      role: 'assistant',
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: new Date().toISOString(),
    };

    const finishReason = mapAnthropicStopReason(stopReason);

    const choice: ChatCompletionChoice = { message, finishReason };

    return {
      id: (raw['id'] as string) ?? generateId('resp'),
      choices: [choice],
      usage,
    };
  }

  // ---- Stream parsing ----

  private async *parseAnthropicStream(
    response: Response,
  ): AsyncGenerator<StreamChunk> {
    const body = response.body;
    if (!body) return;

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // Track index → actual tool call ID from content_block_start
    const blockIdMap = new Map<number, string>();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEventType = '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            currentEventType = '';
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEventType = trimmed.slice(6).trim();
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim();
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(payload) as Record<string, unknown>;
            } catch {
              continue;
            }

            yield* this.mapAnthropicEvent(currentEventType, data, blockIdMap);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private *mapAnthropicEvent(
    eventType: string,
    data: Record<string, unknown>,
    blockIdMap: Map<number, string>,
  ): Generator<StreamChunk> {
    switch (eventType) {
      case 'content_block_start': {
        const index = data['index'] as number | undefined;
        const block = data['content_block'] as Record<string, unknown> | undefined;
        if (block?.['type'] === 'tool_use') {
          const toolCallId = (block['id'] as string) ?? '';
          if (index !== undefined) {
            blockIdMap.set(index, toolCallId);
          }
          yield {
            type: 'tool-call-start',
            toolCallId,
            name: (block['name'] as string) ?? '',
          };
        }
        break;
      }

      case 'content_block_delta': {
        const delta = data['delta'] as Record<string, unknown> | undefined;
        if (!delta) break;

        if (delta['type'] === 'text_delta') {
          yield { type: 'text-delta', text: (delta['text'] as string) ?? '' };
        } else if (delta['type'] === 'thinking_delta') {
          yield { type: 'thinking-delta', text: (delta['thinking'] as string) ?? '' };
        } else if (delta['type'] === 'input_json_delta') {
          const index = data['index'] as number | undefined;
          const toolCallId = blockIdMap.get(index ?? 0) ?? `block_${index ?? 0}`;
          yield {
            type: 'tool-call-delta',
            toolCallId,
            arguments: (delta['partial_json'] as string) ?? '',
          };
        }
        break;
      }

      case 'content_block_stop': {
        const index = data['index'] as number | undefined;
        const toolCallId = blockIdMap.get(index ?? 0) ?? `block_${index ?? 0}`;
        yield { type: 'tool-call-end', toolCallId };
        break;
      }

      case 'message_delta': {
        const delta = data['delta'] as Record<string, unknown> | undefined;
        const stopReason = delta?.['stop_reason'] as string | undefined;
        if (stopReason) {
          yield {
            type: 'done',
            finishReason: mapAnthropicStopReason(stopReason) ?? 'stop',
          };
        }

        const rawUsage = data['usage'] as Record<string, unknown> | undefined;
        if (rawUsage) {
          yield {
            type: 'usage',
            usage: {
              promptTokens: 0, // only output tokens available in delta
              completionTokens: (rawUsage['output_tokens'] as number) ?? 0,
              totalTokens: (rawUsage['output_tokens'] as number) ?? 0,
            },
          };
        }
        break;
      }

      case 'message_start': {
        const message = data['message'] as Record<string, unknown> | undefined;
        const rawUsage = message?.['usage'] as Record<string, unknown> | undefined;
        if (rawUsage) {
          yield {
            type: 'usage',
            usage: {
              promptTokens: (rawUsage['input_tokens'] as number) ?? 0,
              completionTokens: (rawUsage['output_tokens'] as number) ?? 0,
              totalTokens:
                ((rawUsage['input_tokens'] as number) ?? 0) +
                ((rawUsage['output_tokens'] as number) ?? 0),
            },
          };
        }
        break;
      }

      // message_stop, ping: no action needed
    }
  }

  // ---- Fetch with retry ----

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...this.config.headers,
    };
    if (this.config.apiKey) {
      if (this.config.useBearerAuth) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      } else {
        headers['x-api-key'] = this.config.apiKey;
      }
    }
    return headers;
  }

  private async fetchWithRetry(
    url: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
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
        this.rateLimiter.updateFromHeaders(this.name, response.headers);

        if (response.ok) return response;

        const responseText = await response.text().catch(() => '');

        if (response.status === 429 || response.status >= 500) {
          lastError = new AnthropicAPIError(
            `HTTP ${response.status}: ${responseText}`,
            response.status,
            responseText,
          );
          if (attempt < this.config.maxRetries) {
            await sleep(jitteredBackoff(attempt));
            continue;
          }
        }

        throw new AnthropicAPIError(
          `Anthropic API error ${response.status}: ${responseText}`,
          response.status,
          responseText,
        );
      } catch (error) {
        if (error instanceof AnthropicAPIError) throw error;

        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.config.maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error('Anthropic request failed');
  }
}

// ---- Helpers ----

function mapAnthropicStopReason(
  reason: string | undefined,
): ChatCompletionChoice['finishReason'] {
  switch (reason) {
    case 'end_turn':
      return 'stop';
    case 'tool_use':
      return 'tool_calls';
    case 'max_tokens':
      return 'length';
    default:
      return 'stop';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
