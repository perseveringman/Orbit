// ---------------------------------------------------------------------------
// @orbit/agent-core – Streaming Accumulator (M11)
// Accumulates streaming chunks and tool-call fragments into coherent state.
// ---------------------------------------------------------------------------

import type { OrbitAgentEvent } from '../events.js';

// ---- Streaming state ----

export interface ToolCallState {
  readonly name: string;
  readonly args: string;
  readonly complete: boolean;
}

export interface StreamingState {
  readonly content: string;
  readonly isStreaming: boolean;
  readonly toolCalls: ReadonlyMap<string, ToolCallState>;
  readonly lastUpdate: number;
}

// ---- StreamingAccumulator ----

export class StreamingAccumulator {
  private content = '';
  private isStreaming = false;
  private toolCalls = new Map<string, ToolCallState>();
  private lastUpdate = 0;

  /** Process a stream event and return updated state. */
  processEvent(event: OrbitAgentEvent): StreamingState {
    this.lastUpdate = event.timestamp;

    switch (event.type) {
      case 'agent:stream-delta':
        this.content += event.delta;
        this.isStreaming = true;
        break;

      case 'agent:tool-call':
        this.toolCalls.set(event.toolCallId, {
          name: event.toolName,
          args: JSON.stringify(event.args),
          complete: false,
        });
        break;

      case 'agent:tool-result': {
        const existing = this.toolCalls.get(event.toolCallId);
        if (existing) {
          this.toolCalls.set(event.toolCallId, {
            ...existing,
            complete: true,
          });
        }
        break;
      }

      case 'agent:completed':
      case 'orchestrator:completed':
        this.isStreaming = false;
        break;

      case 'agent:error':
      case 'orchestrator:error':
        this.isStreaming = false;
        break;

      default:
        break;
    }

    return this.getState();
  }

  /** Get the accumulated content so far. */
  getContent(): string {
    return this.content;
  }

  /** Get the current streaming state snapshot. */
  getState(): StreamingState {
    return {
      content: this.content,
      isStreaming: this.isStreaming,
      toolCalls: new Map(this.toolCalls),
      lastUpdate: this.lastUpdate,
    };
  }

  /** Reset accumulator for a new message. */
  reset(): void {
    this.content = '';
    this.isStreaming = false;
    this.toolCalls.clear();
    this.lastUpdate = 0;
  }

  /** Check if any tool calls are in progress (not yet complete). */
  hasActiveToolCalls(): boolean {
    for (const tc of this.toolCalls.values()) {
      if (!tc.complete) return true;
    }
    return false;
  }
}
