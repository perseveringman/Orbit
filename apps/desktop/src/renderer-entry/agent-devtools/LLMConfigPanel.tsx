// ---------------------------------------------------------------------------
// Agent DevTools – LLM Config Panel
// UI for configuring and testing connectivity to all LLM providers.
// ---------------------------------------------------------------------------

import { useState, useCallback, useRef } from 'react';
import { Button, Chip } from '@heroui/react';
import { EyeOff, Eye, Loader2, Link, MessageCircle, CheckCircle, XCircle, KeyRound, AlertTriangle, Lock, Settings, Lightbulb, ChevronDown, Check } from 'lucide-react';
import {
  PROVIDER_CATALOG,
  type ProviderCatalogEntry,
} from '@orbit/agent-core';
import {
  LLMConfigStore,
  type LLMProviderUserConfig,
  type ConnectivityResult,
} from './llm-config-store';

// ---- Transport badge ----

function TransportBadge({ transport }: { transport: string }) {
  const chipColor: Record<string, 'accent' | 'warning' | 'default'> = {
    'openai_chat': 'accent',
    'anthropic_messages': 'accent',
    'codex_responses': 'warning',
  };
  const labels: Record<string, string> = {
    'openai_chat': 'OpenAI',
    'anthropic_messages': 'Anthropic',
    'codex_responses': 'Codex',
  };

  return (
    <Chip size="sm" variant="soft" color={chipColor[transport] ?? 'default'}>
      {labels[transport] ?? transport}
    </Chip>
  );
}

// ---- Status indicator ----

