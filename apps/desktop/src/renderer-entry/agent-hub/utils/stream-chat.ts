// ---------------------------------------------------------------------------
// stream-chat – Streaming LLM chat via IPC bridge (OpenAI & Anthropic SSE)
// ---------------------------------------------------------------------------

import {
  getCatalogEntry,
  type ProviderCatalogEntry,
} from '@orbit/agent-core';
import type { LLMProxyRequest } from '../../../shared/contracts';
import type { LLMProviderUserConfig } from '../stores/llm-config-store';

// ---- Types ----

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

// ---- Internal helpers ----

function getDesktopBridge(): any | undefined {
  return (window as any).orbitDesktop;
}

function buildAuthHeaders(
  entry: ProviderCatalogEntry,
  apiKey: string,
): Record<string, string> {
  if (!apiKey) return {};
  if (entry.useBearerAuth) return { Authorization: `Bearer ${apiKey}` };
  if (entry.usesXApiKey || entry.transport === 'anthropic_messages')
    return { 'x-api-key': apiKey };
  return { Authorization: `Bearer ${apiKey}` };
}

// ---- SSE line parser ----

function extractTextDelta(
  jsonStr: string,
  isAnthropic: boolean,
): string {
  if (jsonStr === '[DONE]') return '';
  try {
    const json = JSON.parse(jsonStr) as Record<string, any>;
    if (isAnthropic) {
      // Anthropic: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
      if (json.type === 'content_block_delta' && json.delta?.text) {
        return json.delta.text as string;
      }
      return '';
    }
    // OpenAI: {"choices":[{"delta":{"content":"..."}}]}
    return (json.choices?.[0]?.delta?.content as string) ?? '';
  } catch {
    return '';
  }
}

// ---- Public API ----

/**
 * Start a streaming chat completion via the IPC bridge.
 * Returns a cancel function.
 */
export function startStreamingChat(
  config: LLMProviderUserConfig,
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
): () => void {
  const entry = getCatalogEntry(config.providerId);
  if (!entry) {
    callbacks.onError(`Unknown provider: ${config.providerId}`);
    return () => {};
  }

  const baseUrl = (config.baseUrl || entry.defaultBaseUrl).replace(/\/+$/, '');
  const model = config.defaultModel || entry.defaultModel;
  const isAnthropic = entry.transport === 'anthropic_messages';

  const url = isAnthropic
    ? baseUrl.endsWith('/v1')
      ? `${baseUrl}/messages`
      : `${baseUrl}/v1/messages`
    : `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(entry, config.apiKey),
  };
  if (isAnthropic) {
    headers['anthropic-version'] = '2023-06-01';
  }

  const systemMsgs = messages.filter((m) => m.role === 'system');
  const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

  const body = isAnthropic
    ? JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        ...(systemMsgs.length > 0
          ? { system: systemMsgs.map((m) => m.content).join('\n\n') }
          : {}),
        messages: nonSystemMsgs.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      })
    : JSON.stringify({
        model,
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

  const request: LLMProxyRequest = {
    url,
    method: 'POST',
    headers,
    body,
    timeoutMs: 120_000,
  };

  const streamId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bridge = getDesktopBridge();

  if (!bridge || !bridge.onStreamChunk) {
    callbacks.onError('Desktop bridge 不可用 — 无法发起流式请求');
    return () => {};
  }

  let fullText = '';
  let sseBuffer = '';
  let cancelled = false;

  function processLines(raw: string): void {
    const lines = raw.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      const delta = extractTextDelta(data, isAnthropic);
      if (delta) {
        fullText += delta;
        callbacks.onDelta(delta);
      }
    }
  }

  /** Check if a chunk is a JSON error object sent by the main process. */
  function tryParseMainProcessError(chunk: string): string | null {
    if (!chunk.trim().startsWith('{')) return null;
    try {
      const obj = JSON.parse(chunk) as Record<string, unknown>;
      if (obj.error) {
        const status = obj.status ?? '';
        const statusText = obj.statusText ?? '';
        const body = obj.body ?? obj.message ?? '';
        return `HTTP ${status} ${statusText}: ${String(body).slice(0, 200)}`.trim();
      }
    } catch { /* not JSON, treat as SSE data */ }
    return null;
  }

  const unsub = bridge.onStreamChunk(
    (sid: string, chunk: string, done: boolean) => {
      if (sid !== streamId || cancelled) return;

      if (done) {
        // Check if the final chunk is an error from main process
        if (chunk) {
          const errorMsg = tryParseMainProcessError(chunk);
          if (errorMsg) {
            callbacks.onError(errorMsg);
            unsub();
            return;
          }
          // Process remaining SSE data
          sseBuffer += chunk;
        }
        if (sseBuffer.trim()) processLines(sseBuffer);
        sseBuffer = '';
        callbacks.onDone(fullText);
        unsub();
        return;
      }

      // Check if chunk is a JSON error from main process (non-SSE)
      const errorMsg = tryParseMainProcessError(chunk);
      if (errorMsg) {
        callbacks.onError(errorMsg);
        cancelled = true;
        unsub();
        return;
      }

      sseBuffer += chunk;
      const parts = sseBuffer.split('\n');
      sseBuffer = parts.pop() ?? '';
      if (parts.length > 0) processLines(parts.join('\n'));
    },
  );

  bridge.startStream(streamId, request);

  return () => {
    cancelled = true;
    unsub();
    bridge.cancelStream(streamId);
  };
}

/**
 * Mock streaming – emits characters one at a time with a typewriter effect.
 * Returns a cancel function.
 */
export function startMockStream(
  text: string,
  callbacks: StreamCallbacks,
  charDelayMs = 25,
): () => void {
  let cancelled = false;
  let idx = 0;
  let emitted = '';

  function emitNext(): void {
    if (cancelled) return;
    if (idx >= text.length) {
      callbacks.onDone(emitted);
      return;
    }
    const char = text[idx++];
    emitted += char;
    callbacks.onDelta(char);
    setTimeout(emitNext, charDelayMs);
  }

  // Small initial delay to feel natural
  setTimeout(emitNext, 150);

  return () => {
    cancelled = true;
  };
}
