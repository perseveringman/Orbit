// ---------------------------------------------------------------------------
// Agent DevTools – DevAgentService
// Wires InMemoryTransport + AgentBridge + AgentSessionState to run the full
// agent event pipeline in-process using mock scenarios.
// ---------------------------------------------------------------------------

import {
  AgentBridge,
  InMemoryTransport,
  EventBus,
  AgentSessionState,
  ProgressTracker,
  type OrbitAgentEvent,
  type SessionUIState,
  type ProgressState,
} from '@orbit/agent-core';
import type { AgentChatViewModel, AgentChatMessageViewModel } from '@orbit/feature-workbench';
import { SCENARIOS, type ScenarioInfo } from './mock-scenarios';

// ---- ViewModel mapping from SessionUIState ----

const ROLE_LABELS: Record<string, string> = {
  system: '系统',
  user: '用户',
  assistant: '助手',
  tool: '工具',
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function stateToViewModel(state: SessionUIState): AgentChatViewModel {
  const messages: AgentChatMessageViewModel[] = state.messages.map((msg) => {
    const hasToolCalls = (msg.toolCalls?.length ?? 0) > 0;
    const firstTool = hasToolCalls ? msg.toolCalls![0] : undefined;

    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).toISOString(),
      isToolCall: hasToolCalls || msg.role === 'tool',
      toolName: firstTool?.name ?? (msg.role === 'tool' ? 'tool-result' : undefined),
      toolArgs: firstTool ? JSON.stringify(firstTool.args, null, 2) : undefined,
      toolResult: firstTool?.result ?? (msg.role === 'tool' ? msg.content : undefined),
      roleLabel: ROLE_LABELS[msg.role] ?? msg.role,
      formattedTime: formatTimestamp(msg.timestamp),
    };
  });

  // Add in-progress tool calls as virtual messages
  for (const tc of state.currentToolCalls) {
    messages.push({
      id: `tc-${tc.id}`,
      role: 'tool',
      content: tc.result ?? '',
      timestamp: new Date().toISOString(),
      isToolCall: true,
      toolName: tc.name,
      toolArgs: JSON.stringify(tc.args, null, 2),
      toolResult: tc.result,
      roleLabel: '工具',
      formattedTime: formatTimestamp(Date.now()),
    });
  }

  return {
    surface: 'global-chat',
    sessionId: state.sessionId,
    messages,
    isProcessing: state.status !== 'idle' && state.status !== 'error',
    currentDomain: (state.activeAgent as any) ?? null,
    pendingApprovals: [],
    surfaceLabel: 'Agent DevTools',
    emptyStateMessage: '选择一个场景，或直接发送消息开始测试 …',
  };
}

// ---- Event log entry ----

export interface EventLogEntry {
  readonly index: number;
  readonly event: OrbitAgentEvent;
  readonly category: 'capability' | 'safety' | 'compression' | 'agent' | 'orchestrator';
}

function categorizeEvent(event: OrbitAgentEvent): EventLogEntry['category'] {
  const t = event.type;
  if (t.startsWith('capability:')) return 'capability';
  if (t.startsWith('safety:')) return 'safety';
  if (t.startsWith('compression:')) return 'compression';
  if (t.startsWith('agent:')) return 'agent';
  return 'orchestrator';
}

// ---- DevAgentService ----

export type ServiceChangeListener = () => void;

export class DevAgentService {
  private readonly transport: InMemoryTransport;
  private readonly bridge: AgentBridge;
  private readonly eventBus: EventBus;
  private readonly progressTracker: ProgressTracker;
  private sessionState: AgentSessionState | null = null;
  private sessionId: string | null = null;

  private readonly eventLog: EventLogEntry[] = [];
  private eventIndex = 0;
  private readonly changeListeners = new Set<ServiceChangeListener>();

  private activeScenario: ScenarioInfo | null = null;
  private isRunning = false;

  constructor() {
    this.transport = new InMemoryTransport();
    this.eventBus = new EventBus();
    this.progressTracker = new ProgressTracker();

    // Create bridge without orchestrator — we'll drive events manually
    this.bridge = new AgentBridge(this.transport);
    this.bridge.start();

    // Tap into all events on the EventBus
    this.bridge.getEventBus().onAny((event) => {
      this.eventLog.push({
        index: this.eventIndex++,
        event,
        category: categorizeEvent(event),
      });
      this.progressTracker.processEvent(event);
      this.notifyListeners();
    });

    // Listen for backend messages from the bridge (session:created, etc.)
    // The transport.sentMessages array captures these, but we also need to
    // react to session creation.
  }