function StatusDot({ status }: { status: 'none' | 'success' | 'error' | 'auth_error' | 'timeout' | 'testing' }) {
  const colorClass: Record<string, string> = {
    none: 'bg-muted',
    success: 'bg-success',
    error: 'bg-danger',
    auth_error: 'bg-danger',
    timeout: 'bg-warning',
    testing: 'bg-warning',
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClass[status]}`}
      style={{ animation: status === 'testing' ? 'pulse 1s infinite' : undefined }}
    />
  );
}

// ---- Per-Provider Config Card ----

interface ProviderCardProps {
  entry: ProviderCatalogEntry;
  onConfigChanged: () => void;
}

function ProviderCard({ entry, onConfigChanged }: ProviderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<LLMProviderUserConfig>(() =>
    LLMConfigStore.get(entry.id) ?? {
      providerId: entry.id,
      apiKey: '',
      baseUrl: '',
      enabled: false,
      defaultModel: '',
    },
  );

  const [testResult, setTestResult] = useState<ConnectivityResult | null>(null);
  const [chatResult, setChatResult] = useState<{ success: boolean; response?: string; error?: string; latencyMs: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isChatTesting, setIsChatTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isApiKeyAuth = entry.authType === 'api_key';
  const hasApiKey = config.apiKey.length > 0;
  const isConfigured = hasApiKey && config.enabled;

  const updateConfig = useCallback((updates: Partial<LLMProviderUserConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      LLMConfigStore.set(next);
      onConfigChanged();
      return next;
    });
    // Show saved indicator
    setShowSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
    // Clear stale test results
    setTestResult(null);
    setChatResult(null);
  }, [entry.id, onConfigChanged]);

  const handleTestConnectivity = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await LLMConfigStore.testConnectivity(entry, config);
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  }, [entry, config]);

  const handleTestChat = useCallback(async () => {
    setIsChatTesting(true);
    setChatResult(null);
    try {
      const result = await LLMConfigStore.testChatCompletion(entry, config);
      setChatResult(result);
    } finally {
      setIsChatTesting(false);
    }
  }, [entry, config]);

  const connStatus: 'none' | 'success' | 'error' | 'auth_error' | 'timeout' | 'testing' =
    isTesting ? 'testing' : (testResult?.status ?? 'none');

  return (
    <div
      className={`rounded-lg overflow-hidden transition-all min-w-0 border ${
        isConfigured ? 'border-success/25' : 'border-border'
      } ${expanded ? 'bg-surface' : 'bg-transparent hover:bg-surface-secondary'}`}
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center flex-wrap gap-2 px-3 py-2.5 cursor-pointer select-none"
      >
        <StatusDot status={connStatus} />
        <span className="font-semibold text-[13px] text-foreground min-w-0 overflow-hidden text-ellipsis">{entry.displayName}</span>

        {entry.isAggregator && (
          <span className="text-[10px] text-warning font-semibold">聚合</span>
        )}

        <TransportBadge transport={entry.transport} />

        {!isApiKeyAuth && (
          <span className="text-[10px] text-muted">
            {entry.authType === 'oauth_device_code' ? <><Lock size={14} className="inline" /> OAuth</> :
             entry.authType === 'oauth_external' ? <><Lock size={14} className="inline" /> OAuth (ext)</> :
             entry.authType === 'external_process' ? <><Settings size={14} className="inline" /> 外部进程</> : entry.authType}
          </span>
        )}

        <span className="flex-1 min-w-[12px]" />

        {isConfigured && (
          <span className="text-[10px] text-success font-semibold">● 已配置</span>
        )}

        {showSaved && (
          <span className="text-[10px] text-success font-semibold animate-[fadeIn_0.2s]"><Check size={14} className="inline" /> 已保存</span>
        )}

        <span className={`text-xs text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} />
        </span>
      </div>

      {/* Expanded config form */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2.5 min-w-0">
          {/* Description */}
          <div className="text-xs text-muted leading-relaxed">
            {entry.description}
            {entry.docUrl && (
              <>
                {' — '}
                <a href={entry.docUrl} target="_blank" rel="noopener noreferrer"
                  className="text-accent no-underline hover:underline"
                >
                  文档 ↗
                </a>
              </>
            )}
          </div>

          {/* API Key */}
          {isApiKeyAuth && (
            <div>
              <label className="text-[11px] text-muted block mb-1">
                API Key {entry.apiKeyEnvVars.length > 0 && (
                  <span className="text-[10px]">({entry.apiKeyEnvVars[0]})</span>
                )}
              </label>
              <div className="flex gap-1.5">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => updateConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-surface-tertiary text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-focus"
                />
                <Button variant="ghost" size="sm" isIconOnly onPress={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
          )}

          {/* Base URL override */}
          <div>
            <label className="text-[11px] text-muted block mb-1">
              Base URL <span className="text-[10px]">(留空使用默认: {entry.defaultBaseUrl})</span>
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => updateConfig({ baseUrl: e.target.value })}
              placeholder={entry.defaultBaseUrl}
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-surface-tertiary text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-focus box-border"
            />
          </div>

          {/* Default Model */}
          <div>
            <label className="text-[11px] text-muted block mb-1">
              默认模型 <span className="text-[10px]">(留空使用: {entry.defaultModel})</span>
            </label>
            <input
              type="text"
              value={config.defaultModel}
              onChange={(e) => updateConfig({ defaultModel: e.target.value })}
              placeholder={entry.defaultModel}
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-surface-tertiary text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-focus box-border"
            />
          </div>

          {/* Enabled toggle + action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => updateConfig({ enabled: e.target.checked })}
                className="accent-success"
              />
              启用
            </label>

            <span className="flex-1" />

            {/* Test connectivity */}
            <Button
              variant="ghost"
              size="sm"
              onPress={handleTestConnectivity}
              isDisabled={isTesting || (!hasApiKey && isApiKeyAuth)}
              className={isTesting ? 'text-warning' : 'text-accent'}
            >
              {isTesting ? <><Loader2 size={14} className="inline animate-spin" /> 测试中...</> : <><Link size={14} className="inline" /> 测试连通性</>}
            </Button>

            {/* Test chat */}
            {(entry.transport === 'openai_chat' || entry.transport === 'anthropic_messages') && (
              <Button
                variant="ghost"
                size="sm"
                onPress={handleTestChat}
                isDisabled={isChatTesting || !hasApiKey}
                className={isChatTesting ? 'text-warning' : 'text-success'}
              >
                {isChatTesting ? <><Loader2 size={14} className="inline animate-spin" /> 调用中...</> : <><MessageCircle size={14} className="inline" /> 测试对话</>}
              </Button>
            )}
          </div>

          {/* Test connectivity result */}
          {testResult && (
            <div
              className={`px-2.5 py-2 rounded-md text-xs flex items-center justify-between gap-2.5 flex-wrap border ${
                testResult.status === 'success'
                  ? 'bg-success/10 text-success border-success/20'
                  : testResult.status === 'auth_error'
                  ? 'bg-danger/10 text-danger border-danger/20'
                  : 'bg-warning/10 text-warning border-warning/20'
              }`}
            >
              <span className="min-w-0 break-all">
                {testResult.status === 'success' ? <CheckCircle size={14} className="inline" /> : testResult.status === 'auth_error' ? <KeyRound size={14} className="inline" /> : <AlertTriangle size={14} className="inline" />}
                {' '}
                {testResult.message}
              </span>
              <span className="opacity-70 shrink-0">{testResult.latencyMs}ms</span>
            </div>
          )}

          {/* Chat test result */}
          {chatResult && (
            <div
              className={`px-2.5 py-2 rounded-md text-xs break-all border ${
                chatResult.success
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-danger/10 text-danger border-danger/20'
              }`}
            >
              {chatResult.success ? <CheckCircle size={14} className="inline" /> : <XCircle size={14} className="inline" />}{' '}
              {chatResult.success
                ? `${chatResult.response} (${chatResult.latencyMs}ms)`
                : `${chatResult.error} (${chatResult.latencyMs}ms)`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main Panel ----

export interface LLMConfigPanelProps {
  onConfigChanged?: () => void;
}

export function LLMConfigPanel({ onConfigChanged }: LLMConfigPanelProps) {
  const [filter, setFilter] = useState<'all' | 'configured' | 'api_key' | 'aggregator'>('all');
  const [search, setSearch] = useState('');
  const [, setTick] = useState(0);

  const handleConfigChanged = useCallback(() => {
    setTick((t) => t + 1);
    onConfigChanged?.();
  }, [onConfigChanged]);

  // Filter providers
  const filteredProviders = PROVIDER_CATALOG.filter((entry) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const match = entry.displayName.toLowerCase().includes(q)
        || entry.id.includes(q)
        || entry.description.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Category filter
    switch (filter) {
      case 'configured': {
        const cfg = LLMConfigStore.get(entry.id);
        return cfg != null && cfg.enabled && cfg.apiKey.length > 0;
      }
      case 'api_key':
        return entry.authType === 'api_key';
      case 'aggregator':
        return entry.isAggregator;
      default:
        return true;
    }
  });

  const configuredCount = PROVIDER_CATALOG.filter((e) => {
    const cfg = LLMConfigStore.get(e.id);
    return cfg != null && cfg.enabled && cfg.apiKey.length > 0;
  }).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header stats */}
      <div className="px-3.5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground">
            LLM 供应商配置
          </span>
          <span className="text-[11px] text-muted">
            {PROVIDER_CATALOG.length} 个供应商
          </span>
          <Chip size="sm" variant="soft" color={configuredCount > 0 ? 'success' : 'default'}>
            {configuredCount} 已配置
          </Chip>
        </div>

        {/* Search bar */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索供应商..."
          className="w-full px-2.5 py-1.5 rounded-md border border-border bg-surface-tertiary text-foreground text-xs outline-none focus:ring-1 focus:ring-focus box-border mb-2"
        />

        {/* Filter buttons */}
        <div className="flex gap-1 flex-wrap">
          {([
            ['all', '全部'],
            ['configured', '已配置'],
            ['api_key', 'API Key 认证'],
            ['aggregator', '聚合器'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-[3px] rounded-md text-[11px] cursor-pointer transition-colors border ${
                filter === key
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-transparent text-muted hover:bg-surface-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider list */}
      <div className="flex-1 overflow-auto p-2.5 flex flex-col gap-2 min-w-0">
        {filteredProviders.length === 0 ? (
          <div className="text-center p-8 text-muted text-sm">
            没有匹配的供应商
          </div>
        ) : (
          filteredProviders.map((entry) => (
            <ProviderCard
              key={entry.id}
              entry={entry}
              onConfigChanged={handleConfigChanged}
            />
          ))
        )}
      </div>

      {/* Footer tip */}
      <div className="px-3.5 py-2 border-t border-border text-[11px] text-muted text-center shrink-0">
        <Lightbulb size={14} className="inline" /> 配置 API Key 并启用后，可在「对话」标签页中使用真实 LLM 模型进行测试
      </div>
    </div>
  );
}
