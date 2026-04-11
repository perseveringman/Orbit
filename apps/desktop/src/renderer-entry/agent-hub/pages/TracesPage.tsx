import { type ReactElement, useState, useMemo } from 'react';
import { Card, Chip } from '@heroui/react';

interface TraceSpan {
  id: string;
  name: string;
  parentId?: string;
  startTime: number;
  endTime: number;
  status: 'ok' | 'error' | 'running';
  attributes: Record<string, string | number>;
  children: TraceSpan[];
}

// Demo traces for visualization (will be replaced with real Tracer data)
function generateDemoTraces(): TraceSpan[] {
  const now = Date.now();
  return [
    {
      id: 'span-1',
      name: 'orchestrator:route',
      startTime: now - 5000,
      endTime: now - 100,
      status: 'ok',
      attributes: { agent: 'orchestrator', runId: 'run-001' },
      children: [
        {
          id: 'span-2',
          name: 'agent:reasoning',
          parentId: 'span-1',
          startTime: now - 4800,
          endTime: now - 4000,
          status: 'ok',
          attributes: { domain: 'planning', tokens: 342 },
          children: [],
        },
        {
          id: 'span-3',
          name: 'tool:file_read',
          parentId: 'span-1',
          startTime: now - 3900,
          endTime: now - 3200,
          status: 'ok',
          attributes: { tool: 'fileReadTool', path: '/src/index.ts' },
          children: [
            {
              id: 'span-4',
              name: 'capability:check',
              parentId: 'span-3',
              startTime: now - 3850,
              endTime: now - 3800,
              status: 'ok',
              attributes: { riskLevel: 'R0', approved: 'auto' },
              children: [],
            },
          ],
        },
        {
          id: 'span-5',
          name: 'agent:stream-response',
          parentId: 'span-1',
          startTime: now - 3100,
          endTime: now - 200,
          status: 'ok',
          attributes: { tokens: 1205, chunks: 48 },
          children: [],
        },
      ],
    },
  ];
}

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'warning'> = {
  ok: 'success',
  error: 'danger',
  running: 'warning',
};

function SpanBar({ span, totalStart, totalDuration, depth }: {
  span: TraceSpan;
  totalStart: number;
  totalDuration: number;
  depth: number;
}): ReactElement {
  const offsetPct = totalDuration > 0
    ? ((span.startTime - totalStart) / totalDuration) * 100
    : 0;
  const widthPct = totalDuration > 0
    ? Math.max(((span.endTime - span.startTime) / totalDuration) * 100, 0.5)
    : 100;
  const durationMs = span.endTime - span.startTime;
  const color = STATUS_COLORS[span.status] ?? 'success';

  return (
    <div className="mb-1">
      <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
        <span className="w-40 truncate text-xs text-default-600">{span.name}</span>
        <div className="relative h-6 flex-1 rounded bg-default-100">
          <div
            className={`absolute h-full rounded bg-${color}-400 transition-all`}
            style={{ left: `${offsetPct}%`, width: `${widthPct}%`, minWidth: 4 }}
          >
            <span className="flex h-full items-center px-1 text-[10px] font-medium text-white">
              {durationMs}ms
            </span>
          </div>
        </div>
        <div className="flex w-32 gap-1">
          <Chip size="sm" color={color} variant="soft">
            {span.status}
          </Chip>
        </div>
      </div>
      {span.children.map((child) => (
        <SpanBar
          key={child.id}
          span={child}
          totalStart={totalStart}
          totalDuration={totalDuration}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function SpanDetails({ span }: { span: TraceSpan }): ReactElement {
  return (
    <Card className="p-3">
      <h3 className="text-sm font-semibold">{span.name}</h3>
      <div className="mt-2 flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span className="text-default-500">Duration</span>
          <span>{span.endTime - span.startTime}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-default-500">Start</span>
          <span>{new Date(span.startTime).toLocaleTimeString()}</span>
        </div>
        {Object.entries(span.attributes).map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-default-500">{k}</span>
            <span className="font-mono">{String(v)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TracesPage(): ReactElement {
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);
  const traces = useMemo(() => generateDemoTraces(), []);

  // Compute timeline bounds
  const allSpans: TraceSpan[] = [];
  const collectSpans = (spans: TraceSpan[]) => {
    for (const s of spans) {
      allSpans.push(s);
      collectSpans(s.children);
    }
  };
  collectSpans(traces);

  const totalStart = Math.min(...allSpans.map((s) => s.startTime));
  const totalEnd = Math.max(...allSpans.map((s) => s.endTime));
  const totalDuration = totalEnd - totalStart;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">执行追踪</h1>
        <p className="text-sm text-default-500">
          Agent 执行链路可视化 · {allSpans.length} 个 Span · 总耗时 {totalDuration}ms
        </p>
      </div>

      <div className="flex flex-1 gap-6">
        {/* Timeline */}
        <div className="flex-1">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-default-400">
              <span>{new Date(totalStart).toLocaleTimeString()}</span>
              <span>{totalDuration}ms</span>
              <span>{new Date(totalEnd).toLocaleTimeString()}</span>
            </div>
            {traces.map((trace) => (
              <SpanBar
                key={trace.id}
                span={trace}
                totalStart={totalStart}
                totalDuration={totalDuration}
                depth={0}
              />
            ))}
          </Card>
        </div>

        {/* Detail panel */}
        <div className="w-72">
          <h2 className="mb-3 text-sm font-semibold text-default-700">Span 详情</h2>
          {selectedSpan ? (
            <SpanDetails span={selectedSpan} />
          ) : (
            <Card className="flex items-center justify-center p-8 text-center">
              <p className="text-xs text-default-400">点击 Span 查看详情</p>
            </Card>
          )}

          <h2 className="mb-3 mt-6 text-sm font-semibold text-default-700">Span 列表</h2>
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {allSpans.map((span) => (
              <button
                key={span.id}
                onClick={() => setSelectedSpan(span)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  selectedSpan?.id === span.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-default-600 hover:bg-default-100'
                }`}
              >
                <Chip size="sm" color={STATUS_COLORS[span.status]} variant="soft">
                  {span.status}
                </Chip>
                <span className="flex-1 truncate">{span.name}</span>
                <span className="text-default-400">{span.endTime - span.startTime}ms</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
