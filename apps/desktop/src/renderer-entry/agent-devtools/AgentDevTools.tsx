import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Chip } from '@heroui/react';
import { MessageCircle, Radio, BarChart3, Settings, Microscope, RefreshCw, X, Drama, Bot, type LucideIcon } from 'lucide-react';
import { AgentChatPanel } from '@orbit/feature-workbench';
import { DevAgentService } from './DevAgentService';
import { EventStreamPanel } from './EventStreamPanel';
import { ObservabilityPanel } from './ObservabilityPanel';
import { LLMConfigPanel } from './LLMConfigPanel';
import { LLMConfigStore } from './llm-config-store';
import { SCENARIOS, type ScenarioInfo } from './mock-scenarios';

// ---------------------------------------------------------------------------
// AgentDevTools – Main container with tabs
// ---------------------------------------------------------------------------

type Tab = 'chat' | 'events' | 'observe' | 'config';

const TAB_ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'chat', label: '对话', icon: MessageCircle },
  { id: 'events', label: '事件流', icon: Radio },
  { id: 'observe', label: '可观测', icon: BarChart3 },
  { id: 'config', label: 'LLM 配置', icon: Settings },
];

const CHAT_MODE_STORAGE_KEY = 'orbit:agent-devtools:chat-mode';

function getInitialChatMode(): 'mock' | 'real' {
  try {
    const saved = localStorage.getItem(CHAT_MODE_STORAGE_KEY);
    if (saved === 'mock' || saved === 'real') {
      return saved;
    }
  } catch {
    // Ignore storage access errors and fall back to provider-based default.
  }

  return LLMConfigStore.getEnabled().length > 0 ? 'real' : 'mock';
}

export interface AgentDevToolsProps {
  onClose: () => void;
}

export function AgentDevTools({ onClose }: AgentDevToolsProps) {
  const [tab, setTab] = useState<Tab>('chat');
  const [, setTick] = useState(0);
  const [chatMode, setChatMode] = useState<'mock' | 'real'>(getInitialChatMode);

  // Service is a singleton ref — survives re-renders
  const serviceRef = useRef<DevAgentService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new DevAgentService();
    serviceRef.current.createSession();
  }
  const service = serviceRef.current;

  // Re-render when service state changes
  useEffect(() => {
    const unsub = service.onChange(() => setTick((t) => t + 1));
    return unsub;
  }, [service]);

  // Load saved LLM providers on startup
  useEffect(() => {
    service.refreshLLMProviders();
  }, [service]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_MODE_STORAGE_KEY, chatMode);
    } catch {
      // Ignore storage access errors — the UI still works for this session.
    }
  }, [chatMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.destroy();
      serviceRef.current = null;
    };
  }, []);

  const handleSendMessage = useCallback(
    (content: string) => {
      if (chatMode === 'real') {
        void service.sendRealMessage(content);
      } else {
        void service.sendMessage(content);
      }
    },
    [service, chatMode],
  );

  const handleRunScenario = useCallback(
    (scenario: ScenarioInfo) => {
      void service.runScenario(scenario);
    },
    [service],
  );

  const handleReset = useCallback(() => {
    service.reset();
    service.createSession();
  }, [service]);

  const handleLLMConfigChanged = useCallback(() => {
    service.refreshLLMProviders();
    setTick((t) => t + 1);
  }, [service]);

  const viewModel = service.getViewModel();
  const eventLog = service.getEventLog();
  const progress = service.getProgress();
  const sessionState = service.getSessionState();

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2.5 px-4 py-2.5 bg-surface-secondary border-b border-border shrink-0">
        <div className="flex items-center gap-2 w-full min-w-0">
          <Microscope size={16} />
          <strong className="text-sm">Agent DevTools</strong>
          <span className="flex-1" />

          {/* Reset button */}
          <button
            onClick={handleReset}
            title="重置所有状态"
            className="px-2.5 py-1 rounded-md border border-border bg-transparent text-muted text-[11px] cursor-pointer shrink-0 hover:bg-surface-secondary transition-colors"
          >
            <RefreshCw size={14} className="inline" /> 重置
          </button>

          {/* Event count badge */}
          <Chip size="sm" variant="soft" color={eventLog.length > 0 ? 'success' : 'default'}>
            {eventLog.length} events
          </Chip>

          {/* Close */}
          <Button variant="ghost" isIconOnly size="sm" onPress={onClose} aria-label="关闭">
            <X size={16} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <span className="text-[11px] text-muted font-semibold">模式</span>
            <div className="flex gap-0.5 rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setChatMode('mock')}
                className={`px-2.5 py-[3px] border-none text-[11px] cursor-pointer transition-colors ${
                  chatMode === 'mock'
                    ? 'bg-accent text-background font-semibold'
                    : 'bg-transparent text-muted'
                }`}
              >
                <Drama size={14} className="inline" /> Mock
              </button>
              <button
                onClick={() => setChatMode('real')}
                className={`px-2.5 py-[3px] border-none text-[11px] cursor-pointer transition-colors ${
                  chatMode === 'real'
                    ? 'bg-success text-background font-semibold'
                    : 'bg-transparent text-muted'
                }`}
              >
                <Bot size={14} className="inline" /> Real LLM
              </button>
            </div>

            <span
              className={`text-[11px] min-w-0 ${
                chatMode === 'real'
                  ? (service.getActiveProvider() ? 'text-success' : 'text-danger')
                  : 'text-muted'
              }`}
            >
              {chatMode === 'real'
                ? `当前供应商：${service.getActiveProvider() ?? '未配置'}`
                : '当前使用 Mock 场景'}
            </span>
          </div>

          {/* Scenario selector (mock mode only) */}
          {chatMode === 'mock' && (
            <div className="flex items-center gap-1.5 flex-wrap min-w-0" style={{ flex: 999 }}>
              <span className="text-[11px] text-muted font-semibold">场景</span>
              {SCENARIOS.map((sc) => {
                const isActive = service.getActiveScenario()?.id === sc.id;
                const isRunning = service.getIsRunning();
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleRunScenario(sc)}
                    disabled={isRunning}
                    title={sc.description}
                    className={`px-2 py-[3px] rounded-md border text-[11px] shrink-0 transition-colors ${
                      isActive
                        ? 'border-accent bg-accent text-background'
                        : 'border-border bg-transparent text-muted'
                    } ${isRunning ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                      isRunning && !isActive ? 'opacity-50' : ''
                    }`}
                  >
                    {sc.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border bg-surface shrink-0">
        {TAB_ITEMS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 bg-transparent border-none cursor-pointer text-[13px] transition-all border-b-2 ${
              tab === t.id
                ? 'border-b-accent text-foreground font-semibold'
                : 'border-b-transparent text-muted'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'chat' && (
          <AgentChatPanel
            viewModel={viewModel}
            onSendMessage={handleSendMessage}
          />
        )}
        {tab === 'events' && (
          <EventStreamPanel events={eventLog} />
        )}
        {tab === 'observe' && (
          <ObservabilityPanel
            progress={progress}
            sessionState={sessionState}
            eventCount={eventLog.length}
          />
        )}
        {tab === 'config' && (
          <LLMConfigPanel onConfigChanged={handleLLMConfigChanged} />
        )}
      </div>
    </div>
  );
}
