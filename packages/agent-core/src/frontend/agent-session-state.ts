// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Session State (M10)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { OrbitAgentEvent } from '../events.js';
import type { EventBus, Unsubscribe } from './event-bus.js';

// ---- UI message types ----

export interface UIToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly status: 'running' | 'completed' | 'error';
  readonly result?: string;
  readonly durationMs?: number;
}

export interface UIMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly content: string;
  readonly timestamp: number;
  readonly streaming: boolean;
  readonly toolCalls?: readonly UIToolCall[];
  readonly metadata?: Record<string, unknown>;
}

// ---- Session UI state ----

export interface SessionUIState {
  readonly sessionId: string;
  readonly status:
    | 'idle'
    | 'thinking'
    | 'tool-executing'
    | 'streaming'
    | 'waiting-approval'
    | 'error';
  readonly messages: readonly UIMessage[];
  readonly currentToolCalls: readonly UIToolCall[];
  readonly tokenUsage: {
    readonly prompt: number;
    readonly completion: number;
    readonly total: number;
  };
  readonly estimatedCost: number;
  readonly activeAgent?: string;
  readonly error?: string;
}

export type StateChangeListener = (state: SessionUIState) => void;

// ---- Helpers ----

function createInitialState(sessionId: string): SessionUIState {
  return {
    sessionId,
    status: 'idle',
    messages: [],
    currentToolCalls: [],
    tokenUsage: { prompt: 0, completion: 0, total: 0 },
    estimatedCost: 0,
  };
}

// ---- AgentSessionState ----

export class AgentSessionState {
  private state: SessionUIState;
  private readonly changeListeners = new Set<StateChangeListener>();
  private readonly eventBus: EventBus;
  private readonly unsubscribe: Unsubscribe;

  constructor(sessionId: string, eventBus: EventBus) {
    this.state = createInitialState(sessionId);
    this.eventBus = eventBus;

    // Auto-process events that come through the bus
    this.unsubscribe = this.eventBus.onAny((event) => {
      this.processEvent(event);
    });
  }

  /**
   * Get the current immutable state snapshot.
   */
  getState(): SessionUIState {
    return this.state;
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: StateChangeListener): Unsubscribe {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /**
   * Process an OrbitAgentEvent and update UI state accordingly.
   */
  processEvent(event: OrbitAgentEvent): void {
    switch (event.type) {
      // ---- Orchestrator events ----
      case 'orchestrator:started':
        this.update({ status: 'thinking' });
        break;

      case 'orchestrator:completed':
        this.update({
          status: 'idle',
          currentToolCalls: [],
        });
        break;

      case 'orchestrator:error':
        this.update({
          status: 'error',
          error: event.error,
          currentToolCalls: [],
        });
        break;

      case 'orchestrator:cancelled':
        this.update({
          status: 'idle',
          currentToolCalls: [],
        });
        break;

      case 'orchestrator:routed':
        this.update({ activeAgent: event.domain });
        break;

      // ---- Agent events ----
      case 'agent:started':
        this.update({ activeAgent: event.domain });
        break;

      case 'agent:stream-delta': {
        const messages = [...this.state.messages];
        const last = messages[messages.length - 1];

        if (last && last.role === 'assistant' && last.streaming) {
          // Append to the existing streaming message
          messages[messages.length - 1] = {
            ...last,
            content: last.content + event.delta,
          };
        } else {
          // Start a new assistant streaming message
          messages.push({
            id: generateId('msg'),
            role: 'assistant',
            content: event.delta,
            timestamp: event.timestamp,
            streaming: true,
          });
        }
        this.update({ status: 'streaming', messages });
        break;
      }

      case 'agent:tool-call': {
        const toolCall: UIToolCall = {
          id: event.toolCallId,
          name: event.toolName,
          args: event.args,
          status: 'running',
        };
        this.update({
          status: 'tool-executing',
          currentToolCalls: [...this.state.currentToolCalls, toolCall],
        });
        break;
      }

      case 'agent:tool-result': {
        const updatedCalls = this.state.currentToolCalls.map((tc) =>
          tc.id === event.toolCallId
            ? {
                ...tc,
                status: (event.success ? 'completed' : 'error') as UIToolCall['status'],
                result: event.result,
                durationMs: event.durationMs,
              }
            : tc,
        );

        // Determine status: still tool-executing if any calls are still running
        const stillRunning = updatedCalls.some((tc) => tc.status === 'running');
        this.update({
          status: stillRunning ? 'tool-executing' : 'thinking',
          currentToolCalls: updatedCalls,
        });
        break;
      }

      case 'agent:iteration':
        this.update({
          tokenUsage: {
            prompt: event.tokenUsage.promptTokens,
            completion: event.tokenUsage.completionTokens,
            total: event.tokenUsage.totalTokens,
          },
        });
        break;

      case 'agent:completed': {
        // Finalize any streaming assistant message
        const msgs = [...this.state.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.streaming) {
          msgs[msgs.length - 1] = { ...lastMsg, streaming: false };
        } else if (event.responseContent) {
          msgs.push({
            id: generateId('msg'),
            role: 'assistant',
            content: event.responseContent,
            timestamp: event.timestamp,
            streaming: false,
          });
        }
        this.update({ messages: msgs });
        break;
      }

      case 'agent:error':
        this.update({
          status: 'error',
          error: event.error,
        });
        break;

      // ---- Safety events ----
      case 'safety:approval-required':
        this.update({ status: 'waiting-approval' });
        break;

      // Other events are not mapped to state changes
      default:
        break;
    }
  }

  /**
   * Add a user message to the conversation.
   */
  addUserMessage(content: string): void {
    const message: UIMessage = {
      id: generateId('msg'),
      role: 'user',
      content,
      timestamp: Date.now(),
      streaming: false,
    };
    this.update({
      messages: [...this.state.messages, message],
    });
  }

  /**
   * Get a specific message by ID.
   */
  getMessage(id: string): UIMessage | undefined {
    return this.state.messages.find((m) => m.id === id);
  }

  /**
   * Reset session state to initial values.
   */
  reset(): void {
    this.state = createInitialState(this.state.sessionId);
    this.notifyListeners();
  }

  /**
   * Detach from the event bus.
   */
  destroy(): void {
    this.unsubscribe();
    this.changeListeners.clear();
  }

  // ---- Private ----

  private update(partial: Partial<SessionUIState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.changeListeners) {
      listener(this.state);
    }
  }
}