  /** Subscribe to any state change. */
  onChange(listener: ServiceChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => { this.changeListeners.delete(listener); };
  }

  /** Create a session and start listening for state changes. */
  createSession(): void {
    if (this.sessionState) {
      this.sessionState.destroy();
    }

    // Create session through the bridge
    const sessionId = `session_devtools_${Date.now().toString(36)}`;
    this.sessionId = sessionId;
    this.sessionState = new AgentSessionState(sessionId, this.bridge.getEventBus());

    // Subscribe to state changes to trigger re-renders
    this.sessionState.subscribe(() => {
      this.notifyListeners();
    });

    this.notifyListeners();
  }

  /** Run a scenario, emitting events through the EventBus. */
  async runScenario(scenario: ScenarioInfo): Promise<void> {
    if (this.isRunning) return;

    this.activeScenario = scenario;
    this.isRunning = true;
    this.notifyListeners();

    try {
      const generator = scenario.run();
      for await (const event of generator) {
        this.bridge.getEventBus().emit(event);
      }
    } finally {
      this.isRunning = false;
      this.activeScenario = null;
      this.notifyListeners();
    }
  }

  /** Send a user message — triggers a mock scenario based on content keywords. */
  async sendMessage(content: string): Promise<void> {
    if (!this.sessionState) {
      this.createSession();
    }

    this.sessionState!.addUserMessage(content);
    this.notifyListeners();

    // Pick a scenario based on keywords
    const lower = content.toLowerCase();
    let scenario: ScenarioInfo;

    if (lower.includes('文件') || lower.includes('file') || lower.includes('读取')) {
      scenario = SCENARIOS.find((s) => s.id === 'tool-usage')!;
    } else if (lower.includes('搜索') || lower.includes('search') || lower.includes('研究')) {
      scenario = SCENARIOS.find((s) => s.id === 'multi-tool')!;
    } else if (lower.includes('写入') || lower.includes('write') || lower.includes('创建')) {
      scenario = SCENARIOS.find((s) => s.id === 'approval')!;
    } else if (lower.includes('错误') || lower.includes('error') || lower.includes('失败')) {
      scenario = SCENARIOS.find((s) => s.id === 'error')!;
    } else if (lower.includes('委派') || lower.includes('delegate') || lower.includes('多agent')) {
      scenario = SCENARIOS.find((s) => s.id === 'multi-agent')!;
    } else {
      scenario = SCENARIOS.find((s) => s.id === 'basic-chat')!;
    }

    await this.runScenario(scenario);
  }

  /** Get the current chat ViewModel. */
  getViewModel(): AgentChatViewModel {
    if (!this.sessionState) {
      return {
        surface: 'global-chat',
        sessionId: null,
        messages: [],
        isProcessing: false,
        currentDomain: null,
        pendingApprovals: [],
        surfaceLabel: 'Agent DevTools',
        emptyStateMessage: '选择一个场景，或直接发送消息开始测试 …',
      };
    }
    return stateToViewModel(this.sessionState.getState());
  }

  /** Get the full event log. */
  getEventLog(): readonly EventLogEntry[] {
    return this.eventLog;
  }

  /** Get current progress state. */
  getProgress(): ProgressState {
    return this.progressTracker.getState();
  }

  /** Get session UI state. */
  getSessionState(): SessionUIState | null {
    return this.sessionState?.getState() ?? null;
  }

  /** Whether a scenario is currently running. */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /** Get active scenario info. */
  getActiveScenario(): ScenarioInfo | null {
    return this.activeScenario;
  }

  /** Clear event log and reset state. */
  reset(): void {
    this.eventLog.length = 0;
    this.eventIndex = 0;
    this.progressTracker.reset();
    if (this.sessionState) {
      this.sessionState.reset();
    }
    this.isRunning = false;
    this.activeScenario = null;
    this.notifyListeners();
  }

  /** Clean up. */
  destroy(): void {
    this.bridge.stop();
    this.sessionState?.destroy();
    this.changeListeners.clear();
  }

  private notifyListeners(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}
