// ---------------------------------------------------------------------------
// @orbit/agent-core – IPC Protocol (M10)
// ---------------------------------------------------------------------------

import type { OrbitAgentEvent } from '../events.js';
import type { Unsubscribe } from './event-bus.js';

// ---- Frontend → Agent messages ----

export type FrontendMessage =
  | { readonly type: 'agent:send'; readonly sessionId: string; readonly content: string }
  | { readonly type: 'agent:cancel'; readonly sessionId: string }
  | { readonly type: 'agent:approve'; readonly requestId: string; readonly approved: boolean }
  | { readonly type: 'agent:retry'; readonly sessionId: string }
  | { readonly type: 'agent:fork'; readonly sessionId: string }
  | { readonly type: 'session:create'; readonly surface: string }
  | { readonly type: 'session:list' }
  | { readonly type: 'health:check' }
  | { readonly type: 'devtools:get-trace'; readonly traceId: string }
  | { readonly type: 'devtools:get-metrics' }
  | { readonly type: 'devtools:get-logs'; readonly filter?: Record<string, unknown> }
  // Skills messages
  | { readonly type: 'skill:list' }
  | { readonly type: 'skill:install'; readonly url: string }
  | { readonly type: 'skill:uninstall'; readonly skillId: string }
  | { readonly type: 'skill:enable'; readonly skillId: string }
  | { readonly type: 'skill:disable'; readonly skillId: string }
  // MCP messages
  | { readonly type: 'mcp:list' }
  | { readonly type: 'mcp:install'; readonly url: string }
  | { readonly type: 'mcp:uninstall'; readonly serverId: string }
  | { readonly type: 'mcp:connect'; readonly serverId: string }
  | { readonly type: 'mcp:disconnect'; readonly serverId: string }
  // Role messages
  | { readonly type: 'role:list' }
  | { readonly type: 'role:create'; readonly input: Record<string, unknown> }
  | { readonly type: 'role:update'; readonly roleId: string; readonly patch: Record<string, unknown> }
  | { readonly type: 'role:delete'; readonly roleId: string }
  // Team messages
  | { readonly type: 'team:create'; readonly input: Record<string, unknown> }
  | { readonly type: 'team:list' }
  | { readonly type: 'team:execute'; readonly teamId: string; readonly task: string }
  | { readonly type: 'team:delete'; readonly teamId: string }
  // Tool messages
  | { readonly type: 'tool:list' }
  | { readonly type: 'tool:execute'; readonly toolName: string; readonly args: Record<string, unknown> };

// ---- Agent → Frontend messages ----

export type BackendMessage =
  | { readonly type: 'agent:event'; readonly event: OrbitAgentEvent }
  | { readonly type: 'session:created'; readonly sessionId: string }
  | {
      readonly type: 'session:list-result';
      readonly sessions: readonly { readonly id: string; readonly surface: string; readonly createdAt: number }[];
    }
  | {
      readonly type: 'health:result';
      readonly status: string;
      readonly checks: readonly Record<string, unknown>[];
    }
  | { readonly type: 'devtools:trace-result'; readonly spans: readonly Record<string, unknown>[] }
  | { readonly type: 'devtools:metrics-result'; readonly metrics: Record<string, unknown> }
  | { readonly type: 'devtools:logs-result'; readonly entries: readonly Record<string, unknown>[] }
  | { readonly type: 'error'; readonly message: string }
  // Skills results
  | { readonly type: 'skill:list-result'; readonly skills: readonly Record<string, unknown>[] }
  | { readonly type: 'skill:install-result'; readonly success: boolean; readonly skillId?: string; readonly error?: string }
  // MCP results
  | { readonly type: 'mcp:list-result'; readonly servers: readonly Record<string, unknown>[] }
  | { readonly type: 'mcp:install-result'; readonly success: boolean; readonly serverId?: string; readonly error?: string }
  // Role results
  | { readonly type: 'role:list-result'; readonly roles: readonly Record<string, unknown>[] }
  | { readonly type: 'role:created'; readonly roleId: string }
  // Team results
  | { readonly type: 'team:list-result'; readonly teams: readonly Record<string, unknown>[] }
  | { readonly type: 'team:created'; readonly teamId: string }
  | { readonly type: 'team:execution-result'; readonly result: Record<string, unknown> }
  // Tool results
  | { readonly type: 'tool:list-result'; readonly tools: readonly Record<string, unknown>[] }
  | { readonly type: 'tool:execution-result'; readonly result: Record<string, unknown> };

// ---- Transport interface ----

export interface MessageTransport {
  send(message: BackendMessage): void;
  onMessage(handler: (message: FrontendMessage) => void): Unsubscribe;
}

// ---- In-memory transport (for testing) ----

export class InMemoryTransport implements MessageTransport {
  private readonly handlers = new Set<(message: FrontendMessage) => void>();
  readonly sentMessages: BackendMessage[] = [];

  send(message: BackendMessage): void {
    this.sentMessages.push(message);
  }

  onMessage(handler: (message: FrontendMessage) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Simulate receiving a message from the frontend.
   */
  simulateMessage(message: FrontendMessage): void {
    for (const handler of this.handlers) {
      handler(message);
    }
  }
}
