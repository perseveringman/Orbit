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
  | { readonly type: 'devtools:get-logs'; readonly filter?: Record<string, unknown> };

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
  | { readonly type: 'error'; readonly message: string };

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
