import { type ReactElement, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { Chip, Switch, Button } from '@heroui/react';
import { PROVIDER_CATALOG } from '@orbit/agent-core';
import type { AgentMessage, OrbitAgentEvent } from '@orbit/agent-core';
import {
  ConversationStream,
  PromptInput,
  normalizeMessages,
  useConversationSearch,
  useStreamingState,
  classifyError,
  errorToRenderableMessage,
} from '@orbit/conversation-ui';
import { LLMConfigStore } from '../stores/llm-config-store';
import { TokenUsageStore } from '../stores/token-usage-store';
import { startStreamingChat, startMockStream } from '../utils/stream-chat';

type ChatMode = 'mock' | 'real';

let msgSeq = 0;
function nextId(suffix: string): string {
  return `msg-${++msgSeq}-${suffix}`;
}

/** Snapshot function for useSyncExternalStore — returns all configs. */
function getConfigSnapshot(): readonly import('../stores/llm-config-store').LLMProviderUserConfig[] {
  return LLMConfigStore.getAll();
}

export function ChatPage(): ReactElement {
  const [mode, setMode] = useState<ChatMode>(() => {
    return (localStorage.getItem('orbit:agent-hub:chat-mode') as ChatMode) ?? 'real';
  });
  const [rawMessages, setRawMessages] = useState<AgentMessage[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);

  const streaming = useStreamingState();
  const cancelRef = useRef<(() => void) | null>(null);
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);

  // Subscribe to LLMConfigStore so provider changes reflect immediately
  const configs = useSyncExternalStore(LLMConfigStore.subscribe, getConfigSnapshot);
  const activeProvider = configs.find((c) => c.enabled);
  const providerEntry = activeProvider
    ? PROVIDER_CATALOG.find((e) => e.id === activeProvider.providerId)
    : null;

  const renderableMessages = normalizeMessages(rawMessages);
  const search = useConversationSearch(renderableMessages);

  const modelName = providerEntry?.displayName ?? (mode === 'mock' ? 'Mock' : undefined);

  const handleModeChange = useCallback((isReal: boolean) => {
    const newMode = isReal ? 'real' : 'mock';
    setMode(newMode);
    localStorage.setItem('orbit:agent-hub:chat-mode', newMode);
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim() || streaming.state.isStreaming) return;

      const userMsg: AgentMessage = {
        id: nextId('u'),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setRawMessages((prev) => [...prev, userMsg]);
      conversationHistory.current.push({ role: 'user', content });

      streaming.reset();
      streaming.startStreaming();
      const runId = `run-${Date.now()}`;

      const makeDeltaEvent = (delta: string): OrbitAgentEvent =>
        ({
          type: 'agent:stream-delta',
          runId,
          timestamp: Date.now(),
          delta,
        }) as OrbitAgentEvent;

      const makeCompletedEvent = (): OrbitAgentEvent =>
        ({
          type: 'agent:completed',
          runId,
          timestamp: Date.now(),
          domain: 'chat',
          responseContent: '',
          totalTokens: 0,
          totalDurationMs: 0,
        }) as OrbitAgentEvent;

      const makeErrorEvent = (error: string): OrbitAgentEvent =>
        ({
          type: 'agent:error',
          runId,
          timestamp: Date.now(),
          domain: 'chat',
          error,
        }) as OrbitAgentEvent;

      const finalize = (fullText: string) => {
        const assistantMsg: AgentMessage = {
          id: nextId('a'),
          role: 'assistant',
          content: fullText,
          timestamp: new Date().toISOString(),
        };
        setRawMessages((prev) => [...prev, assistantMsg]);
        conversationHistory.current.push({ role: 'assistant', content: fullText });
        cancelRef.current = null;
      };

      if (mode === 'real' && activeProvider) {
        cancelRef.current = startStreamingChat(
          activeProvider,
          conversationHistory.current,
          {
            onDelta(delta) {
              streaming.feedEvent(makeDeltaEvent(delta));
            },
            onDone(fullText) {
              streaming.feedEvent(makeCompletedEvent());

              const model =
                activeProvider.defaultModel ||
                providerEntry?.defaultModel ||
                'unknown';
              const provider = providerEntry?.id ?? 'unknown';
              const promptTokens = Math.ceil(
                conversationHistory.current.reduce((s, m) => s + m.content.length, 0) / 4,
              );
              const completionTokens = Math.ceil(fullText.length / 4);
              TokenUsageStore.record({ model, provider, promptTokens, completionTokens });
              setTotalTokens((prev) => prev + promptTokens + completionTokens);

              finalize(fullText);
            },
            onError(error) {
              streaming.feedEvent(makeErrorEvent(error));
              const classified = classifyError(new Error(error));
              const errRenderable = errorToRenderableMessage(classified);
              const errMsg: AgentMessage = {
                id: errRenderable.id,
                role: 'system',
                content: errRenderable.content,
                timestamp: errRenderable.timestamp,
                metadata: { isError: true },
              };
              setRawMessages((prev) => [...prev, errMsg]);
              cancelRef.current = null;
            },
          },
        );
      } else if (mode === 'real' && !activeProvider) {
        // Real mode but no provider configured — show explicit error
        const errMsg: AgentMessage = {
          id: nextId('e'),
          role: 'system',
          content: '⚠️ 未配置 LLM Provider — 请前往「模型配置」页面配置并启用一个 Provider 后再试。',
          timestamp: new Date().toISOString(),
          metadata: { isError: true },
        };
        setRawMessages((prev) => [...prev, errMsg]);
      } else {
        // Mock mode – typewriter character-by-character
        const mockReply = `[Mock] 已收到消息: "${content.slice(0, 80)}"`;
        cancelRef.current = startMockStream(mockReply, {
          onDelta(delta) {
            streaming.feedEvent(makeDeltaEvent(delta));
          },
          onDone(fullText) {
            streaming.feedEvent(makeCompletedEvent());
            finalize(fullText);
          },
          onError() {},
        });
      }
    },
    [streaming, mode, activeProvider, providerEntry],
  );

  const handleCancel = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    const partialContent = streaming.state.content;
    if (partialContent) {
      const assistantMsg: AgentMessage = {
        id: nextId('a'),
        role: 'assistant',
        content: partialContent + ' [已取消]',
        timestamp: new Date().toISOString(),
      };
      setRawMessages((prev) => [...prev, assistantMsg]);
      conversationHistory.current.push({ role: 'assistant', content: partialContent });
    }
    streaming.reset();
  }, [streaming]);

  const handleClear = useCallback(() => {
    setRawMessages([]);
    conversationHistory.current = [];
    setTotalTokens(0);
    streaming.reset();
  }, [streaming]);

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <h1 className="text-lg font-bold">对话</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Mock</span>
          <Switch size="sm" isSelected={mode === 'real'} onChange={handleModeChange}>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
          <span className="text-xs text-muted">Real LLM</span>
        </div>
        {providerEntry && mode === 'real' && (
          <Chip size="sm" color="success" variant="soft">🤖 {providerEntry.displayName}</Chip>
        )}
        {!activeProvider && mode === 'real' && (
          <Chip size="sm" color="warning" variant="soft">⚠️ 未配置 Provider</Chip>
        )}
        <div className="ml-auto flex items-center gap-3">
          {totalTokens > 0 && (
            <span className="text-xs text-muted">Tokens: {totalTokens.toLocaleString()}</span>
          )}
          <Button size="sm" variant="ghost" onPress={search.state.isOpen ? search.close : search.open}>
            🔍
          </Button>
          <Button size="sm" variant="ghost" onPress={handleClear}>清空</Button>
        </div>
      </div>

      {/* Message stream */}
      {renderableMessages.length === 0 && !streaming.state.isStreaming ? (
        <div className="flex flex-1 items-center justify-center text-muted">
          <div className="text-center">
            <p className="text-4xl">💬</p>
            <p className="mt-2 text-sm">发送消息开始对话</p>
          </div>
        </div>
      ) : (
        <ConversationStream
          messages={renderableMessages}
          searchQuery={search.state.query}
          streamingState={streaming.state.isStreaming ? streaming.state : undefined}
        />
      )}

      {/* Input */}
      <PromptInput
        onSend={handleSend}
        onCancel={handleCancel}
        isStreaming={streaming.state.isStreaming}
        modelName={modelName}
        tokenCount={totalTokens > 0 ? totalTokens : undefined}
      />
    </div>
  );
}
