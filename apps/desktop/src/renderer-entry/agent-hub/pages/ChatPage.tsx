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
import {
  runToolCallingChat,
  getAvailableToolCount,
  type ChatOrchestratorEvent,
} from '../utils/chat-orchestrator';

type ChatMode = 'mock' | 'direct' | 'agent';

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
    return (localStorage.getItem('orbit:agent-hub:chat-mode') as ChatMode) ?? 'agent';
  });
  const [rawMessages, setRawMessages] = useState<AgentMessage[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [thinkingText, setThinkingText] = useState<string | null>(null);

  const streaming = useStreamingState();
  const cancelRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);

  // Subscribe to LLMConfigStore so provider changes reflect immediately
  const configs = useSyncExternalStore(LLMConfigStore.subscribe, getConfigSnapshot);
  const activeProvider = configs.find((c) => c.enabled);
  const providerEntry = activeProvider
    ? PROVIDER_CATALOG.find((e) => e.id === activeProvider.providerId)
    : null;

  const renderableMessages = normalizeMessages(rawMessages);
  const search = useConversationSearch(renderableMessages);

  const toolCount = getAvailableToolCount();
  const modelName = providerEntry?.displayName ?? (mode === 'mock' ? 'Mock' : undefined);

  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
    localStorage.setItem('orbit:agent-hub:chat-mode', newMode);
  }, []);

  // --- Agent mode: tool-calling orchestrator ---
  const handleAgentSend = useCallback(
    async (content: string) => {
      if (!activeProvider) return;

      const userMsg: AgentMessage = {
        id: nextId('u'),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setRawMessages((prev) => [...prev, userMsg]);

      const abort = new AbortController();
      abortRef.current = abort;
      setThinkingText('Thinking...');

      // Build full conversation for orchestrator (all messages including new user message)
      const fullHistory: AgentMessage[] = [...rawMessages, userMsg];

      try {
        const gen = runToolCallingChat(activeProvider, fullHistory, { enableTools: true });

        for await (const event of gen) {
          if (abort.signal.aborted) break;

          switch (event.type) {
            case 'message':
              setRawMessages((prev) => [...prev, event.message]);
              // Clear thinking when we get a non-tool message
              if (event.message.role === 'assistant' && !event.message.toolCalls?.length) {
                setThinkingText(null);
              }
              break;
            case 'thinking':
              setThinkingText(event.text);
              break;
            case 'token-usage': {
              const model =
                activeProvider.defaultModel || providerEntry?.defaultModel || 'unknown';
              const provider = providerEntry?.id ?? 'unknown';
              TokenUsageStore.record({
                model,
                provider,
                promptTokens: event.usage.promptTokens,
                completionTokens: event.usage.completionTokens,
              });
              setTotalTokens((prev) => prev + event.usage.totalTokens);
              break;
            }
            case 'completed':
              setThinkingText(null);
              break;
            case 'error': {
              setThinkingText(null);
              const errMsg: AgentMessage = {
                id: nextId('e'),
                role: 'system',
                content: `⚠️ ${event.error}`,
                timestamp: new Date().toISOString(),
                metadata: { isError: true },
              };
              setRawMessages((prev) => [...prev, errMsg]);
              break;
            }
          }
        }
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          const msg = err instanceof Error ? err.message : String(err);
          const errMsg: AgentMessage = {
            id: nextId('e'),
            role: 'system',
            content: `⚠️ Orchestrator error: ${msg}`,
            timestamp: new Date().toISOString(),
            metadata: { isError: true },
          };
          setRawMessages((prev) => [...prev, errMsg]);
        }
      } finally {
        setThinkingText(null);
        abortRef.current = null;
      }
    },
    [rawMessages, activeProvider, providerEntry],
  );

  // --- Direct mode: streaming without tools ---
  const handleDirectSend = useCallback(
    (content: string) => {
      if (!activeProvider) return;

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
        ({ type: 'agent:stream-delta', runId, timestamp: Date.now(), delta }) as OrbitAgentEvent;

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

      cancelRef.current = startStreamingChat(activeProvider, conversationHistory.current, {
        onDelta(delta) {
          streaming.feedEvent(makeDeltaEvent(delta));
        },
        onDone(fullText) {
          streaming.reset();
          const model = activeProvider.defaultModel || providerEntry?.defaultModel || 'unknown';
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
          streaming.reset();
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
      });
    },
    [streaming, activeProvider, providerEntry],
  );

  // --- Unified send handler ---
  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim()) return;

      if (mode === 'agent' && activeProvider) {
        void handleAgentSend(content);
      } else if (mode === 'direct' && activeProvider) {
        handleDirectSend(content);
      } else if (mode !== 'mock' && !activeProvider) {
        const errMsg: AgentMessage = {
          id: nextId('e'),
          role: 'system',
          content: '⚠️ 未配置 LLM Provider — 请前往「模型配置」页面配置并启用一个 Provider 后再试。',
          timestamp: new Date().toISOString(),
          metadata: { isError: true },
        };
        setRawMessages((prev) => [...prev, errMsg]);
      } else {
        // Mock mode
        const userMsg: AgentMessage = {
          id: nextId('u'),
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        };
        setRawMessages((prev) => [...prev, userMsg]);
        streaming.reset();
        streaming.startStreaming();
        const runId = `run-${Date.now()}`;

        const mockReply = `[Mock] 已收到消息: "${content.slice(0, 80)}"`;
        cancelRef.current = startMockStream(mockReply, {
          onDelta(delta) {
            streaming.feedEvent(
              ({ type: 'agent:stream-delta', runId, timestamp: Date.now(), delta }) as OrbitAgentEvent,
            );
          },
          onDone(fullText) {
            streaming.reset();
            const assistantMsg: AgentMessage = {
              id: nextId('a'),
              role: 'assistant',
              content: fullText,
              timestamp: new Date().toISOString(),
            };
            setRawMessages((prev) => [...prev, assistantMsg]);
            cancelRef.current = null;
          },
          onError() {},
        });
      }
    },
    [mode, activeProvider, streaming, handleAgentSend, handleDirectSend],
  );

  const handleCancel = useCallback(() => {
    // Cancel streaming (direct mode)
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    // Cancel agent mode
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
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
    }
    streaming.reset();
    setThinkingText(null);
  }, [streaming]);

  const handleClear = useCallback(() => {
    setRawMessages([]);
    conversationHistory.current = [];
    setTotalTokens(0);
    streaming.reset();
    setThinkingText(null);
  }, [streaming]);

  const isProcessing = streaming.state.isStreaming || thinkingText !== null;

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <h1 className="text-lg font-bold">对话</h1>

        {/* Mode selector */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1">
          {(['mock', 'direct', 'agent'] as ChatMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {m === 'mock' ? 'Mock' : m === 'direct' ? 'Direct' : `Agent (${toolCount} tools)`}
            </button>
          ))}
        </div>

        {providerEntry && mode !== 'mock' && (
          <Chip size="sm" color="success" variant="soft">🤖 {providerEntry.displayName}</Chip>
        )}
        {!activeProvider && mode !== 'mock' && (
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

      {/* Thinking indicator */}
      {thinkingText && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-secondary/50 px-6 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-xs text-muted">{thinkingText}</span>
        </div>
      )}

      {/* Message stream */}
      {renderableMessages.length === 0 && !isProcessing ? (
        <div className="flex flex-1 items-center justify-center text-muted">
          <div className="text-center">
            <p className="text-4xl">💬</p>
            <p className="mt-2 text-sm">
              {mode === 'agent'
                ? `Agent 模式 — ${toolCount} 个工具可用，发送消息开始对话`
                : '发送消息开始对话'}
            </p>
            {mode === 'agent' && (
              <p className="mt-1 text-xs text-muted">
                Agent 会自动调用 Tools、Skills 和 MCP 来完成任务
              </p>
            )}
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
        isStreaming={isProcessing}
        modelName={modelName}
        tokenCount={totalTokens > 0 ? totalTokens : undefined}
      />
    </div>
  );
}
