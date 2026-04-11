// ---------------------------------------------------------------------------
// @orbit/conversation-ui – View model types
// ---------------------------------------------------------------------------

import type { AgentRole } from '@orbit/agent-core';

// ---- Renderable message types ----

export type RenderableMessageType =
  | 'user-text'
  | 'user-image'
  | 'assistant-text'
  | 'assistant-tool-use'
  | 'assistant-thinking'
  | 'grouped-tool-use'
  | 'collapsed-read-search'
  | 'system'
  | 'error'
  | 'permission-request'
  | 'streaming';

export interface RenderableMessage {
  readonly id: string;
  readonly type: RenderableMessageType;
  readonly timestamp: string;
  readonly content: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly toolCalls?: readonly RenderableToolCall[];
  readonly children?: readonly RenderableMessage[];
  readonly isCollapsed?: boolean;
  readonly isStreaming?: boolean;
}

// ---- Tool call view model ----

export interface RenderableToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly status: 'pending' | 'running' | 'success' | 'error';
  readonly result?: string;
  readonly durationMs?: number;
  readonly errorMessage?: string;
}

// ---- Tool categorization ----

export type ToolCategory = 'read' | 'edit' | 'bash' | 'search' | 'other';

const READ_TOOLS = new Set(['Read', 'View']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);
const BASH_TOOLS = new Set(['Bash', 'Execute']);
const SEARCH_TOOLS = new Set(['Grep', 'Glob', 'Search']);

export function getToolCategory(toolName: string): ToolCategory {
  if (READ_TOOLS.has(toolName)) return 'read';
  if (EDIT_TOOLS.has(toolName)) return 'edit';
  if (BASH_TOOLS.has(toolName)) return 'bash';
  if (SEARCH_TOOLS.has(toolName)) return 'search';
  return 'other';
}

export const TOOL_COLORS: Readonly<Record<ToolCategory, { bg: string; text: string; chipColor: string }>> = {
  read:   { bg: 'bg-success-soft', text: 'text-success', chipColor: 'success' },
  edit:   { bg: 'bg-danger-soft', text: 'text-danger', chipColor: 'danger' },
  bash:   { bg: 'bg-warning-soft', text: 'text-warning', chipColor: 'warning' },
  search: { bg: 'bg-accent-soft', text: 'text-accent', chipColor: 'accent' },
  other:  { bg: 'bg-surface-secondary', text: 'text-muted', chipColor: 'default' },
};

// ---- Streaming state (UI-layer, distinct from agent-core StreamingState) ----

/**
 * UI-layer streaming state. `useStreamingState` converts agent-core's
 * `Map<string, ToolCallState>` → `RenderableToolCall[]` and accumulates
 * thinking deltas (which agent-core's StreamingAccumulator does not handle).
 */
export interface UIStreamingState {
  readonly content: string;
  readonly isStreaming: boolean;
  readonly toolCalls: readonly RenderableToolCall[];
  readonly thinking?: string;
  readonly lastUpdate: number;
}

export const INITIAL_STREAMING_STATE: UIStreamingState = {
  content: '',
  isStreaming: false,
  toolCalls: [],
  thinking: undefined,
  lastUpdate: 0,
};

// ---- Session stats ----

export interface SessionStats {
  readonly messageCount: number;
  readonly toolCallCount: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly durationMs: number;
  readonly status: 'active' | 'paused' | 'completed' | 'failed';
}

// ---- Type guards ----

export function isRenderableMessage(value: unknown): value is RenderableMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'content' in value &&
    typeof (value as RenderableMessage).id === 'string' &&
    typeof (value as RenderableMessage).type === 'string' &&
    typeof (value as RenderableMessage).content === 'string'
  );
}

export function isToolUseMessage(msg: RenderableMessage): boolean {
  return msg.type === 'assistant-tool-use' || msg.type === 'grouped-tool-use' || msg.type === 'collapsed-read-search';
}

export function isReadSearchTool(toolName: string): boolean {
  return READ_TOOLS.has(toolName) || SEARCH_TOOLS.has(toolName);
}
