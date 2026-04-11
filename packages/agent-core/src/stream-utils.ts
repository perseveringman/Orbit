// ---------------------------------------------------------------------------
// @orbit/agent-core – SSE Stream Utilities
// ---------------------------------------------------------------------------

import type {
  AgentMessage,
  AgentToolCall,
  ChatCompletionChoice,
  ChatCompletionResponse,
  TokenUsage,
} from './types.js';
import { generateId } from './types.js';
import type { StreamChunk } from './llm-provider.js';

// ---- SSE parser ----

/**
 * Parse a ReadableStream of SSE events from a fetch Response.
 * Yields parsed JSON objects for each `data:` line (skips `[DONE]`).
 */
export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;

          try {
            yield JSON.parse(payload) as Record<string, unknown>;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data:')) {
        const payload = trimmed.slice(5).trim();
        if (payload !== '[DONE]') {
          try {
            yield JSON.parse(payload) as Record<string, unknown>;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---- Stream collector ----

/**
 * Collect a stream of StreamChunks into a complete ChatCompletionResponse.
 */
export async function collectStreamToResponse(
  chunks: AsyncIterable<StreamChunk>,
): Promise<ChatCompletionResponse> {
  let textContent = '';
  let finishReason: ChatCompletionChoice['finishReason'] = 'stop';
  const toolCalls = new Map<string, { id: string; name: string; arguments: string }>();
  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  for await (const chunk of chunks) {
    switch (chunk.type) {
      case 'text-delta':
        textContent += chunk.text;
        break;
      case 'tool-call-start':
        toolCalls.set(chunk.toolCallId, {
          id: chunk.toolCallId,
          name: chunk.name,
          arguments: '',
        });
        break;
      case 'tool-call-delta': {
        const tc = toolCalls.get(chunk.toolCallId);
        if (tc) tc.arguments += chunk.arguments;
        break;
      }
      case 'usage':
        usage = chunk.usage;
        break;
      case 'done':
        finishReason = chunk.finishReason as ChatCompletionChoice['finishReason'];
        break;
      // tool-call-end, thinking-delta: no aggregation needed
    }
  }

  const toolCallArray: AgentToolCall[] = [...toolCalls.values()];

  const message: AgentMessage = {
    id: generateId('msg'),
    role: 'assistant',
    content: textContent,
    toolCalls: toolCallArray.length > 0 ? toolCallArray : undefined,
    timestamp: new Date().toISOString(),
  };

  const choice: ChatCompletionChoice = {
    message,
    finishReason: toolCallArray.length > 0 ? 'tool_calls' : finishReason,
  };

  return {
    id: generateId('resp'),
    choices: [choice],
    usage,
  };
}
