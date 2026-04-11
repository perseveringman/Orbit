// ---------------------------------------------------------------------------
// @orbit/agent-core – LLM Adapter
//
// NOTE: LLMAdapter is superseded by the LLMProvider interface in
// llm-provider.ts, which adds streaming and multi-provider support.
// This file is kept for backward compatibility.
// ---------------------------------------------------------------------------

import type {
  AgentMessage,
  AgentToolCall,
  ChatCompletionChoice,
  ChatCompletionRequest,
  ChatCompletionResponse,
  TokenUsage,
  ToolDefinition,
} from './types.js';
import type { LLMProvider } from './llm-provider.js';

// ---- LLM Adapter interface ----

/**
 * @deprecated Use {@link LLMProvider} instead.
 */
export interface LLMAdapter {
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}

// ---- Compatibility adapter ----

/**
 * Wraps an LLMProvider to satisfy the legacy LLMAdapter interface.
 */
export class LLMAdapterFromProvider implements LLMAdapter {
  constructor(private readonly provider: LLMProvider) {}

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.provider.chatCompletion(request);
  }
}

// ---- Orbit → OpenAI format converters ----

/**
 * Convert Orbit AgentMessages to OpenAI-format message objects.
 */
export function toOpenAIMessages(
  messages: readonly AgentMessage[],
): readonly Record<string, unknown>[] {
  return messages.map((m) => {
    const base: Record<string, unknown> = {
      role: m.role,
      content: m.content,
    };

    if (m.toolCalls && m.toolCalls.length > 0) {
      base['tool_calls'] = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));
    }

    if (m.toolCallId) {
      base['tool_call_id'] = m.toolCallId;
    }

    return base;
  });
}

/**
 * Convert a raw OpenAI-format response object to Orbit ChatCompletionResponse.
 */
export function fromOpenAIResponse(
  response: Record<string, unknown>,
): ChatCompletionResponse {
  const rawChoices = (response['choices'] ?? []) as readonly Record<string, unknown>[];
  const rawUsage = (response['usage'] ?? {}) as Record<string, unknown>;

  const usage: TokenUsage = {
    promptTokens: (rawUsage['prompt_tokens'] as number) ?? 0,
    completionTokens: (rawUsage['completion_tokens'] as number) ?? 0,
    totalTokens: (rawUsage['total_tokens'] as number) ?? 0,
  };

  const choices: ChatCompletionChoice[] = rawChoices.map((c) => {
    const rawMsg = (c['message'] ?? {}) as Record<string, unknown>;
    const rawToolCalls = rawMsg['tool_calls'] as
      | readonly Record<string, unknown>[]
      | undefined;

    const toolCalls: AgentToolCall[] | undefined = rawToolCalls?.map((tc) => {
      const fn = (tc['function'] ?? {}) as Record<string, unknown>;
      return {
        id: (tc['id'] as string) ?? '',
        name: (fn['name'] as string) ?? '',
        arguments: (fn['arguments'] as string) ?? '',
      };
    });

    const message: AgentMessage = {
      id: (response['id'] as string) ?? '',
      role: (rawMsg['role'] as AgentMessage['role']) ?? 'assistant',
      content: (rawMsg['content'] as string) ?? '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      toolCallId: rawMsg['tool_call_id'] as string | undefined,
      timestamp: new Date().toISOString(),
    };

    return {
      message,
      finishReason: (c['finish_reason'] as ChatCompletionChoice['finishReason']) ?? 'stop',
    };
  });

  return {
    id: (response['id'] as string) ?? '',
    choices,
    usage,
  };
}

/**
 * Convert Orbit ToolDefinitions to OpenAI-format tool objects.
 */
export function toOpenAITools(
  definitions: readonly ToolDefinition[],
): readonly Record<string, unknown>[] {
  return definitions.map((d) => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: d.inputSchema,
    },
  }));
}
