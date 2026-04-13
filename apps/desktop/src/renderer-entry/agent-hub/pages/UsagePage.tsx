import { type ReactElement, useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import { Card, Chip, Button } from '@heroui/react';
import { TokenUsageStore, type TokenUsageRecord, type UsageByDimension } from '../stores/token-usage-store';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}

function BarChart({ data, maxValue, colorClass }: {
  data: Array<{ label: string; value: number }>;
  maxValue: number;
  colorClass: string;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-24 truncate text-right text-xs text-muted">{d.label}</span>
          <div className="flex-1">
            <div
              className={`h-5 rounded ${colorClass} transition-all`}
              style={{ width: maxValue > 0 ? `${Math.max((d.value / maxValue) * 100, 1)}%` : '1%' }}
            >
              <span className="flex h-full items-center px-2 text-[10px] font-medium text-white">
                {formatTokens(d.value)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CostBarChart({ data, maxValue }: {
  data: Array<{ label: string; value: number }>;
  maxValue: number;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-24 truncate text-right text-xs text-muted">{d.label}</span>
          <div className="flex-1">
            <div
              className="h-5 rounded bg-warning-400 transition-all"
              style={{ width: maxValue > 0 ? `${Math.max((d.value / maxValue) * 100, 1)}%` : '1%' }}
            >
              <span className="flex h-full items-center px-2 text-[10px] font-medium text-white">
                {formatCost(d.value)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type GroupBy = 'model' | 'provider' | 'day';

export function UsagePage(): ReactElement {
  const [groupBy, setGroupBy] = useState<GroupBy>('provider');

  // Subscribe to TokenUsageStore so data refreshes when new records are added
  const summary = useSyncExternalStore(
    TokenUsageStore.subscribe,
    () => TokenUsageStore.getSummary(),
  );
  const records = useSyncExternalStore(
    TokenUsageStore.subscribe,
    () => TokenUsageStore.loadRecords(),
  );

  const grouped = useMemo((): UsageByDimension[] => {
    switch (groupBy) {
      case 'model': return TokenUsageStore.getByModel();
      case 'provider': return TokenUsageStore.getByProvider();
      case 'day': return TokenUsageStore.getByDay();
    }
  }, [groupBy, records]);

  const maxTokens = Math.max(...grouped.map((g) => g.totalTokens), 1);
  const maxCost = Math.max(...grouped.map((g) => g.totalCost), 0.0001);

  const handleClear = useCallback(() => {
    TokenUsageStore.clear();
    // No need for window.location.reload() — useSyncExternalStore will pick up the change
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Token 用量</h1>
          <p className="text-sm text-muted">
            追踪 Token 使用量与费用估算
          </p>
        </div>
        <Button size="sm" variant="danger" onPress={handleClear}>
          清空记录
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <Card className="bg-accent-soft p-4">
          <p className="text-xs font-medium text-muted">总 Token</p>
          <p className="mt-1 text-2xl font-bold">{formatTokens(summary.totalTokens)}</p>
          <p className="text-xs text-muted">{summary.recordCount} 次调用</p>
        </Card>
        <Card className="bg-success-soft p-4">
          <p className="text-xs font-medium text-muted">Prompt Tokens</p>
          <p className="mt-1 text-2xl font-bold">{formatTokens(summary.totalPromptTokens)}</p>
          <p className="text-xs text-muted">
            {summary.totalTokens > 0
              ? `${Math.round((summary.totalPromptTokens / summary.totalTokens) * 100)}% 占比`
              : '0%'}
          </p>
        </Card>
        <Card className="bg-accent-soft p-4 ">
          <p className="text-xs font-medium text-muted">Completion Tokens</p>
          <p className="mt-1 text-2xl font-bold">{formatTokens(summary.totalCompletionTokens)}</p>
          <p className="text-xs text-muted">
            {summary.totalTokens > 0
              ? `${Math.round((summary.totalCompletionTokens / summary.totalTokens) * 100)}% 占比`
              : '0%'}
          </p>
        </Card>
        <Card className="bg-warning-soft p-4">
          <p className="text-xs font-medium text-muted">估算费用</p>
          <p className="mt-1 text-2xl font-bold">{formatCost(summary.totalCostUsd)}</p>
          <p className="text-xs text-muted">{summary.sessionCount} 次会话</p>
        </Card>
      </div>

      {/* Group-by selector */}
      <div className="mb-4 flex gap-2">
        <Button
          size="sm"
          variant={groupBy === 'provider' ? 'primary' : 'ghost'}
          onPress={() => setGroupBy('provider')}
        >
          按 Provider
        </Button>
        <Button
          size="sm"
          variant={groupBy === 'model' ? 'primary' : 'ghost'}
          onPress={() => setGroupBy('model')}
        >
          按模型
        </Button>
        <Button
          size="sm"
          variant={groupBy === 'day' ? 'primary' : 'ghost'}
          onPress={() => setGroupBy('day')}
        >
          按天
        </Button>
      </div>

      {grouped.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="text-4xl">📈</span>
          <p className="mt-3 text-sm font-medium text-muted">暂无用量记录</p>
          <p className="mt-1 text-xs text-muted">使用 Agent 对话后，Token 用量将显示在这里</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Token 用量分布</h2>
            <Card className="p-4">
              <BarChart
                data={grouped
                  .sort((a, b) => b.totalTokens - a.totalTokens)
                  .map((g) => ({ label: g.key, value: g.totalTokens }))}
                maxValue={maxTokens}
                colorClass="bg-primary-400"
              />
            </Card>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">费用分布</h2>
            <Card className="p-4">
              <CostBarChart
                data={grouped
                  .sort((a, b) => b.totalCost - a.totalCost)
                  .map((g) => ({ label: g.key, value: g.totalCost }))}
                maxValue={maxCost}
              />
            </Card>
          </div>
        </div>
      )}

      {/* Recent records table */}
      {records.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            最近调用记录
            <Chip size="sm" variant="soft" className="ml-2">{records.length}</Chip>
          </h2>
          <Card className="overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted">时间</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted">模型</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted">Provider</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">Prompt</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">Completion</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">费用</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(-50).reverse().map((r) => (
                    <tr key={r.id} className="border-t border-separator">
                      <td className="px-3 py-1.5 text-xs text-muted">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono">{r.model}</td>
                      <td className="px-3 py-1.5 text-xs">{r.provider}</td>
                      <td className="px-3 py-1.5 text-right text-xs">{r.promptTokens.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-xs">{r.completionTokens.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-xs">{formatCost(r.estimatedCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
