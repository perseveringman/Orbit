import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { OrbitAgentEvent } from '@orbit/agent-core';
import type { EventLogEntry } from './DevAgentService';

// ---------------------------------------------------------------------------
// EventStreamPanel – Real-time event stream viewer
// ---------------------------------------------------------------------------

// Domain-specific semantic colors — kept as inline styles
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
      className="border-b border-border cursor-pointer transition-colors hover:bg-surface"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono">
        <span className="text-muted w-7 text-right shrink-0">
          {entry.index}
        </span>
        <span className="text-muted w-[90px] shrink-0">
          {formatEventTime(event.timestamp)}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 w-9 text-center"
          style={{ background: color, color: 'oklch(0.15 0 0)' }}
        >
          {label}
        </span>
        <span className="text-accent font-semibold shrink-0 min-w-[160px]">
          {event.type}
        </span>
        <span className="text-foreground flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {getEventSummary(event)}
        </span>
        <span className="text-muted text-[10px] shrink-0">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <pre className="m-0 px-3 pb-3 pl-[50px] text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all text-foreground bg-black/20">
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
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-surface shrink-0">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-[3px] rounded-md border-none text-[11px] font-semibold cursor-pointer transition-colors ${
              filter === f
                ? 'bg-accent text-background'
                : 'bg-transparent text-muted hover:bg-surface-secondary'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
        <span className="flex-1" />
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`px-2.5 py-[3px] rounded-md border border-border text-[11px] cursor-pointer transition-colors ${
            isPaused
              ? 'bg-warning text-white'
              : 'bg-transparent text-muted hover:bg-surface-secondary'
          }`}
        >
          {isPaused ? '▶ 继续' : '⏸ 暂停'}
        </button>
      </div>

      {/* Event list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
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
