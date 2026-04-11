import { useCallback, useReducer, useRef } from 'react';
import type { OrbitAgentEvent } from '@orbit/agent-core';
import type { RenderableToolCall, UIStreamingState } from '../types.js';
import { INITIAL_STREAMING_STATE } from '../types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseStreamingStateOptions {
  /** Parse SSE events from raw text chunks. */
  readonly parseSSE?: boolean;
}

export interface UseStreamingStateReturn {
  readonly state: UIStreamingState;
  /** Feed a raw SSE text chunk (from DesktopBridge.onStreamChunk). */
  readonly feedChunk: (chunk: string, done: boolean) => void;
  /** Feed a parsed agent event directly. */
  readonly feedEvent: (event: OrbitAgentEvent) => void;
  /** Reset to initial state. */
  readonly reset: () => void;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type StreamAction =
  | { readonly type: 'STREAM_DELTA'; readonly delta: string; readonly timestamp: number }
  | { readonly type: 'THINKING_DELTA'; readonly delta: string; readonly timestamp: number }
  | { readonly type: 'TOOL_CALL'; readonly toolCall: RenderableToolCall; readonly timestamp: number }
  | {
      readonly type: 'TOOL_RESULT';
      readonly toolCallId: string;
      readonly success: boolean;
      readonly result: string;
      readonly durationMs: number;
      readonly timestamp: number;
    }
  | { readonly type: 'COMPLETED'; readonly timestamp: number }
  | { readonly type: 'ERROR'; readonly timestamp: number }
  | { readonly type: 'START_STREAMING'; readonly timestamp: number }
  | { readonly type: 'RESET' };

function streamReducer(state: UIStreamingState, action: StreamAction): UIStreamingState {
  switch (action.type) {
    case 'STREAM_DELTA':
      return {
        ...state,
        content: state.content + action.delta,
        lastUpdate: action.timestamp,
      };

    case 'THINKING_DELTA':
      return {
        ...state,
        thinking: (state.thinking ?? '') + action.delta,
        lastUpdate: action.timestamp,
      };

    case 'TOOL_CALL':
      return {
        ...state,
        toolCalls: [...state.toolCalls, action.toolCall],
        lastUpdate: action.timestamp,
      };

    case 'TOOL_RESULT':
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.id === action.toolCallId
            ? {
                ...tc,
                status: action.success ? 'success' as const : 'error' as const,
                result: action.result,
                durationMs: action.durationMs,
                errorMessage: action.success ? undefined : action.result,
              }
            : tc,
        ),
        lastUpdate: action.timestamp,
      };

    case 'COMPLETED':
    case 'ERROR':
      return {
        ...state,
        isStreaming: false,
        lastUpdate: action.timestamp,
      };

    case 'START_STREAMING':
      return {
        ...state,
        isStreaming: true,
        lastUpdate: action.timestamp,
      };

    case 'RESET':
      return INITIAL_STREAMING_STATE;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStreamingState(
  _options: UseStreamingStateOptions = {},
): UseStreamingStateReturn {
  const [state, dispatch] = useReducer(streamReducer, INITIAL_STREAMING_STATE);

  // SSE line buffer – chunks may split across SSE boundaries.
  const bufferRef = useRef('');
  // Track whether we've seen the first event (to set isStreaming once).
  const startedRef = useRef(false);

  const ensureStarted = useCallback(
    (timestamp: number) => {
      if (!startedRef.current) {
        startedRef.current = true;
        dispatch({ type: 'START_STREAMING', timestamp });
      }
    },
    [],
  );

  // --- Feed a parsed event directly into the reducer ---
  const feedEvent = useCallback(
    (event: OrbitAgentEvent) => {
      ensureStarted(event.timestamp);

      switch (event.type) {
        case 'agent:stream-delta':
          dispatch({ type: 'STREAM_DELTA', delta: event.delta, timestamp: event.timestamp });
          break;

        case 'agent:thinking-delta':
          dispatch({ type: 'THINKING_DELTA', delta: event.delta, timestamp: event.timestamp });
          break;

        case 'agent:tool-call':
          dispatch({
            type: 'TOOL_CALL',
            toolCall: {
              id: event.toolCallId,
              name: event.toolName,
              arguments: event.args,
              status: 'running',
            },
            timestamp: event.timestamp,
          });
          break;

        case 'agent:tool-result':
          dispatch({
            type: 'TOOL_RESULT',
            toolCallId: event.toolCallId,
            success: event.success,
            result: event.result,
            durationMs: event.durationMs,
            timestamp: event.timestamp,
          });
          break;

        case 'agent:completed':
          dispatch({ type: 'COMPLETED', timestamp: event.timestamp });
          break;

        case 'agent:error':
          dispatch({ type: 'ERROR', timestamp: event.timestamp });
          break;

        default:
          // Ignore unhandled event types (capability, safety, orchestrator, etc.)
          break;
      }
    },
    [ensureStarted],
  );

  // --- Feed a raw SSE text chunk ---
  const feedChunk = useCallback(
    (chunk: string, done: boolean) => {
      bufferRef.current += chunk;

      const lines = bufferRef.current.split('\n');

      // The last element may be an incomplete line – keep it in the buffer.
      bufferRef.current = done ? '' : (lines.pop() ?? '');
      if (done) {
        // Process all remaining lines when the stream signals completion.
        // (lines already contains everything since we didn't pop.)
      }

      for (const line of lines) {
        if (line === '') {
          // SSE event boundary – nothing to do.
          continue;
        }

        if (line.startsWith('data: ')) {
          try {
            const parsed: OrbitAgentEvent = JSON.parse(line.slice(6));
            feedEvent(parsed);
          } catch {
            // Malformed JSON – skip silently.
          }
        }
      }
    },
    [feedEvent],
  );

  // --- Reset ---
  const reset = useCallback(() => {
    bufferRef.current = '';
    startedRef.current = false;
    dispatch({ type: 'RESET' });
  }, []);

  return { state, feedChunk, feedEvent, reset };
}
