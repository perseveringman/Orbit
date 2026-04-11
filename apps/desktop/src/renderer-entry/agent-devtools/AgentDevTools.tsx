import { useState, useEffect, useRef, useCallback } from 'react';
import { AgentChatPanel } from '@orbit/feature-workbench';
import { DevAgentService } from './DevAgentService';
import { EventStreamPanel } from './EventStreamPanel';
import { ObservabilityPanel } from './ObservabilityPanel';
import { LLMConfigPanel } from './LLMConfigPanel';
import { SCENARIOS, type ScenarioInfo } from './mock-scenarios';

// ---------------------------------------------------------------------------
// AgentDevTools – Main container with tabs
// ---------------------------------------------------------------------------

type Tab = 'chat' | 'events' | 'observe' | 'config';

const TAB_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat', label: '对话', icon: '💬' },
  { id: 'events', label: '事件流', icon: '📡' },
  { id: 'observe', label: '可观测', icon: '📊' },
  { id: 'config', label: 'LLM 配置', icon: '⚙️' },
];

const VAR = {
  bg: 'oklch(0.11 0.008 260)',
  surface: 'oklch(0.17 0.008 260)',
  headerBg: 'oklch(0.14 0.01 260)',
  text: 'oklch(0.93 0.005 260)',
  textDim: 'oklch(0.55 0.01 260)',
  accent: 'oklch(0.65 0.15 250)',
  green: 'oklch(0.65 0.15 145)',
  red: 'oklch(0.60 0.18 25)',
  border: 'oklch(0.25 0.01 260)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export interface AgentDevToolsProps {
  onClose: () => void;
}

export function AgentDevTools({ onClose }: AgentDevToolsProps) {
  const [tab, setTab] = useState<Tab>('chat');
  const [, setTick] = useState(0);
  const [chatMode, setChatMode] = useState<'mock' | 'real'>('mock');

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: VAR.bg,
        color: VAR.text,
        fontFamily: VAR.font,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: VAR.headerBg,
          borderBottom: `1px solid ${VAR.border}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16 }}>🔬</span>
        <strong style={{ fontSize: 14 }}>Agent DevTools</strong>

        {/* Scenario selector (mock mode only) */}
        {chatMode === 'mock' && (
          <div style={{ marginLeft: 16, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => handleRunScenario(sc)}
                disabled={service.getIsRunning()}
                title={sc.description}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: `1px solid ${VAR.border}`,
                  background: service.getActiveScenario()?.id === sc.id ? VAR.accent : 'transparent',
                  color: service.getActiveScenario()?.id === sc.id ? VAR.bg : VAR.textDim,
                  fontSize: 11,
                  cursor: service.getIsRunning() ? 'not-allowed' : 'pointer',
                  fontFamily: VAR.font,
                  opacity: service.getIsRunning() && service.getActiveScenario()?.id !== sc.id ? 0.5 : 1,
                }}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}

        {/* Mode toggle: Mock ↔ Real LLM */}
        <div style={{ marginLeft: chatMode === 'mock' ? 8 : 16, display: 'flex', gap: 2, borderRadius: 6, border: `1px solid ${VAR.border}`, overflow: 'hidden' }}>
          <button
            onClick={() => setChatMode('mock')}
            style={{
              padding: '3px 10px',
              border: 'none',
              background: chatMode === 'mock' ? VAR.accent : 'transparent',
              color: chatMode === 'mock' ? VAR.bg : VAR.textDim,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: VAR.font,
              fontWeight: chatMode === 'mock' ? 600 : 400,
            }}
          >
            🎭 Mock
          </button>
          <button
            onClick={() => setChatMode('real')}
            style={{
              padding: '3px 10px',
              border: 'none',
              background: chatMode === 'real' ? VAR.green : 'transparent',
              color: chatMode === 'real' ? VAR.bg : VAR.textDim,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: VAR.font,
              fontWeight: chatMode === 'real' ? 600 : 400,
            }}
          >
            🤖 Real LLM
          </button>
        </div>

        {/* Real LLM provider indicator */}
        {chatMode === 'real' && (
          <span style={{ fontSize: 11, color: service.getActiveProvider() ? VAR.green : VAR.red, marginLeft: 4 }}>
            {service.getActiveProvider() ?? '未配置供应商'}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {/* Reset button */}
        <button
          onClick={handleReset}
          title="重置所有状态"
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${VAR.border}`,
            background: 'transparent',
            color: VAR.textDim,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: VAR.font,
          }}
        >
          🔄 重置
        </button>

        {/* Event count badge */}
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 10,
            background: eventLog.length > 0 ? VAR.green : VAR.border,
            color: eventLog.length > 0 ? VAR.bg : VAR.textDim,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {eventLog.length} events
        </span>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{
            background: 'none',
            border: 'none',
            color: VAR.textDim,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${VAR.border}`,
          background: VAR.surface,
          flexShrink: 0,
        }}
      >
        {TAB_ITEMS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${VAR.accent}` : '2px solid transparent',
              color: tab === t.id ? VAR.text : VAR.textDim,
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer',
              fontFamily: VAR.font,
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
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
