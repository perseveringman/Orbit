import React, { type ReactElement, useState, useRef, useCallback, useEffect } from 'react';
import { Card, Button, Chip, Switch, Input } from '@heroui/react';
import { AgentChatPanel, type AgentChatViewModel } from '@orbit/feature-workbench';
import { PROVIDER_CATALOG } from '@orbit/agent-core';
import { LLMConfigStore } from '../stores/llm-config-store';
import { TokenUsageStore } from '../stores/token-usage-store';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenUsage?: { prompt: number; completion: number };
}

type ChatMode = 'mock' | 'real';

export function ChatPage(): ReactElement {
  const [mode, setMode] = useState<ChatMode>(() => {
    return (localStorage.getItem('orbit:agent-hub:chat-mode') as ChatMode) ?? 'real';
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);

  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);

  const handleModeChange = useCallback((isReal: boolean) => {
    const newMode = isReal ? 'real' : 'mock';
    setMode(newMode);
    localStorage.setItem('orbit:agent-hub:chat-mode', newMode);
  }, []);

  const activeProvider = LLMConfigStore.getAll().find((c) => c.enabled);
  const providerEntry = activeProvider
    ? PROVIDER_CATALOG.find((e) => e.id === activeProvider.providerId)
    : null;

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    conversationHistory.current.push({ role: 'user', content });
    setIsLoading(true);

    try {
      if (mode === 'real' && activeProvider) {
        const result = await LLMConfigStore.chatViaProxy(
          activeProvider,
          conversationHistory.current,
        );

        // Record token usage
        const model = activeProvider.defaultModel || providerEntry?.defaultModel || 'unknown';
        const provider = providerEntry?.id ?? 'unknown';

        // Parse actual token usage from response if available
        // For now estimate: ~4 chars/token
        const promptTokens = Math.ceil(
          conversationHistory.current.reduce((s, m) => s + m.content.length, 0) / 4,
        );
        const completionTokens = Math.ceil(result.text.length / 4);

        TokenUsageStore.record({ model, provider, promptTokens, completionTokens });
        setTotalTokens((prev) => prev + promptTokens + completionTokens);

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-a`,
          role: 'assistant',
          content: result.text,
          timestamp: Date.now(),
          tokenUsage: { prompt: promptTokens, completion: completionTokens },
        };
        setMessages((prev) => [...prev, assistantMsg]);
        conversationHistory.current.push({ role: 'assistant', content: result.text });
      } else {
        // Mock response
        await new Promise((r) => setTimeout(r, 500));
        const mockReply = `[Mock] 已收到消息: "${content.slice(0, 50)}..."`;
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-a`,
          role: 'assistant',
          content: mockReply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        conversationHistory.current.push({ role: 'assistant', content: mockReply });
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-e`,
        role: 'assistant',
        content: `❌ 错误: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mode, activeProvider, providerEntry]);

  const handleClear = useCallback(() => {
    setMessages([]);
    conversationHistory.current = [];
    setTotalTokens(0);
  }, []);

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <h1 className="text-lg font-bold">对话</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Mock</span>
          <Switch
            size="sm"
            isSelected={mode === 'real'}
            onChange={handleModeChange}
          />
          <span className="text-xs text-muted">Real LLM</span>
        </div>
        {providerEntry && mode === 'real' && (
          <Chip size="sm" color="success" variant="soft">
            🤖 {providerEntry.displayName}
          </Chip>
        )}
        {!activeProvider && mode === 'real' && (
          <Chip size="sm" color="warning" variant="soft">
            ⚠️ 未配置 Provider
          </Chip>
        )}
        <div className="ml-auto flex items-center gap-3">
          {totalTokens > 0 && (
            <span className="text-xs text-muted">
              Tokens: {totalTokens.toLocaleString()}
            </span>
          )}
          <Button size="sm" variant="ghost" onPress={handleClear}>
            清空
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-default-300">
            <div className="text-center">
              <p className="text-4xl">💬</p>
              <p className="mt-2 text-sm">发送消息开始对话</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-secondary text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] opacity-50">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                    {msg.tokenUsage && (
                      <span className="text-[10px] opacity-50">
                        {msg.tokenUsage.prompt}+{msg.tokenUsage.completion} tokens
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-surface-secondary px-4 py-2.5">
                  <span className="animate-pulse text-sm text-muted">思考中…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) {
              handleSend(draft);
              setDraft('');
            }
          }}
          className="flex gap-2"
        >
          <Input
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            placeholder="输入消息…"
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            isDisabled={!draft.trim() || isLoading}
            isPending={isLoading}
          >
            发送
          </Button>
        </form>
      </div>
    </div>
  );
}
