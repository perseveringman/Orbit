import { type ReactElement, useState, useEffect, useMemo } from 'react';
import { Card, Chip, ProgressBar } from '@heroui/react';
import { PROVIDER_CATALOG, type ProviderCatalogEntry } from '@orbit/agent-core';
import { LLMConfigStore, type LLMProviderUserConfig } from '../stores/llm-config-store';
import { TokenUsageStore, type UsageSummary } from '../stores/token-usage-store';

function StatCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'default';
}): ReactElement {
  const colorClasses = {
    primary: 'bg-primary-50 dark:bg-primary-900/20',
    success: 'bg-success-50 dark:bg-success-900/20',
    warning: 'bg-warning-50 dark:bg-warning-900/20',
    danger: 'bg-danger-50 dark:bg-danger-900/20',
    default: 'bg-default-50 dark:bg-default-800/20',
  };

  return (
    <Card className={`p-4 ${colorClasses[color ?? 'default']}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-default-500">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-default-400">{subtitle}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </Card>
  );
}

function ProviderStatusRow({ entry, config }: {
  entry: ProviderCatalogEntry;
  config?: LLMProviderUserConfig;
}): ReactElement {
  const isConfigured = config && config.apiKey.length > 0;
  const isEnabled = config?.enabled ?? false;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-default-200 px-3 py-2">
      <span className="text-lg">🤖</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{entry.displayName}</p>
        <p className="text-xs text-default-400">{entry.defaultModel}</p>
      </div>
      {isEnabled ? (
        <Chip size="sm" color="success" variant="soft">活跃</Chip>
      ) : isConfigured ? (
        <Chip size="sm" color="warning" variant="soft">已配置</Chip>
      ) : (
        <Chip size="sm" color="default" variant="soft">未配置</Chip>
      )}
    </div>
  );
}

export function OverviewPage(): ReactElement {
  const [configs, setConfigs] = useState<readonly LLMProviderUserConfig[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    setConfigs(LLMConfigStore.getAll());
    setUsage(TokenUsageStore.getSummary());
  }, []);

  const activeProvider = useMemo(
    () => configs.find((c) => c.enabled),
    [configs],
  );
  const configuredCount = useMemo(
    () => configs.filter((c) => c.apiKey.length > 0).length,
    [configs],
  );

  const totalCost = usage?.totalCostUsd ?? 0;
  const totalTokens = usage?.totalTokens ?? 0;
  const sessionCount = usage?.sessionCount ?? 0;

  const formatTokens = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k`
      : `${n}`;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">概览</h1>
        <p className="text-sm text-default-500">Agent 系统运行状态</p>
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard
          title="总 Token 用量"
          value={formatTokens(totalTokens)}
          subtitle={`${sessionCount} 次会话`}
          icon="📊"
          color="primary"
        />
        <StatCard
          title="估算费用"
          value={`$${totalCost.toFixed(4)}`}
          subtitle="本会话累计"
          icon="💰"
          color={totalCost > 1 ? 'warning' : 'success'}
        />
        <StatCard
          title="活跃模型"
          value={activeProvider ? '1' : '0'}
          subtitle={activeProvider
            ? PROVIDER_CATALOG.find((e) => e.id === activeProvider.providerId)?.displayName ?? activeProvider.providerId
            : '未配置'
          }
          icon="🤖"
          color={activeProvider ? 'success' : 'default'}
        />
        <StatCard
          title="已配置 Provider"
          value={`${configuredCount}/${PROVIDER_CATALOG.length}`}
          icon="🔧"
          color="default"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Provider status */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-default-700">模型 Provider 状态</h2>
          <div className="flex flex-col gap-2">
            {PROVIDER_CATALOG.slice(0, 8).map((entry) => (
              <ProviderStatusRow
                key={entry.id}
                entry={entry}
                config={configs.find((c) => c.providerId === entry.id)}
              />
            ))}
            {PROVIDER_CATALOG.length > 8 && (
              <p className="mt-1 text-center text-xs text-default-400">
                +{PROVIDER_CATALOG.length - 8} 个更多 Provider…
              </p>
            )}
          </div>
        </div>

        {/* Recent usage & system info */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-default-700">系统信息</h2>
          <Card className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Agent Core 版本</span>
                <span className="font-medium">0.1.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">内置工具</span>
                <span className="font-medium">13 个</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Domain Agents</span>
                <span className="font-medium">7 个</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Safety 等级</span>
                <span className="font-medium">R0–R3 / A0–A3</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">内存层</span>
                <span className="font-medium">L0–L5 (6 层)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">MCP 服务</span>
                <span className="font-medium">0 个已连接</span>
              </div>
            </div>
          </Card>

          <h2 className="mb-3 mt-6 text-sm font-semibold text-default-700">Token 预算</h2>
          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-default-500">每日上限</span>
                <span className="font-medium">$10.00</span>
              </div>
              <ProgressBar
                value={Math.min((totalCost / 10) * 100, 100)}
                color={totalCost > 8 ? 'danger' : totalCost > 5 ? 'warning' : 'success'}
                size="sm"
                className="mt-1"
              />
              <p className="text-xs text-default-400">
                已使用 ${totalCost.toFixed(4)} / $10.00
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
