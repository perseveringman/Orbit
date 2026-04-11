import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { OrbitAgentEvent } from '@orbit/agent-core';
import type { EventLogEntry } from './DevAgentService';

// ---------------------------------------------------------------------------
// EventStreamPanel – Real-time event stream viewer
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  orchestrator: 'oklch(0.70 0.15 280)',
  agent: 'oklch(0.70 0.15 200)',
  capability: 'oklch(0.70 0.15 145)',
  safety: 'oklch(0.70 0.15 50)',
  compression: 'oklch(0.70 0.12 320)',
};

const CATEGORY_LABELS: Record<string, string> = {
  orchestrator: '编排',
  agent: '代理',
  capability: '能力',
  safety: '安全',
  compression: '压缩',
};

const VAR = {
  bg: 'oklch(0.13 0.005 260)',
  surface: 'oklch(0.18 0.008 260)',
  text: 'oklch(0.93 0.005 260)',
  textDim: 'oklch(0.55 0.01 260)',
  border: 'oklch(0.25 0.01 260)',
  accent: 'oklch(0.65 0.15 250)',
  font: "'Menlo', 'Monaco', 'Courier New', monospace",
  uiFont: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

function formatEventTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function getEventSummary(event: OrbitAgentEvent): string {
  switch (event.type) {
    case 'orchestrator:started':
      return `session=${event.sessionId} surface=${event.surface}`;
    case 'orchestrator:routed':
      return `→ ${event.domain} (${event.reason})`;
    case 'orchestrator:delegated':
      return `→ ${event.targetDomain}: ${event.task}`;
    case 'orchestrator:completed':
      return `tokens=${event.totalTokens} duration=${event.totalDurationMs}ms`;
    case 'orchestrator:error':
      return event.error;
    case 'orchestrator:cancelled':
      return event.reason;
    case 'agent:started':
      return `domain=${event.domain} model=${event.model}`;
    case 'agent:reasoning':
      return event.content.slice(0, 80);
    case 'agent:stream-delta':
      return `"${event.delta.slice(0, 40)}${event.delta.length > 40 ? '…' : ''}"`;
    case 'agent:tool-call':
      return `${event.toolName}(${JSON.stringify(event.args).slice(0, 60)})`;
    case 'agent:tool-result':
      return `${event.toolName} ${event.success ? '✓' : '✗'} ${event.durationMs}ms`;
    case 'agent:iteration':
      return `iter ${event.iteration}/${event.maxIterations} tokens=${event.tokenUsage.totalTokens}`;
    case 'agent:completed':
      return `domain=${event.domain} tokens=${event.totalTokens} ${event.totalDurationMs}ms`;
    case 'agent:error':
      return `${event.domain}: ${event.error}`;
    case 'capability:started':
      return `${event.capabilityName}`;
    case 'capability:progress':
      return `${event.capabilityName} ${Math.round(event.progress * 100)}%`;
    case 'capability:completed':
      return `${event.capabilityName} ${event.durationMs}ms`;
    case 'capability:error':
      return `${event.capabilityName}: ${event.error}`;
    case 'safety:check-passed':
      return `${event.capabilityName} tier=${event.tier}`;
    case 'safety:approval-required':
      return `${event.capabilityName}: ${event.reason}`;
    case 'safety:blocked':
      return `${event.capabilityName}: ${event.reason}`;
    case 'compression:started':
      return `${event.originalTokens} tokens`;
    case 'compression:completed':
      return `ratio=${event.ratio.toFixed(2)}`;
    default:
      return '';
  }
}

interface EventRowProps {
  entry: EventLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function EventRow({ entry, isExpanded, onToggle }: EventRowProps) {
  const { event, category } = entry;
  const color = CATEGORY_COLORS[category];
  const label = CATEGORY_LABELS[category];

  return (
    <div
      style={{
        borderBottom: `1px solid ${VAR.border}`,
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onClick={onToggle}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          fontSize: 12,
          fontFamily: VAR.font,
        }}
      >
        <span style={{ color: VAR.textDim, width: 28, textAlign: 'right', flexShrink: 0 }}>
          {entry.index}
        </span>
        <span style={{ color: VAR.textDim, width: 90, flexShrink: 0 }}>
          {formatEventTime(event.timestamp)}
        </span>
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 4,
            background: color,
            color: 'oklch(0.15 0 0)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            flexShrink: 0,
            width: 36,
            textAlign: 'center',
          }}
        >
          {label}
        </span>
        <span style={{ color: VAR.accent, fontWeight: 600, flexShrink: 0, minWidth: 160 }}>
          {event.type}
        </span>
        <span style={{ color: VAR.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getEventSummary(event)}
        </span>
        <span style={{ color: VAR.textDim, fontSize: 10, flexShrink: 0 }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <pre
          style={{
            margin: 0,
            padding: '8px 12px 12px 50px',
            fontSize: 11,
            lineHeight: 1.5,
            color: VAR.text,
            fontFamily: VAR.font,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            background: 'oklch(0.10 0.005 260)',
          }}
        >
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface EventStreamPanelProps {
  events: readonly EventLogEntry[];
}

export function EventStreamPanel({ events }: EventStreamPanelProps) {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  const toggleExpand = useCallback((index: number) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.category === filter);
  }, [events, filter]);

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (!isPaused && filtered.length > prevLengthRef.current) {
      const el = scrollRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
    prevLengthRef.current = filtered.length;
  }, [filtered.length, isPaused]);

  const filters = ['all', 'orchestrator', 'agent', 'capability', 'safety', 'compression'] as const;
  const filterLabels: Record<string, string> = {
    all: `全部 (${events.length})`,
    orchestrator: '编排',
    agent: '代理',
    capability: '能力',
    safety: '安全',
    compression: '压缩',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderBottom: `1px solid ${VAR.border}`,
          background: VAR.surface,
          fontFamily: VAR.uiFont,
          flexShrink: 0,
        }}
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              border: 'none',
              background: filter === f ? VAR.accent : 'transparent',
              color: filter === f ? VAR.bg : VAR.textDim,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: VAR.uiFont,
            }}
          >
            {filterLabels[f]}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setIsPaused(!isPaused)}
          style={{
            padding: '3px 10px',
            borderRadius: 6,
            border: `1px solid ${VAR.border}`,
            background: isPaused ? 'oklch(0.45 0.12 50)' : 'transparent',
            color: isPaused ? '#fff' : VAR.textDim,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: VAR.uiFont,
          }}
        >
          {isPaused ? '▶ 继续' : '⏸ 暂停'}
        </button>
      </div>

      {/* Event list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: VAR.bg }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: VAR.textDim,
              fontSize: 13,
              fontFamily: VAR.uiFont,
            }}
          >
            暂无事件。发送消息或运行场景以产生事件流。
          </div>
        ) : (
          filtered.map((entry) => (
            <EventRow
              key={entry.index}
              entry={entry}
              isExpanded={expandedSet.has(entry.index)}
              onToggle={() => toggleExpand(entry.index)}
            />
          ))
        )}
      </div>
    </div>
  );
}
