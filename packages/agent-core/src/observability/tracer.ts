// ---------------------------------------------------------------------------
// @orbit/agent-core – Distributed Tracing
// ---------------------------------------------------------------------------

// ---- Span ID generation ----

let _hexCounter = 0;

function generateHexId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  _hexCounter += 1;
  const ts = Date.now().toString(16).padStart(12, '0');
  const cnt = _hexCounter.toString(16).padStart(4, '0');
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${ts}${cnt}${rand}`;
}

// ---- Types ----

export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
}

export type SpanKind =
  | 'orchestrator'
  | 'agent'
  | 'tool'
  | 'llm'
  | 'safety'
  | 'memory'
  | 'compression';

export type SpanStatus = 'ok' | 'error' | 'cancelled';

export interface SpanEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly attributes?: Record<string, string | number | boolean>;
}

export interface Span {
  readonly context: SpanContext;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: number;
  endTime?: number;
  status: SpanStatus;
  readonly attributes: Record<string, string | number | boolean>;
  readonly events: SpanEvent[];

  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
  end(status?: SpanStatus): void;
}

// ---- SpanImpl ----

class SpanImpl implements Span {
  readonly context: SpanContext;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: number;
  endTime?: number;
  status: SpanStatus = 'ok';
  readonly attributes: Record<string, string | number | boolean> = {};
  readonly events: SpanEvent[] = [];

  private readonly onEnd: (span: SpanImpl) => void;

  constructor(
    name: string,
    kind: SpanKind,
    context: SpanContext,
    onEnd: (span: SpanImpl) => void,
  ) {
    this.name = name;
    this.kind = kind;
    this.context = context;
    this.startTime = Date.now();
    this.onEnd = onEnd;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (this.endTime !== undefined) return;
    this.attributes[key] = value;
  }

  addEvent(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    if (this.endTime !== undefined) return;
    this.events.push({ name, timestamp: Date.now(), attributes });
  }

  end(status?: SpanStatus): void {
    if (this.endTime !== undefined) return;
    if (status !== undefined) this.status = status;
    this.endTime = Date.now();
    this.onEnd(this);
  }
}

// ---- SpanExporter ----

export interface SpanExporter {
  export(spans: readonly Span[]): void;
}

export class InMemoryExporter implements SpanExporter {
  readonly spans: Span[] = [];

  export(spans: readonly Span[]): void {
    this.spans.push(...spans);
  }

  clear(): void {
    this.spans.length = 0;
  }
}

export class ConsoleExporter implements SpanExporter {
  export(spans: readonly Span[]): void {
    for (const span of spans) {
      const duration = (span.endTime ?? Date.now()) - span.startTime;
      console.log(
        `[${span.kind}] ${span.name} ${duration}ms ${span.status} trace=${span.context.traceId}`,
      );
    }
  }
}

// ---- Tracer ----

export class Tracer {
  private readonly activeSpans = new Map<string, SpanImpl>();
  private readonly completedSpans: SpanImpl[] = [];
  private readonly exporters: SpanExporter[];

  constructor(exporters?: SpanExporter[]) {
    this.exporters = exporters ? [...exporters] : [];
  }

  startSpan(
    name: string,
    kind: SpanKind,
    parentContext?: SpanContext,
  ): Span {
    const traceId = parentContext?.traceId ?? generateHexId();
    const spanId = generateHexId();
    const context: SpanContext = {
      traceId,
      spanId,
      parentSpanId: parentContext?.spanId,
    };

    const span = new SpanImpl(name, kind, context, (s) => {
      this.activeSpans.delete(s.context.spanId);
      this.completedSpans.push(s);
    });

    this.activeSpans.set(spanId, span);
    return span;
  }

  endSpan(spanId: string, status?: SpanStatus): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.end(status);
    }
  }

  getActiveSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  getTraceSpans(traceId: string): readonly Span[] {
    const result: Span[] = [];
    for (const span of this.activeSpans.values()) {
      if (span.context.traceId === traceId) result.push(span);
    }
    for (const span of this.completedSpans) {
      if (span.context.traceId === traceId) result.push(span);
    }
    return result;
  }

  addExporter(exporter: SpanExporter): void {
    this.exporters.push(exporter);
  }

  flush(): void {
    if (this.completedSpans.length === 0) return;
    const batch = this.completedSpans.splice(0);
    for (const exporter of this.exporters) {
      exporter.export(batch);
    }
  }
}
