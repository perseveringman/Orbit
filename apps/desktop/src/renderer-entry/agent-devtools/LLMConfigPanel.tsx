// ---------------------------------------------------------------------------
// Agent DevTools – LLM Config Panel
// UI for configuring and testing connectivity to all LLM providers.
// ---------------------------------------------------------------------------

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  PROVIDER_CATALOG,
  getCatalogEntry,
  type ProviderCatalogEntry,
} from '@orbit/agent-core';
import {
  LLMConfigStore,
  type LLMProviderUserConfig,
  type ConnectivityResult,
} from './llm-config-store';

// ---- Styling ----

const V = {
  bg: 'oklch(0.11 0.008 260)',
  surface: 'oklch(0.17 0.008 260)',
  surfaceHover: 'oklch(0.20 0.008 260)',
  headerBg: 'oklch(0.14 0.01 260)',
  text: 'oklch(0.93 0.005 260)',
  textDim: 'oklch(0.55 0.01 260)',
  accent: 'oklch(0.65 0.15 250)',
  green: 'oklch(0.65 0.15 145)',
  red: 'oklch(0.60 0.18 25)',
  yellow: 'oklch(0.70 0.15 80)',
  border: 'oklch(0.25 0.01 260)',
  inputBg: 'oklch(0.09 0.006 260)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ---- Transport badge ----

function TransportBadge({ transport }: { transport: string }) {
  const colors: Record<string, string> = {
    'openai_chat': V.accent,
    'anthropic_messages': 'oklch(0.60 0.15 320)',
    'codex_responses': V.yellow,
  };
  const labels: Record<string, string> = {
    'openai_chat': 'OpenAI',
    'anthropic_messages': 'Anthropic',
    'codex_responses': 'Codex',
  };

  return (
    <span
      style={{
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 4,
        border: `1px solid ${colors[transport] ?? V.border}`,
        color: colors[transport] ?? V.textDim,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {labels[transport] ?? transport}
    </span>
  );
}

// ---- Status indicator ----

function StatusDot({ status }: { status: 'none' | 'success' | 'error' | 'auth_error' | 'timeout' | 'testing' }) {
  const color: Record<string, string> = {
    none: V.textDim,
    success: V.green,
    error: V.red,
    auth_error: V.red,
    timeout: V.yellow,
    testing: V.yellow,
  };

  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color[status],
        flexShrink: 0,
        animation: status === 'testing' ? 'pulse 1s infinite' : undefined,
      }}
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
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

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
      style={{
        border: `1px solid ${isConfigured ? V.green + '40' : V.border}`,
        borderRadius: 8,
        background: expanded ? V.surface : 'transparent',
        overflow: 'hidden',
        transition: 'all 0.15s',
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = V.surfaceHover; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <StatusDot status={connStatus} />
        <span style={{ fontWeight: 600, fontSize: 13, color: V.text }}>{entry.displayName}</span>

        {entry.isAggregator && (
          <span style={{ fontSize: 10, color: V.yellow, fontWeight: 600 }}>聚合</span>
        )}

        <TransportBadge transport={entry.transport} />

        {!isApiKeyAuth && (
          <span style={{ fontSize: 10, color: V.textDim }}>
            {entry.authType === 'oauth_device_code' ? '🔐 OAuth' :
             entry.authType === 'oauth_external' ? '🔐 OAuth (ext)' :
             entry.authType === 'external_process' ? '⚙️ 外部进程' : entry.authType}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {isConfigured && (
          <span style={{ fontSize: 10, color: V.green, fontWeight: 600 }}>● 已配置</span>
        )}

        {showSaved && (
          <span style={{ fontSize: 10, color: V.green, fontWeight: 600, animation: 'fadeIn 0.2s' }}>✓ 已保存</span>
        )}

        <span style={{ fontSize: 12, color: V.textDim, transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </div>

      {/* Expanded config form */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Description */}
          <div style={{ fontSize: 12, color: V.textDim, lineHeight: 1.4 }}>
            {entry.description}
            {entry.docUrl && (
              <>
                {' — '}
                <a href={entry.docUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: V.accent, textDecoration: 'none' }}
                >
                  文档 ↗
                </a>
              </>
            )}
          </div>

          {/* API Key */}
          {isApiKeyAuth && (
            <div>
              <label style={{ fontSize: 11, color: V.textDim, display: 'block', marginBottom: 4 }}>
                API Key {entry.apiKeyEnvVars.length > 0 && (
                  <span style={{ fontSize: 10 }}>({entry.apiKeyEnvVars[0]})</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => updateConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${V.border}`,
                    background: V.inputBg,
                    color: V.text,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: `1px solid ${V.border}`,
                    background: 'transparent',
                    color: V.textDim,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {showApiKey ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          )}

          {/* Base URL override */}
          <div>
            <label style={{ fontSize: 11, color: V.textDim, display: 'block', marginBottom: 4 }}>
              Base URL <span style={{ fontSize: 10 }}>(留空使用默认: {entry.defaultBaseUrl})</span>
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => updateConfig({ baseUrl: e.target.value })}
              placeholder={entry.defaultBaseUrl}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${V.border}`,
                background: V.inputBg,
                color: V.text,
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Default Model */}
          <div>
            <label style={{ fontSize: 11, color: V.textDim, display: 'block', marginBottom: 4 }}>
              默认模型 <span style={{ fontSize: 10 }}>(留空使用: {entry.defaultModel})</span>
            </label>
            <input
              type="text"
              value={config.defaultModel}
              onChange={(e) => updateConfig({ defaultModel: e.target.value })}
              placeholder={entry.defaultModel}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${V.border}`,
                background: V.inputBg,
                color: V.text,
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Enabled toggle + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.text, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => updateConfig({ enabled: e.target.checked })}
                style={{ accentColor: V.green }}
              />
              启用
            </label>

            <span style={{ flex: 1 }} />

            {/* Test connectivity */}
            {(
              <button
                onClick={handleTestConnectivity}
                disabled={isTesting || (!hasApiKey && isApiKeyAuth)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${V.border}`,
                  background: 'transparent',
                  color: isTesting ? V.yellow : V.accent,
                  fontSize: 11,
                  cursor: isTesting || (!hasApiKey && isApiKeyAuth) ? 'not-allowed' : 'pointer',
                  fontFamily: V.font,
                  opacity: (!hasApiKey && isApiKeyAuth) ? 0.4 : 1,
                }}
              >
                {isTesting ? '⏳ 测试中...' : '🔗 测试连通性'}
              </button>
            )}

            {/* Test chat */}
            {(entry.transport === 'openai_chat' || entry.transport === 'anthropic_messages') && (
              <button
                onClick={handleTestChat}
                disabled={isChatTesting || !hasApiKey}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${V.border}`,
                  background: 'transparent',
                  color: isChatTesting ? V.yellow : V.green,
                  fontSize: 11,
                  cursor: isChatTesting || !hasApiKey ? 'not-allowed' : 'pointer',
                  fontFamily: V.font,
                  opacity: !hasApiKey ? 0.4 : 1,
                }}
              >
                {isChatTesting ? '⏳ 调用中...' : '💬 测试对话'}
              </button>
            )}
          </div>

          {/* Test connectivity result */}
          {testResult && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 12,
                background: testResult.status === 'success' ? V.green + '15' :
                            testResult.status === 'auth_error' ? V.red + '15' :
                            V.yellow + '15',
                color: testResult.status === 'success' ? V.green :
                       testResult.status === 'auth_error' ? V.red :
                       V.yellow,
                border: `1px solid ${
                  testResult.status === 'success' ? V.green + '30' :
                  testResult.status === 'auth_error' ? V.red + '30' :
                  V.yellow + '30'
                }`,
              }}
            >
              {testResult.status === 'success' ? '✅' : testResult.status === 'auth_error' ? '🔑' : '⚠️'}
              {' '}
              {testResult.message}
              <span style={{ float: 'right', opacity: 0.7 }}>{testResult.latencyMs}ms</span>
            </div>
          )}

          {/* Chat test result */}
          {chatResult && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 12,
                background: chatResult.success ? V.green + '15' : V.red + '15',
                color: chatResult.success ? V.green : V.red,
                border: `1px solid ${chatResult.success ? V.green + '30' : V.red + '30'}`,
              }}
            >
              {chatResult.success ? '✅' : '❌'}{' '}
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: V.font,
        overflow: 'hidden',
      }}
    >
      {/* Header stats */}
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${V.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: V.text }}>
            LLM 供应商配置
          </span>
          <span style={{ fontSize: 11, color: V.textDim }}>
            {PROVIDER_CATALOG.length} 个供应商
          </span>
          <span style={{
            fontSize: 11, padding: '1px 8px', borderRadius: 10,
            background: configuredCount > 0 ? V.green : V.border,
            color: configuredCount > 0 ? V.bg : V.textDim,
            fontWeight: 700,
          }}>
            {configuredCount} 已配置
          </span>
        </div>

        {/* Search bar */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索供应商..."
          style={{
            width: '100%',
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${V.border}`,
            background: V.inputBg,
            color: V.text,
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            ['all', '全部'],
            ['configured', '已配置'],
            ['api_key', 'API Key 认证'],
            ['aggregator', '聚合器'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                border: `1px solid ${filter === key ? V.accent : V.border}`,
                background: filter === key ? V.accent + '20' : 'transparent',
                color: filter === key ? V.accent : V.textDim,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: V.font,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filteredProviders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: V.textDim, fontSize: 13 }}>
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
      <div style={{
        padding: '8px 14px',
        borderTop: `1px solid ${V.border}`,
        fontSize: 11,
        color: V.textDim,
        textAlign: 'center',
        flexShrink: 0,
      }}>
        💡 配置 API Key 并启用后，可在「对话」标签页中使用真实 LLM 模型进行测试
      </div>
    </div>
  );
}
