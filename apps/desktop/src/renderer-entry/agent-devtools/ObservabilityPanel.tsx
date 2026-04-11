import type { ProgressState, SessionUIState } from '@orbit/agent-core';

// ---------------------------------------------------------------------------
// ObservabilityPanel – Progress, tokens, session state, metrics
// ---------------------------------------------------------------------------

const VAR = {
  bg: 'oklch(0.13 0.005 260)',
  surface: 'oklch(0.18 0.008 260)',
  text: 'oklch(0.93 0.005 260)',
  textDim: 'oklch(0.55 0.01 260)',
  accent: 'oklch(0.65 0.15 250)',
  green: 'oklch(0.65 0.15 145)',
  red: 'oklch(0.65 0.15 25)',
  yellow: 'oklch(0.70 0.15 80)',
  border: 'oklch(0.25 0.01 260)',
  font: "'Menlo', 'Monaco', 'Courier New', monospace",
  uiFont: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ---- Progress bar ----

function ProgressBar({ progress }: { progress: ProgressState }) {
  const pct = Math.round(progress.progress * 100);
  const barColor =
    progress.phase === 'error' ? VAR.red
    : progress.phase === 'done' ? VAR.green
    : VAR.accent;

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{progress.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: VAR.text, fontFamily: VAR.uiFont }}>
          {progress.message}
        </span>
        {progress.detail && (
          <span style={{ fontSize: 12, color: VAR.textDim, fontFamily: VAR.font }}>
            {progress.detail}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: VAR.textDim, fontFamily: VAR.font }}>
          {pct}%
        </span>
      </div>

      {/* Bar */}
      <div style={{ height: 6, borderRadius: 3, background: VAR.border, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Iteration info + elapsed */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: VAR.textDim, fontFamily: VAR.font }}>
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

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: VAR.surface,
        borderRadius: 8,
        border: `1px solid ${VAR.border}`,
        flex: '1 1 120px',
      }}
    >
      <div style={{ fontSize: 11, color: VAR.textDim, marginBottom: 4, fontFamily: VAR.uiFont }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: color ?? VAR.text,
          fontFamily: VAR.font,
        }}
      >
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
  idle: VAR.textDim,
  thinking: VAR.yellow,
  'tool-executing': VAR.accent,
  streaming: VAR.green,
  'waiting-approval': VAR.yellow,
  error: VAR.red,
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
    <div style={{ padding: '12px 20px' }}>
      <h3 style={{ fontSize: 13, color: VAR.textDim, margin: '0 0 12px', fontFamily: VAR.uiFont }}>
        📊 会话状态
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <StatCard
          label="状态"
          value={STATUS_LABELS[state.status] ?? state.status}
          color={STATUS_COLORS[state.status]}
        />
        <StatCard
          label="消息数"
          value={String(state.messages.length)}
        />
        <StatCard
          label="活跃工具"
          value={String(state.currentToolCalls.length)}
          color={state.currentToolCalls.length > 0 ? VAR.accent : undefined}
        />
        {state.activeAgent && (
          <StatCard label="当前代理" value={state.activeAgent} color={VAR.accent} />
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
  const barWidth = 200;

  return (
    <div style={{ padding: '12px 20px' }}>
      <h3 style={{ fontSize: 13, color: VAR.textDim, margin: '0 0 12px', fontFamily: VAR.uiFont }}>
        🪙 Token 使用量
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <StatCard label="Prompt" value={formatTokens(tokenUsage.prompt)} />
        <StatCard label="Completion" value={formatTokens(tokenUsage.completion)} />
        <StatCard label="总计" value={formatTokens(total)} color={VAR.accent} />
        <StatCard label="估算成本" value={formatCost(total)} color={VAR.green} />
      </div>

      {/* Context usage bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: VAR.textDim, fontFamily: VAR.font, width: 80 }}>
          上下文:
        </span>
        <div style={{ width: barWidth, height: 8, borderRadius: 4, background: VAR.border }}>
          <div
            style={{
              height: '100%',
              width: `${usageRatio * 100}%`,
              borderRadius: 4,
              background: usageRatio > 0.8 ? VAR.red : usageRatio > 0.5 ? VAR.yellow : VAR.green,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: VAR.textDim, fontFamily: VAR.font }}>
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
    <div style={{ padding: '12px 20px' }}>
      <h3 style={{ fontSize: 13, color: VAR.textDim, margin: '0 0 12px', fontFamily: VAR.uiFont }}>
        🔧 活跃工具调用
      </h3>
      <div style={{ borderRadius: 8, border: `1px solid ${VAR.border}`, overflow: 'hidden' }}>
        {allToolCalls.map((tc) => (
          <div
            key={tc.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderBottom: `1px solid ${VAR.border}`,
              fontSize: 12,
              fontFamily: VAR.font,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  tc.status === 'running' ? VAR.yellow
                  : tc.status === 'completed' ? VAR.green
                  : VAR.red,
                flexShrink: 0,
                animation: tc.status === 'running' ? 'agent-pulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ color: VAR.accent, fontWeight: 600, minWidth: 100 }}>{tc.name}</span>
            <span style={{ color: VAR.textDim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {JSON.stringify(tc.args).slice(0, 80)}
            </span>
            {tc.durationMs !== undefined && (
              <span style={{ color: VAR.textDim }}>{tc.durationMs}ms</span>
            )}
          </div>
        ))}
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
    <div style={{ height: '100%', overflowY: 'auto', background: VAR.bg }}>
      <style>{`@keyframes agent-pulse{0%,100%{opacity:.35}50%{opacity:1}}`}</style>

      {/* Progress */}
      <ProgressBar progress={progress} />

      <div style={{ height: 1, background: VAR.border }} />

      {/* Quick stats */}
      <div style={{ padding: '12px 20px' }}>
        <h3 style={{ fontSize: 13, color: VAR.textDim, margin: '0 0 12px', fontFamily: VAR.uiFont }}>
          ⚡ 概览
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <StatCard label="事件总数" value={String(eventCount)} />
          <StatCard label="阶段" value={progress.phase} color={STATUS_COLORS[progress.phase] ?? VAR.text} />
          <StatCard
            label="耗时"
            value={progress.elapsed > 0 ? `${(progress.elapsed / 1000).toFixed(1)}s` : '—'}
          />
        </div>
      </div>

      <div style={{ height: 1, background: VAR.border }} />

      {/* Session state */}
      {sessionState && (
        <>
          <SessionStateSection state={sessionState} />
          <div style={{ height: 1, background: VAR.border }} />
          <TokenSection state={sessionState} />
          <div style={{ height: 1, background: VAR.border }} />
          <ToolCallsSection state={sessionState} />
        </>
      )}

      {!sessionState && (
        <div style={{ padding: 40, textAlign: 'center', color: VAR.textDim, fontSize: 13, fontFamily: VAR.uiFont }}>
          发送消息或运行场景以查看可观测数据。
        </div>
      )}
    </div>
  );
}
