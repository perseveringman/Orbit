// ---------------------------------------------------------------------------
// @orbit/conversation-ui – Normalize pipeline
// AgentMessage[] → RenderableMessage[]
// ---------------------------------------------------------------------------

import type { AgentMessage, AgentToolCall } from '@orbit/agent-core';
import type { RenderableMessage, RenderableToolCall } from './types.js';
import { isReadSearchTool } from './types.js';

export interface NormalizeOptions {
  /** Consecutive tool call grouping threshold (default 2) */
  readonly groupThreshold?: number;
  /** Collapse consecutive Read/Search tools (default true) */
  readonly collapseReadSearch?: boolean;
}

/**
 * Transform a flat AgentMessage[] into a structured RenderableMessage[].
 *
 * Rules:
 * 1. Identity map: each AgentMessage → one RenderableMessage
 * 2. Thinking extraction: assistant metadata.thinking → separate thinking message
 * 3. Tool call pairing: assistant toolCalls + subsequent tool results → merged
 * 4. Grouping: consecutive ≥ threshold tool-use messages → grouped container
 * 5. Read/Search collapse: consecutive read/search tools → collapsed container
 * 6. Streaming injection happens at the component layer (ConversationStream),
 *    NOT in this pipeline.
 */
export function normalizeMessages(
  messages: readonly AgentMessage[],
  options?: NormalizeOptions,
): readonly RenderableMessage[] {
  const threshold = options?.groupThreshold ?? 2;
  const collapse = options?.collapseReadSearch ?? true;

  // Step 1-3: map + extract thinking + pair tool results
  const mapped = mapAndPairMessages(messages);

  // Step 4-5: group and collapse
  return groupAndCollapse(mapped, threshold, collapse);
}

// ---------------------------------------------------------------------------
// Step 1-3: map, extract thinking, pair tool results
// ---------------------------------------------------------------------------

function safeJsonParse(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return { raw: str };
  }
}

function mapToolCall(tc: AgentToolCall, toolResultMap: Map<string, AgentMessage>): RenderableToolCall {
  const resultMsg = toolResultMap.get(tc.id);
  return {
    id: tc.id,
    name: tc.name,
    arguments: safeJsonParse(tc.arguments),
    status: resultMsg
      ? (resultMsg.metadata?.success === false ? 'error' : 'success')
      : 'pending',
    result: resultMsg?.content,
    durationMs: typeof resultMsg?.metadata?.durationMs === 'number' ? resultMsg.metadata.durationMs : undefined,
    errorMessage: resultMsg?.metadata?.success === false ? resultMsg.content : undefined,
  };
}

function mapAndPairMessages(messages: readonly AgentMessage[]): RenderableMessage[] {
  // Build tool result lookup: toolCallId → message
  const toolResultMap = new Map<string, AgentMessage>();
  for (const msg of messages) {
    if (msg.role === 'tool' && msg.toolCallId) {
      toolResultMap.set(msg.toolCallId, msg);
    }
  }

  const result: RenderableMessage[] = [];

  for (const msg of messages) {
    // Skip tool-result messages (already paired above)
    if (msg.role === 'tool') continue;

    // Rule 2: extract thinking from assistant metadata
    if (msg.role === 'assistant' && typeof msg.metadata?.thinking === 'string' && msg.metadata.thinking) {
      result.push({
        id: `${msg.id}_thinking`,
        type: 'assistant-thinking',
        timestamp: msg.timestamp,
        content: msg.metadata.thinking,
        isCollapsed: true,
      });
    }

    // Map the message
    if (msg.role === 'user') {
      const hasImage = typeof msg.metadata?.imageUrl === 'string';
      result.push({
        id: msg.id,
        type: hasImage ? 'user-image' : 'user-text',
        timestamp: msg.timestamp,
        content: msg.content,
        metadata: msg.metadata,
      });
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        // Rule 3: pair tool calls with results
        const toolCalls = msg.toolCalls.map(tc => mapToolCall(tc, toolResultMap));
        result.push({
          id: msg.id,
          type: 'assistant-tool-use',
          timestamp: msg.timestamp,
          content: msg.content,
          toolCalls,
        });
      } else {
        result.push({
          id: msg.id,
          type: 'assistant-text',
          timestamp: msg.timestamp,
          content: msg.content,
          metadata: msg.metadata,
        });
      }
    } else if (msg.role === 'system') {
      const isError = msg.metadata?.isError === true;
      const isPermission = msg.metadata?.isPermissionRequest === true;
      result.push({
        id: msg.id,
        type: isPermission ? 'permission-request' : isError ? 'error' : 'system',
        timestamp: msg.timestamp,
        content: msg.content,
        metadata: msg.metadata,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 4-5: group consecutive tool calls, collapse read/search
// ---------------------------------------------------------------------------

function groupAndCollapse(
  messages: RenderableMessage[],
  threshold: number,
  collapse: boolean,
): RenderableMessage[] {
  const result: RenderableMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i]!;

    // Only try to group/collapse tool-use messages
    if (msg.type === 'assistant-tool-use') {
      // Collect consecutive tool-use messages
      const run: RenderableMessage[] = [msg];
      let j = i + 1;
      while (j < messages.length && messages[j]!.type === 'assistant-tool-use') {
        run.push(messages[j]!);
        j++;
      }

      if (collapse && run.length >= 2 && run.every(m => allToolCallsAreReadSearch(m))) {
        // Rule 5: collapse consecutive read/search
        const allToolCalls = run.flatMap(m => m.toolCalls ?? []);
        result.push({
          id: `collapsed_${run[0]!.id}`,
          type: 'collapsed-read-search',
          timestamp: run[0]!.timestamp,
          content: `读取了 ${allToolCalls.length} 个文件`,
          children: run,
          toolCalls: allToolCalls,
          isCollapsed: true,
        });
      } else if (run.length >= threshold) {
        // Rule 4: group consecutive tool calls
        const allToolCalls = run.flatMap(m => m.toolCalls ?? []);
        result.push({
          id: `grouped_${run[0]!.id}`,
          type: 'grouped-tool-use',
          timestamp: run[0]!.timestamp,
          content: `${allToolCalls.length} 个工具调用`,
          children: run,
          toolCalls: allToolCalls,
          isCollapsed: false,
        });
      } else {
        // Not enough to group, pass through
        result.push(...run);
      }

      i = j;
    } else {
      result.push(msg);
      i++;
    }
  }

  return result;
}

function allToolCallsAreReadSearch(msg: RenderableMessage): boolean {
  if (!msg.toolCalls || msg.toolCalls.length === 0) return false;
  return msg.toolCalls.every(tc => isReadSearchTool(tc.name));
}
