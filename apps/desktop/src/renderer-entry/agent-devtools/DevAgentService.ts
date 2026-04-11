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
  type LLMProvider,
  PROVIDER_CATALOG,
} from '@orbit/agent-core';
import { SCENARIOS, type ScenarioInfo } from './mock-scenarios';
import { LLMConfigStore } from './llm-config-store';

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

  // Real LLM provider state
  private realProvider: LLMProvider | null = null;
  private activeProviderName: string | null = null;
  private conversationHistory: Array<{
    readonly id: string;
    readonly role: 'system' | 'user' | 'assistant' | 'tool';
    readonly content: string;
    readonly timestamp: string;
  }> = [];

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

  // ---- Real LLM Methods ----

  /** Refresh real LLM providers from stored config. */
  refreshLLMProviders(): void {
    const enabled = LLMConfigStore.getEnabled();
    if (enabled.length > 0) {
      const first = enabled[0];
      this.realProvider = LLMConfigStore.createProvider(first);
      this.activeProviderName = this.realProvider
        ? (PROVIDER_CATALOG.find((e) => e.id === first.providerId)?.displayName ?? first.providerId)
        : null;
    } else {
      this.realProvider = null;
      this.activeProviderName = null;
    }
    this.notifyListeners();
  }

  /** Get the name of the currently active real LLM provider. */
  getActiveProvider(): string | null {
    return this.activeProviderName;
  }

  /** Send a message using the real LLM provider via IPC proxy. */
  async sendRealMessage(content: string): Promise<void> {
    if (!this.sessionState) {
      this.createSession();
    }

    // Ensure we have a provider
    if (!this.realProvider) {
      this.refreshLLMProviders();
    }

    const runId = `run_real_${Date.now().toString(36)}`;
    const enabled = LLMConfigStore.getEnabled();
    const providerConfig = enabled[0];

    if (!providerConfig) {
      this.sessionState!.addUserMessage(content);
      this.bridge.getEventBus().emit({
        type: 'agent:error',
        runId,
        timestamp: Date.now(),
        domain: 'planning',
        error: '未配置 LLM 供应商。请前往「LLM 配置」标签页配置并启用一个供应商。',
      });
      this.notifyListeners();
      return;
    }

    this.sessionState!.addUserMessage(content);
    this.isRunning = true;
    this.notifyListeners();

    // Build conversation history
    this.conversationHistory.push({
      id: `msg_${Date.now().toString(36)}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    const entry = PROVIDER_CATALOG.find((e) => e.id === providerConfig.providerId);
    const model = providerConfig.defaultModel || entry?.defaultModel || '';

    // Emit orchestrator started
    this.bridge.getEventBus().emit({
      type: 'orchestrator:started',
      runId,
      timestamp: Date.now(),
      sessionId: this.sessionId!,
      surface: 'global-chat',
    });

    this.bridge.getEventBus().emit({
      type: 'orchestrator:routed',
      runId,
      timestamp: Date.now(),
      domain: 'planning',
      reason: `Real LLM: ${this.activeProviderName}`,
    });

    this.bridge.getEventBus().emit({
      type: 'agent:started',
      runId,
      timestamp: Date.now(),
      domain: 'planning',
      model,
    });

    // Emit agent reasoning (thinking indicator)
    this.bridge.getEventBus().emit({
      type: 'agent:reasoning',
      runId,
      timestamp: Date.now(),
      content: '正在调用 LLM ...',
    });

    try {
      // Use IPC proxy for the actual call (bypasses CORS)
      const chatMessages = this.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { text: fullResponse, latencyMs: durationMs } =
        await LLMConfigStore.chatViaProxy(providerConfig, chatMessages);

      // Emit agent completed with the full response
      if (fullResponse) {
        this.bridge.getEventBus().emit({
          type: 'agent:completed',
          runId,
          timestamp: Date.now(),
          domain: 'planning',
          responseContent: fullResponse,
          totalTokens: 0,
          totalDurationMs: durationMs,
        });

        this.bridge.getEventBus().emit({
          type: 'orchestrator:completed',
          runId,
          timestamp: Date.now(),
          sessionId: this.sessionId!,
          totalTokens: 0,
          totalDurationMs: durationMs,
        });

        // Add to conversation history
        this.conversationHistory.push({
          id: `msg_${Date.now().toString(36)}`,
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.bridge.getEventBus().emit({
        type: 'agent:error',
        runId,
        timestamp: Date.now(),
        domain: 'planning',
        error: `LLM 调用失败: ${errorMsg}`,
      });
    } finally {
      this.isRunning = false;
      this.notifyListeners();
    }
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
    this.conversationHistory = [];
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
