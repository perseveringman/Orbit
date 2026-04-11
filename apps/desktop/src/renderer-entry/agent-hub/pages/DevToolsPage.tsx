import { type ReactElement, useState, useRef, useCallback, useEffect } from 'react';
import { Card, Chip, Button } from '@heroui/react';
import {
  EventBus,
  ProgressTracker,
  type OrbitAgentEvent,
  type ProgressState,
} from '@orbit/agent-core';

interface EventLogEntry {
  id: string;
  event: OrbitAgentEvent;
  timestamp: number;
}

function EventRow({ entry }: { entry: EventLogEntry }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const e = entry.event;

  const categoryColor: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'default'> = {
    orchestrator: 'accent',
    agent: 'success',
    capability: 'accent',
    safety: 'warning',
    memory: 'default',
    compression: 'default',
  };

  const category = e.type.split(':')[0];
  const color = categoryColor[category] ?? 'default';

  return (
    <div className="border-b border-default-100 last:border-b-0">
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-default-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="w-16 text-[10px] text-default-400">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <Chip size="sm" color={color} variant="soft">{category}</Chip>
        <span className="flex-1 truncate font-mono text-xs">{e.type}</span>
        {'runId' in e && (
          <span className="text-[10px] text-default-300">{(e as any).runId?.slice(0, 8)}</span>
        )}
        <span className="text-default-300">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <pre className="bg-default-50 px-3 py-2 text-xs leading-relaxed">
          {JSON.stringify(e, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ProgressBar({ state }: { state: ProgressState }): ReactElement {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{state.icon}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{state.phase}</span>
            <span className="text-xs text-default-400">{Math.round(state.progress * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-default-200">
            <div
              className="h-full rounded-full bg-primary-400 transition-all"
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-default-400">{state.message}</p>
        </div>
      </div>
    </Card>
  );
}

export function DevToolsPage(): ReactElement {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'idle',
    progress: 0,
    message: '待命',
    icon: '💤',
    elapsed: 0,
  });
  const [filter, setFilter] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const trackerRef = useRef<ProgressTracker | null>(null);

  useEffect(() => {
    const bus = new EventBus();
    const tracker = new ProgressTracker();
    eventBusRef.current = bus;
    trackerRef.current = tracker;

    bus.onAny((event) => {
      setEvents((prev) => [
        ...prev,
        {
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          event,
          timestamp: Date.now(),
        },
      ]);
      const newProgress = tracker.processEvent(event);
      setProgress(newProgress);
    });

    return () => { bus.clear(); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [events]);

  const handleClear = useCallback(() => setEvents([]), []);

  const filteredEvents = filter
    ? events.filter((e) => e.event.type.includes(filter))
    : events;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">调试</h1>
          <p className="text-sm text-default-500">事件流监控与可观测面板</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="过滤事件类型…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded border border-default-200 bg-default-50 px-3 py-1 text-sm"
          />
          <Button size="sm" variant="ghost" onPress={handleClear}>
            清空
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar state={progress} />
      </div>

      <div className="mb-3 flex gap-2">
        <Chip size="sm" variant="soft">事件: {filteredEvents.length}</Chip>
        <Chip size="sm" variant="soft" color="accent">阶段: {progress.phase}</Chip>
      </div>

      <Card className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full max-h-[calc(100vh-320px)] overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="flex h-full items-center justify-center text-default-300">
              <div className="text-center">
                <p className="text-3xl">📡</p>
                <p className="mt-2 text-xs">等待事件…</p>
              </div>
            </div>
          ) : (
            filteredEvents.map((entry) => (
              <EventRow key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
