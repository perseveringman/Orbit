// ---------------------------------------------------------------------------
// @orbit/agent-core – Progress Tracker (M11)
// Transforms raw agent events into user-friendly progress states.
// ---------------------------------------------------------------------------

import type { OrbitAgentEvent } from '../events.js';

// ---- Progress phase ----

export type ProgressPhase =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'reviewing'
  | 'responding'
  | 'done'
  | 'error';

// ---- Progress state ----

export interface ProgressState {
  readonly phase: ProgressPhase;
  readonly message: string;
  readonly detail?: string;
  readonly icon: string;
  readonly progress: number; // 0-1
  readonly elapsed: number; // ms since start
  readonly toolName?: string;
  readonly iterationInfo?: {
    readonly current: number;
    readonly max: number;
  };
}

// ---- Phase → user message mapping ----

export const PHASE_MESSAGES: Record<ProgressPhase, { readonly message: string; readonly icon: string }> = {
  idle: { message: '等待输入...', icon: '💤' },
  thinking: { message: '正在思考...', icon: '🧠' },
  planning: { message: '正在规划方案...', icon: '📋' },
  executing: { message: '正在执行工具...', icon: '⚡' },
  reviewing: { message: '正在审查结果...', icon: '🔍' },
  responding: { message: '正在生成回复...', icon: '✍️' },
  done: { message: '完成', icon: '✅' },
  error: { message: '出现错误', icon: '❌' },
};

// Weight of each phase in the overall 0-1 progress bar
export const PHASE_PROGRESS: Record<ProgressPhase, number> = {
  idle: 0,
  thinking: 0.1,
  planning: 0.2,
  executing: 0.4,
  reviewing: 0.7,
  responding: 0.85,
  done: 1,
  error: 1,
};

// ---- ProgressTracker ----

export class ProgressTracker {
  private startTime = 0;
  private currentPhase: ProgressPhase = 'idle';
  private listeners = new Set<(state: ProgressState) => void>();
  private iteration = 0;
  private maxIterations = 15;
  private toolName?: string;
  private detail?: string;

  /** Subscribe to progress updates. Returns an unsubscribe function. */
  onUpdate(listener: (state: ProgressState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Process an agent event and derive the new progress state. */
  processEvent(event: OrbitAgentEvent): ProgressState {
    if (this.startTime === 0) {
      this.startTime = event.timestamp;
    }

    switch (event.type) {
      case 'orchestrator:started':
        this.setPhase('thinking');
        this.detail = undefined;
        this.toolName = undefined;
        break;

      case 'orchestrator:routed':
        this.setPhase('planning');
        this.detail = event.domain;
        break;

      case 'agent:started':
        this.setPhase('thinking');
        this.detail = event.domain;
        break;

      case 'agent:reasoning':
        this.setPhase('thinking');
        break;

      case 'agent:tool-call':
        this.setPhase('executing');
        this.toolName = event.toolName;
        this.detail = event.toolName;
        break;

      case 'agent:tool-result':
        this.setPhase('reviewing');
        this.detail = event.toolName;
        break;

      case 'agent:stream-delta':
        this.setPhase('responding');
        break;

      case 'agent:iteration':
        this.iteration = event.iteration;
        this.maxIterations = event.maxIterations;
        break;

      case 'agent:completed':
        this.setPhase('done');
        this.detail = undefined;
        this.toolName = undefined;
        break;

      case 'orchestrator:completed':
        this.setPhase('done');
        this.detail = undefined;
        this.toolName = undefined;
        break;

      case 'orchestrator:error':
      case 'agent:error':
        this.setPhase('error');
        this.detail = event.error;
        this.toolName = undefined;
        break;

      // Other event types don't change phase
      default:
        break;
    }

    const state = this.buildState(event.timestamp);
    this.notifyListeners(state);
    return state;
  }

  /** Get current progress state. */
  getState(): ProgressState {
    return this.buildState(Date.now());
  }

  /** Reset tracker for a new conversation turn. */
  reset(): void {
    this.startTime = 0;
    this.currentPhase = 'idle';
    this.iteration = 0;
    this.maxIterations = 15;
    this.toolName = undefined;
    this.detail = undefined;
  }

  // ---- Private helpers ----

  private setPhase(phase: ProgressPhase): void {
    this.currentPhase = phase;
  }

  private buildState(now: number): ProgressState {
    const phaseInfo = PHASE_MESSAGES[this.currentPhase];

    let progress = PHASE_PROGRESS[this.currentPhase];

    // Refine progress during executing phase based on iteration count
    if (
      this.currentPhase === 'executing' &&
      this.maxIterations > 0 &&
      this.iteration > 0
    ) {
      const iterFraction = this.iteration / this.maxIterations;
      // Map iteration progress into the executing→reviewing range (0.4 – 0.7)
      progress = 0.4 + iterFraction * 0.3;
    }

    return {
      phase: this.currentPhase,
      message: phaseInfo.message,
      detail: this.detail,
      icon: phaseInfo.icon,
      progress: Math.min(progress, 1),
      elapsed: this.startTime > 0 ? now - this.startTime : 0,
      toolName: this.toolName,
      iterationInfo:
        this.iteration > 0
          ? { current: this.iteration, max: this.maxIterations }
          : undefined,
    };
  }

  private notifyListeners(state: ProgressState): void {
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
