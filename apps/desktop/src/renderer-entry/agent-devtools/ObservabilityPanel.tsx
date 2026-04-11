import type { ProgressState, SessionUIState } from '@orbit/agent-core';

// ---------------------------------------------------------------------------
// ObservabilityPanel – Progress, tokens, session state, metrics
// ---------------------------------------------------------------------------

// ---- Progress bar ----

function ProgressBar({ progress }: { progress: ProgressState }) {
  const pct = Math.round(progress.progress * 100);
  const barColorClass =
    progress.phase === 'error' ? 'bg-danger'
    : progress.phase === 'done' ? 'bg-success'
    : 'bg-accent';

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-xl">{progress.icon}</span>
        <span className="text-sm font-semibold text-foreground">
          {progress.message}
        </span>
        {progress.detail && (
          <span className="text-xs text-muted font-mono">
            {progress.detail}
          </span>
        )}
        <span className="ml-auto text-xs text-muted font-mono">
          {pct}%
        </span>
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-sm bg-border overflow-hidden">
        <div
          className={`h-full rounded-sm transition-[width] duration-300 ease-out ${barColorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Iteration info + elapsed */}
      <div className="flex gap-4 mt-2 text-[11px] text-muted font-mono">
        {progress.iterationInfo && (
          <span>迭代 {progress.iterationInfo.current}/{progress.iterationInfo.max}</span>
        )}
        {progress.toolName && <span>工具: {progress.toolName}</span>}
        {progress.elapsed > 0 && <span>耗时: {(progress.elapsed / 1000).toFixed(1)}s</span>}
      </div>
    </div>
  );
}

// ---- Stat card ----

function StatCard({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="p-3 bg-surface rounded-lg border border-border flex-1 min-w-[120px]">
      <div className="text-[11px] text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${colorClass ?? 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

// ---- Token display ----

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(tokens: number): string {
  // Rough estimate: $0.01 per 1k tokens (mock pricing)
  const cost = (tokens / 1000) * 0.01;
  return `$${cost.toFixed(4)}`;
}

// ---- Session state ----

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-muted',
  thinking: 'text-warning',
  'tool-executing': 'text-accent',
  streaming: 'text-success',
  'waiting-approval': 'text-warning',
  error: 'text-danger',
};

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  thinking: '思考中',
  'tool-executing': '执行工具',
  streaming: '流式输出',
  'waiting-approval': '等待审批',
  error: '错误',
};

function SessionStateSection({ state }: { state: SessionUIState }) {
  return (
    <div className="px-5 py-3">
      <h3 className="text-[13px] text-muted mb-3">
        📊 会话状态
      </h3>
      <div className="flex flex-wrap gap-2.5">
        <StatCard
          label="状态"
          value={STATUS_LABELS[state.status] ?? state.status}
          colorClass={STATUS_COLORS[state.status]}
        />
        <StatCard
          label="消息数"
          value={String(state.messages.length)}
        />
        <StatCard
          label="活跃工具"
          value={String(state.currentToolCalls.length)}
          colorClass={state.currentToolCalls.length > 0 ? 'text-accent' : undefined}
        />
        {state.activeAgent && (
          <StatCard label="当前代理" value={state.activeAgent} colorClass="text-accent" />
        )}
      </div>
    </div>
  );
}

function TokenSection({ state }: { state: SessionUIState }) {
  const { tokenUsage } = state;
  const total = tokenUsage.total;

  // Context usage bar (assume 128k context)
  const maxContext = 128000;
  const usageRatio = Math.min(total / maxContext, 1);

  const barColorClass =
    usageRatio > 0.8 ? 'bg-danger'
    : usageRatio > 0.5 ? 'bg-warning'
    : 'bg-success';

  return (
    <div className="px-5 py-3">
      <h3 className="text-[13px] text-muted mb-3">
        🪙 Token 使用量
      </h3>
      <div className="flex flex-wrap gap-2.5 mb-3">
        <StatCard label="Prompt" value={formatTokens(tokenUsage.prompt)} />
        <StatCard label="Completion" value={formatTokens(tokenUsage.completion)} />
        <StatCard label="总计" value={formatTokens(total)} colorClass="text-accent" />
        <StatCard label="估算成本" value={formatCost(total)} colorClass="text-success" />
      </div>

      {/* Context usage bar */}
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] text-muted font-mono w-20">
          上下文:
        </span>
        <div className="w-[200px] h-2 rounded bg-border">
          <div
            className={`h-full rounded transition-[width] duration-300 ease-out ${barColorClass}`}
            style={{ width: `${usageRatio * 100}%` }}
          />
        </div>
        <span className="text-[11px] text-muted font-mono">
          {formatTokens(total)} / {formatTokens(maxContext)}
        </span>
      </div>
    </div>
  );
}

// ---- Tool calls table ----

function ToolCallsSection({ state }: { state: SessionUIState }) {
  const allToolCalls = state.currentToolCalls;
  if (allToolCalls.length === 0) return null;

  return (
    <div className="px-5 py-3">
      <h3 className="text-[13px] text-muted mb-3">
        🔧 活跃工具调用
      </h3>
      <div className="rounded-lg border border-border overflow-hidden">
        {allToolCalls.map((tc) => {
          const dotColorClass =
            tc.status === 'running' ? 'bg-warning'
            : tc.status === 'completed' ? 'bg-success'
            : 'bg-danger';

          return (
            <div
              key={tc.id}
              className="flex items-center gap-2.5 px-3 py-2 border-b border-border text-xs font-mono"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${dotColorClass}`}
                style={{
                  animation: tc.status === 'running' ? 'agent-pulse 1.2s ease-in-out infinite' : 'none',
                }}
              />
              <span className="text-accent font-semibold min-w-[100px]">{tc.name}</span>
              <span className="text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {JSON.stringify(tc.args).slice(0, 80)}
              </span>
              {tc.durationMs !== undefined && (
                <span className="text-muted">{tc.durationMs}ms</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ObservabilityPanelProps {
  progress: ProgressState;
  sessionState: SessionUIState | null;
  eventCount: number;
}

export function ObservabilityPanel({ progress, sessionState, eventCount }: ObservabilityPanelProps) {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <style>{`@keyframes agent-pulse{0%,100%{opacity:.35}50%{opacity:1}}`}</style>

      {/* Progress */}
      <ProgressBar progress={progress} />

      <div className="h-px bg-border" />

      {/* Quick stats */}
      <div className="px-5 py-3">
        <h3 className="text-[13px] text-muted mb-3">
          ⚡ 概览
        </h3>
        <div className="flex flex-wrap gap-2.5">
          <StatCard label="事件总数" value={String(eventCount)} />
          <StatCard label="阶段" value={progress.phase} colorClass={STATUS_COLORS[progress.phase] ?? 'text-foreground'} />
          <StatCard
            label="耗时"
            value={progress.elapsed > 0 ? `${(progress.elapsed / 1000).toFixed(1)}s` : '—'}
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Session state */}
      {sessionState && (
        <>
          <SessionStateSection state={sessionState} />
          <div className="h-px bg-border" />
          <TokenSection state={sessionState} />
          <div className="h-px bg-border" />
          <ToolCallsSection state={sessionState} />
        </>
      )}

      {!sessionState && (
        <div className="p-10 text-center text-muted text-sm">
          发送消息或运行场景以查看可观测数据。
        </div>
      )}
    </div>
  );
}
