// ---------------------------------------------------------------------------
// @orbit/agent-core – Execution Context (M1)
// ---------------------------------------------------------------------------

import type { OrbitAgentEvent } from './events.js';

// ---- Public types ----

export interface ExecutionContext {
  readonly runId: string;
  readonly sessionId: string;
  readonly surface: string;
  readonly signal: AbortSignal;
  readonly emit: (event: OrbitAgentEvent) => void;
}

// ---- Factory ----

export function createExecutionContext(params: {
  runId: string;
  sessionId: string;
  surface: string;
  signal?: AbortSignal;
  onEvent?: (event: OrbitAgentEvent) => void;
}): ExecutionContext {
  return {
    runId: params.runId,
    sessionId: params.sessionId,
    surface: params.surface,
    signal: params.signal ?? new AbortController().signal,
    emit: params.onEvent ?? (() => {}),
  };
}
