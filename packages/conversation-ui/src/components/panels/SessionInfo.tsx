// ---------------------------------------------------------------------------
// SessionInfo – Session statistics display (message count, tokens, cost, etc.)
// ---------------------------------------------------------------------------

import React from 'react';

import type { SessionStats } from '../../types.js';

export interface SessionInfoProps {
  readonly stats: SessionStats;
}

const STATUS_LABELS: Record<SessionStats['status'], string> = {
  active: '运行中',
  paused: '已暂停',
  completed: '已完成',
  failed: '已失败',
};

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

export const SessionInfo = React.memo(function SessionInfo({ stats }: SessionInfoProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-default-500 uppercase tracking-wide">
        会话统计
      </h3>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-default-500">状态</dt>
        <dd className="text-right font-medium">{STATUS_LABELS[stats.status]}</dd>

        <dt className="text-default-500">消息数</dt>
        <dd className="text-right font-medium">{stats.messageCount}</dd>

        <dt className="text-default-500">工具调用</dt>
        <dd className="text-right font-medium">{stats.toolCallCount}</dd>

        <dt className="text-default-500">耗时</dt>
        <dd className="text-right font-medium">{formatDuration(stats.durationMs)}</dd>

        <dt className="text-default-500">Token 用量</dt>
        <dd className="text-right font-medium">{stats.totalTokens.toLocaleString()}</dd>

        <dt className="text-default-500">预估费用</dt>
        <dd className="text-right font-medium">{formatCost(stats.estimatedCostUsd)}</dd>
      </dl>
    </div>
  );
});
