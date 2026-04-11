import { type ReactElement, useState, useRef, useCallback } from 'react';
import { Chip, Switch, Button } from '@heroui/react';
import { PROVIDER_CATALOG } from '@orbit/agent-core';
import type { AgentMessage } from '@orbit/agent-core';
import {
  ConversationStream,
  ConversationHeader,
  PromptInput,
  normalizeMessages,
  useConversationSearch,
  classifyError,
  errorToRenderableMessage,
} from '@orbit/conversation-ui';
import { LLMConfigStore } from '../stores/llm-config-store';
import { TokenUsageStore } from '../stores/token-usage-store';

type ChatMode = 'mock' | 'real';

let msgSeq = 0;
function nextId(suffix: string): string {
  return `msg-${++msgSeq}-${suffix}`;
}

export function ChatPage(): ReactElement {
  const [mode, setMode] = useState<ChatMode>(() => {
    return (localStorage.getItem('orbit:agent-hub:chat-mode') as ChatMode) ?? 'real';
  });
  const [rawMessages, setRawMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);

  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);

  const renderableMessages = normalizeMessages(rawMessages);
  const search = useConversationSearch(renderableMessages);

  const activeProvider = LLMConfigStore.getAll().find((c) => c.enabled);
  const providerEntry = activeProvider
    ? PROVIDER_CATALOG.find((e) => e.id === activeProvider.providerId)
    : null;

  const modelName = providerEntry?.displayName ?? (mode === 'mock' ? 'Mock' : undefined);

  const handleModeChange = useCallback((isReal: boolean) => {
    const newMode = isReal ? 'real' : 'mock';
    setMode(newMode);
    localStorage.setItem('orbit:agent-hub:chat-mode', newMode);
  }, []);

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: AgentMessage = {
      id: nextId('u'),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setRawMessages((prev) => [...prev, userMsg]);
    conversationHistory.current.push({ role: 'user', content });
    setIsLoading(true);

    try {
      if (mode === 'real' && activeProvider) {
        const result = await LLMConfigStore.chatViaProxy(
          activeProvider,
          conversationHistory.current,
        );

        const model = activeProvider.defaultModel || providerEntry?.defaultModel || 'unknown';
        const provider = providerEntry?.id ?? 'unknown';
        const promptTokens = Math.ceil(
          conversationHistory.current.reduce((s, m) => s + m.content.length, 0) / 4,
        );
        const completionTokens = Math.ceil(result.text.length / 4);

        TokenUsageStore.record({ model, provider, promptTokens, completionTokens });
        setTotalTokens((prev) => prev + promptTokens + completionTokens);

        const assistantMsg: AgentMessage = {
          id: nextId('a'),
          role: 'assistant',
          content: result.text,
          timestamp: new Date().toISOString(),
        };
        setRawMessages((prev) => [...prev, assistantMsg]);
        conversationHistory.current.push({ role: 'assistant', content: result.text });
      } else {
        await new Promise((r) => setTimeout(r, 500));
        const mockReply = `[Mock] 已收到消息: "${content.slice(0, 50)}..."`;
        const assistantMsg: AgentMessage = {
          id: nextId('a'),
          role: 'assistant',
          content: mockReply,
          timestamp: new Date().toISOString(),
        };
        setRawMessages((prev) => [...prev, assistantMsg]);
        conversationHistory.current.push({ role: 'assistant', content: mockReply });
      }
    } catch (err) {
      const classified = classifyError(err);
      const errRenderable = errorToRenderableMessage(classified);
      const errMsg: AgentMessage = {
        id: errRenderable.id,
        role: 'system',
        content: errRenderable.content,
        timestamp: errRenderable.timestamp,
        metadata: { isError: true },
      };
      setRawMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mode, activeProvider, providerEntry]);

  const handleClear = useCallback(() => {
    setRawMessages([]);
    conversationHistory.current = [];
    setTotalTokens(0);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <h1 className="text-lg font-bold">对话</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Mock</span>
          <Switch size="sm" isSelected={mode === 'real'} onChange={handleModeChange} />
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
          <Button size="sm" variant="ghost" onPress={handleClear}>清空</Button>
        </div>
      </div>

      {/* Conversation header (search toggle) */}
      <ConversationHeader
        modelName={modelName}
        onToggleSearch={search.state.isOpen ? search.close : search.open}
        isSearchOpen={search.state.isOpen}
      />

      {/* Message stream */}
      {renderableMessages.length === 0 && !isLoading ? (
        <div className="flex flex-1 items-center justify-center text-default-300">
          <div className="text-center">
            <p className="text-4xl">💬</p>
            <p className="mt-2 text-sm">发送消息开始对话</p>
          </div>
        </div>
      ) : (
        <ConversationStream
          messages={renderableMessages}
          searchQuery={search.state.query}
          streamingState={isLoading ? { content: '', isStreaming: true, toolCalls: [], lastUpdate: Date.now() } : undefined}
        />
      )}

      {/* Input */}
      <PromptInput
        onSend={handleSend}
        isStreaming={isLoading}
        modelName={modelName}
        tokenCount={totalTokens > 0 ? totalTokens : undefined}
      />
    </div>
  );
}
