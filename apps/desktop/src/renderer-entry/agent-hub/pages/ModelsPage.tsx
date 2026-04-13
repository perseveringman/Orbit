import React, { type ReactElement, useState, useEffect, useCallback } from 'react';
import { Card, Button, Chip, Input, Switch, Modal, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { PROVIDER_CATALOG, type ProviderCatalogEntry } from '@orbit/agent-core';
import { LLMConfigStore, type LLMProviderUserConfig } from '../stores/llm-config-store';

type TestStatus = 'idle' | 'testing' | 'success' | 'error' | 'auth_error';

function TransportBadge({ transport }: { transport: string }): ReactElement {
  const map: Record<string, { label: string; color: 'accent' | 'warning' }> = {
    openai_chat: { label: 'OpenAI', color: 'accent' },
    anthropic_messages: { label: 'Anthropic', color: 'accent' },
    codex_responses: { label: 'Codex', color: 'warning' },
  };
  const info = map[transport] ?? { label: transport, color: 'accent' as const };
  return <Chip size="sm" variant="soft" color={info.color}>{info.label}</Chip>;
}

function ProviderCard({ entry, config, onUpdate, onTest, onChatTest }: {
  entry: ProviderCatalogEntry;
  config: LLMProviderUserConfig;
  onUpdate: (updates: Partial<LLMProviderUserConfig>) => void;
  onTest: () => Promise<void>;
  onChatTest: () => Promise<void>;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [chatTesting, setChatTesting] = useState(false);
  const [chatResult, setChatResult] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const isConfigured = config.apiKey.length > 0;

  const handleTest = useCallback(async () => {
    setTestStatus('testing');
    setTestResult(null);
    try {
      const result = await LLMConfigStore.testConnectivity(entry, config);
      if (result.status === 'success') {
        setTestStatus('success');
        setTestResult(`✅ ${result.latencyMs}ms`);
      } else {
        setTestStatus(result.status === 'auth_error' ? 'auth_error' : 'error');
        setTestResult(`❌ ${result.message}`);
      }
    } catch (err) {
      setTestStatus('error');
      setTestResult(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [entry, config]);

  const handleChatTest = useCallback(async () => {
    setChatTesting(true);
    setChatResult(null);
    try {
      const result = await LLMConfigStore.testChatCompletion(entry, config);
      setChatResult(result?.success ? `✅ "${result.response?.slice(0, 100)}" (${result.latencyMs}ms)` : `❌ ${result?.error ?? 'Unknown error'}`);
    } catch (err) {
      setChatResult(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setChatTesting(false);
    }
  }, [entry, config]);

  const statusColor = testStatus === 'success' ? 'success'
    : testStatus === 'error' ? 'danger'
    : testStatus === 'auth_error' ? 'warning'
    : testStatus === 'testing' ? 'accent'
    : 'default';

  return (
    <Card
      className={`transition-all ${config.enabled ? 'border-2 border-accent' : 'border border-border'}`}
    >
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xl">🤖</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{entry.displayName}</span>
            <TransportBadge transport={entry.transport} />
            {testStatus !== 'idle' && (
              <Chip size="sm" color={statusColor} variant="soft">
                {testStatus === 'testing' ? '测试中' : testStatus}
              </Chip>
            )}
          </div>
          <p className="text-xs text-muted">{entry.defaultModel}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            size="sm"
            isSelected={config.enabled}
            onChange={(v) => onUpdate({ enabled: v })}
          />
        </div>
        <span className="text-muted">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-3">
            {entry.authType === 'api_key' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">API Key</label>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={config.apiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ apiKey: e.target.value })}
                    className="flex-1"
                  />
                  <Button size="sm" variant="ghost" onPress={() => setShowKey((v) => !v)}>
                    {showKey ? '🙈' : '👁️'}
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Base URL <span className="text-default-300">(留空使用默认)</span>
              </label>
              <Input
                placeholder={entry.defaultBaseUrl}
                value={config.baseUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ baseUrl: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                默认模型 <span className="text-default-300">(留空使用 {entry.defaultModel})</span>
              </label>
              <Input
                placeholder={entry.defaultModel}
                value={config.defaultModel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ defaultModel: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                isDisabled={!isConfigured || testStatus === 'testing'}
                isPending={testStatus === 'testing'}
                onPress={handleTest}
              >
                测试连通性
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={!isConfigured || chatTesting}
                isPending={chatTesting}
                onPress={handleChatTest}
              >
                测试对话
              </Button>
            </div>

            {testResult && (
              <p className="text-xs text-muted">{testResult}</p>
            )}
            {chatResult && (
              <p className="text-xs text-muted">{chatResult}</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export function ModelsPage(): ReactElement {
  const [configs, setConfigs] = useState<LLMProviderUserConfig[]>([]);

  useEffect(() => {
    const saved = LLMConfigStore.getAll();
    // Ensure every catalog provider has a config entry so map-based updates work
    const full = PROVIDER_CATALOG.map((entry) => {
      const existing = saved.find((c) => c.providerId === entry.id);
      return existing ?? {
        providerId: entry.id,
        apiKey: '',
        baseUrl: '',
        enabled: false,
        defaultModel: '',
      };
    });
    setConfigs(full);
  }, []);

  const handleUpdate = useCallback((providerId: string, updates: Partial<LLMProviderUserConfig>) => {
    setConfigs((prev) => {
      const next = prev.map((c) => {
        if (c.providerId === providerId) {
          return { ...c, ...updates };
        }
        // If enabling this one, disable others
        if (updates.enabled && c.providerId !== providerId) {
          return { ...c, enabled: false };
        }
        return c;
      });

      // Only save configs that actually changed (avoid redundant writes)
      const changed = next.filter((c, i) => {
        const old = prev[i];
        return !old || c.providerId !== old.providerId
          || c.apiKey !== old.apiKey || c.baseUrl !== old.baseUrl
          || c.enabled !== old.enabled || c.defaultModel !== old.defaultModel;
      });
      for (const c of changed) {
        LLMConfigStore.set(c);
      }

      return next;
    });
  }, []);

  const enabledCount = configs.filter((c) => c.enabled).length;
  const configuredCount = configs.filter((c) => c.apiKey.length > 0).length;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">模型配置</h1>
          <p className="text-sm text-muted">
            配置 LLM Provider 的 API Key 和连接参数 ·
            已配置 {configuredCount}/{PROVIDER_CATALOG.length} · 活跃 {enabledCount}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {PROVIDER_CATALOG.map((entry) => {
          const config = configs.find((c) => c.providerId === entry.id);
          if (!config) return null;
          return (
            <ProviderCard
              key={entry.id}
              entry={entry}
              config={config}
              onUpdate={(updates) => handleUpdate(entry.id, updates)}
              onTest={async () => {}}
              onChatTest={async () => {}}
            />
          );
        })}
      </div>
    </div>
  );
}
