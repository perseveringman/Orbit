import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  // Tracer
  Tracer,
  InMemoryExporter,
  ConsoleExporter,
  // Logger
  Logger,
  BufferLogTransport,
  ConsoleLogTransport,
  // Metrics
  Counter,
  Histogram,
  Gauge,
  AgentMetrics,
  // Error Classifier
  classifyError,
  getRecoveryStrategy,
  formatErrorForUser,
  RECOVERY_STRATEGIES,
  // Health Checker
  HealthChecker,
  ProviderHealthCheck,
  ToolAvailabilityCheck,
  MemoryStoreCheck,
} from '../src/index';

import type {
  Span,
  SpanContext,
  SpanExporter,
  LogLevel,
  LogEntry,
  ClassifiedError,
  ErrorCategory,
  HealthStatus,
  CheckResult,
} from '../src/index';

// ---------------------------------------------------------------------------
// Tracer
// ---------------------------------------------------------------------------

describe('Tracer', () => {
  let tracer: Tracer;
  let exporter: InMemoryExporter;

  beforeEach(() => {
    exporter = new InMemoryExporter();
    tracer = new Tracer([exporter]);
  });

  it('creates spans with parent-child relationships', () => {
    const parent = tracer.startSpan('parent-op', 'orchestrator');
    const child = tracer.startSpan('child-op', 'agent', parent.context);

    expect(child.context.parentSpanId).toBe(parent.context.spanId);
    expect(child.context.traceId).toBe(parent.context.traceId);

    child.end();
    parent.end();
  });

  it('exports completed spans to InMemoryExporter', () => {
    const span = tracer.startSpan('test-op', 'tool');
    span.end();
    tracer.flush();

    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0].name).toBe('test-op');
    expect(exporter.spans[0].kind).toBe('tool');
    expect(exporter.spans[0].endTime).toBeDefined();
  });

  it('generates unique traceId and spanId', () => {
    const span1 = tracer.startSpan('op1', 'llm');
    const span2 = tracer.startSpan('op2', 'llm');

    expect(span1.context.traceId).not.toBe(span2.context.traceId);
    expect(span1.context.spanId).not.toBe(span2.context.spanId);

    span1.end();
    span2.end();
  });

  it('span attributes and events are recorded', () => {
    const span = tracer.startSpan('attr-test', 'memory');
    span.setAttribute('model', 'gpt-4');
    span.setAttribute('tokens', 150);
    span.setAttribute('stream', true);
    span.addEvent('request-sent', { url: '/v1/chat' });
    span.addEvent('response-received');

    expect(span.attributes['model']).toBe('gpt-4');
    expect(span.attributes['tokens']).toBe(150);
    expect(span.attributes['stream']).toBe(true);
    expect(span.events).toHaveLength(2);
    expect(span.events[0].name).toBe('request-sent');
    expect(span.events[1].name).toBe('response-received');

    span.end();
  });

  it('endSpan ends span by spanId', () => {
    const span = tracer.startSpan('end-test', 'safety');
    expect(tracer.getActiveSpan(span.context.spanId)).toBeDefined();

    tracer.endSpan(span.context.spanId, 'error');
    expect(span.status).toBe('error');
    expect(span.endTime).toBeDefined();
    expect(tracer.getActiveSpan(span.context.spanId)).toBeUndefined();
  });

  it('getTraceSpans returns all spans in a trace', () => {
    const parent = tracer.startSpan('parent', 'orchestrator');
    const child1 = tracer.startSpan('child1', 'agent', parent.context);
    const child2 = tracer.startSpan('child2', 'tool', parent.context);

    const spans = tracer.getTraceSpans(parent.context.traceId);
    expect(spans).toHaveLength(3);

    child1.end();
    child2.end();
    parent.end();
  });

  it('flush only exports completed spans', () => {
    const span1 = tracer.startSpan('done', 'llm');
    tracer.startSpan('active', 'tool');

    span1.end();
    tracer.flush();

    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0].name).toBe('done');
  });

  it('addExporter adds exporters dynamically', () => {
    const exporter2 = new InMemoryExporter();
    tracer.addExporter(exporter2);

    const span = tracer.startSpan('multi', 'compression');
    span.end();
    tracer.flush();

    expect(exporter.spans).toHaveLength(1);
    expect(exporter2.spans).toHaveLength(1);
  });

  it('InMemoryExporter clear removes all spans', () => {
    const span = tracer.startSpan('clear-test', 'llm');
    span.end();
    tracer.flush();
    expect(exporter.spans).toHaveLength(1);

    exporter.clear();
    expect(exporter.spans).toHaveLength(0);
  });

  it('ConsoleExporter logs to console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleExporter = new ConsoleExporter();
    const t = new Tracer([consoleExporter]);
    const span = t.startSpan('console-test', 'agent');
    span.end();
    t.flush();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const msg = consoleSpy.mock.calls[0][0] as string;
    expect(msg).toContain('[agent]');
    expect(msg).toContain('console-test');
    consoleSpy.mockRestore();
  });

  it('ended spans ignore further mutations', () => {
    const span = tracer.startSpan('immutable', 'tool');
    span.end();
    span.setAttribute('late', 'value');
    span.addEvent('late-event');

    expect(span.attributes['late']).toBeUndefined();
    expect(span.events).toHaveLength(0);
  });

  it('span defaults to ok status', () => {
    const span = tracer.startSpan('default-status', 'llm');
    expect(span.status).toBe('ok');
    span.end();
    expect(span.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

describe('Logger', () => {
  let buffer: BufferLogTransport;

  beforeEach(() => {
    buffer = new BufferLogTransport();
  });

  it('filters by minimum log level', () => {
    const logger = new Logger('test', { minLevel: 'warn', transports: [buffer] });
    logger.trace('trace msg');
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    const entries = buffer.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].level).toBe('warn');
    expect(entries[1].level).toBe('error');
  });

  it('writes to multiple transports', () => {
    const buffer2 = new BufferLogTransport();
    const logger = new Logger('test', { minLevel: 'info', transports: [buffer, buffer2] });
    logger.info('hello');

    expect(buffer.getEntries()).toHaveLength(1);
    expect(buffer2.getEntries()).toHaveLength(1);
  });

  it('BufferTransport stores and filters entries', () => {
    const logger = new Logger('mod-a', { minLevel: 'debug', transports: [buffer] });
    logger.debug('debug msg');
    logger.info('info msg');

    const logger2 = new Logger('mod-b', { minLevel: 'debug', transports: [buffer] });
    logger2.warn('warn msg');

    expect(buffer.getEntries()).toHaveLength(3);
    expect(buffer.getEntries({ module: 'mod-a' })).toHaveLength(2);
    expect(buffer.getEntries({ level: 'warn' })).toHaveLength(1);
  });

  it('child logger inherits transports', () => {
    const parent = new Logger('parent', { minLevel: 'debug', transports: [buffer] });
    const child = parent.child('child');
    child.info('from child');

    const entries = buffer.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].module).toBe('child');
  });

  it('withTrace adds trace context', () => {
    const logger = new Logger('test', { minLevel: 'info', transports: [buffer] });
    const traced = logger.withTrace('trace-123', 'span-456');
    traced.info('traced msg');

    const entries = buffer.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].traceId).toBe('trace-123');
    expect(entries[0].spanId).toBe('span-456');
  });

  it('setLevel changes minimum level', () => {
    const logger = new Logger('test', { minLevel: 'error', transports: [buffer] });
    logger.info('hidden');
    expect(buffer.getEntries()).toHaveLength(0);

    logger.setLevel('info');
    logger.info('visible');
    expect(buffer.getEntries()).toHaveLength(1);
  });

  it('addTransport adds transport dynamically', () => {
    const logger = new Logger('test', { minLevel: 'info' });
    logger.info('no transport');

    logger.addTransport(buffer);
    logger.info('with transport');
    expect(buffer.getEntries()).toHaveLength(1);
  });

  it('BufferTransport respects maxSize', () => {
    const smallBuffer = new BufferLogTransport(3);
    const logger = new Logger('test', { minLevel: 'debug', transports: [smallBuffer] });
    logger.debug('1');
    logger.debug('2');
    logger.debug('3');
    logger.debug('4');

    const entries = smallBuffer.getEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0].message).toBe('2');
  });

  it('BufferTransport clear removes all entries', () => {
    const logger = new Logger('test', { minLevel: 'info', transports: [buffer] });
    logger.info('msg');
    expect(buffer.getEntries()).toHaveLength(1);
    buffer.clear();
    expect(buffer.getEntries()).toHaveLength(0);
  });

  it('BufferTransport filters by traceId', () => {
    const logger = new Logger('test', { minLevel: 'info', transports: [buffer] });
    const traced = logger.withTrace('t1');
    traced.info('first');
    const traced2 = logger.withTrace('t2');
    traced2.info('second');

    expect(buffer.getEntries({ traceId: 't1' })).toHaveLength(1);
    expect(buffer.getEntries({ traceId: 't2' })).toHaveLength(1);
  });

  it('ConsoleLogTransport routes to correct console methods', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const transport = new ConsoleLogTransport();
    const logger = new Logger('test', { minLevel: 'trace', transports: [transport] });

    logger.error('err');
    logger.fatal('fat');
    logger.warn('wrn');
    logger.debug('dbg');
    logger.trace('trc');
    logger.info('inf');

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    debugSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('log entries include context', () => {
    const logger = new Logger('test', { minLevel: 'info', transports: [buffer] });
    logger.info('with context', { key: 'value', num: 42 });

    const entries = buffer.getEntries();
    expect(entries[0].context).toEqual({ key: 'value', num: 42 });
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe('Metrics', () => {
  it('Counter increments with labels', () => {
    const counter = new Counter('test_counter', 'A test counter');
    counter.inc();
    counter.inc();
    expect(counter.get()).toBe(2);

    counter.inc({ method: 'GET' });
    counter.inc({ method: 'GET' }, 5);
    expect(counter.get({ method: 'GET' })).toBe(6);
    expect(counter.get({ method: 'POST' })).toBe(0);
  });

  it('Counter reset clears all values', () => {
    const counter = new Counter('test', 'test');
    counter.inc({ a: '1' }, 10);
    counter.reset();
    expect(counter.get({ a: '1' })).toBe(0);
  });

  it('Histogram calculates count, sum, avg', () => {
    const hist = new Histogram('test_hist', 'A test histogram');
    hist.observe(10);
    hist.observe(20);
    hist.observe(30);

    expect(hist.getCount()).toBe(3);
    expect(hist.getSum()).toBe(60);
    expect(hist.getAvg()).toBe(20);
  });

  it('Histogram with labels', () => {
    const hist = new Histogram('test_hist', 'test');
    hist.observe(100, { method: 'GET' });
    hist.observe(200, { method: 'GET' });
    hist.observe(50, { method: 'POST' });

    expect(hist.getCount({ method: 'GET' })).toBe(2);
    expect(hist.getSum({ method: 'GET' })).toBe(300);
    expect(hist.getAvg({ method: 'GET' })).toBe(150);
    expect(hist.getCount({ method: 'POST' })).toBe(1);
  });

  it('Histogram returns 0 for unknown labels', () => {
    const hist = new Histogram('test', 'test');
    expect(hist.getCount({ x: '1' })).toBe(0);
    expect(hist.getSum({ x: '1' })).toBe(0);
    expect(hist.getAvg({ x: '1' })).toBe(0);
  });

  it('Gauge set/inc/dec', () => {
    const gauge = new Gauge('test_gauge', 'A test gauge');
    gauge.set(10);
    expect(gauge.get()).toBe(10);

    gauge.inc();
    expect(gauge.get()).toBe(11);

    gauge.inc(undefined, 5);
    expect(gauge.get()).toBe(16);

    gauge.dec();
    expect(gauge.get()).toBe(15);

    gauge.dec(undefined, 3);
    expect(gauge.get()).toBe(12);
  });

  it('Gauge with labels', () => {
    const gauge = new Gauge('test', 'test');
    gauge.set(5, { region: 'us' });
    gauge.set(3, { region: 'eu' });
    expect(gauge.get({ region: 'us' })).toBe(5);
    expect(gauge.get({ region: 'eu' })).toBe(3);
  });

  it('AgentMetrics creates all pre-defined metrics', () => {
    const metrics = new AgentMetrics();

    expect(metrics.llmRequestsTotal).toBeInstanceOf(Counter);
    expect(metrics.llmTokensTotal).toBeInstanceOf(Counter);
    expect(metrics.llmRequestDuration).toBeInstanceOf(Histogram);
    expect(metrics.llmCostUsd).toBeInstanceOf(Counter);
    expect(metrics.toolExecutionsTotal).toBeInstanceOf(Counter);
    expect(metrics.toolExecutionDuration).toBeInstanceOf(Histogram);
    expect(metrics.agentIterationsTotal).toBeInstanceOf(Counter);
    expect(metrics.memoryRecallCount).toBeInstanceOf(Counter);
    expect(metrics.safetyBlocksTotal).toBeInstanceOf(Counter);
    expect(metrics.approvalRequestsTotal).toBeInstanceOf(Counter);
    expect(metrics.contextCompressionRatio).toBeInstanceOf(Gauge);
    expect(metrics.activeSessions).toBeInstanceOf(Gauge);
  });

  it('snapshot returns all metric values', () => {
    const metrics = new AgentMetrics();
    metrics.llmRequestsTotal.inc({ model: 'gpt-4' });
    metrics.toolExecutionsTotal.inc({ tool: 'search' }, 3);
    metrics.activeSessions.set(2);

    const snap = metrics.snapshot();
    expect(snap['llm_requests_total']).toBeDefined();
    expect(snap['llm_requests_total']).toHaveLength(1);
    expect(snap['tool_executions_total']).toBeDefined();
    expect(snap['active_sessions']).toBeDefined();
  });

  it('AgentMetrics reset clears all', () => {
    const metrics = new AgentMetrics();
    metrics.llmRequestsTotal.inc();
    metrics.activeSessions.set(5);
    metrics.reset();

    expect(metrics.llmRequestsTotal.get()).toBe(0);
    expect(metrics.activeSessions.get()).toBe(0);
  });

  it('label key sorting is consistent', () => {
    const counter = new Counter('test', 'test');
    counter.inc({ b: '2', a: '1' });
    counter.inc({ a: '1', b: '2' });
    expect(counter.get({ a: '1', b: '2' })).toBe(2);
    expect(counter.get({ b: '2', a: '1' })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ErrorClassifier
// ---------------------------------------------------------------------------

describe('ErrorClassifier', () => {
  it('classifies HTTP 401 as auth', () => {
    const result = classifyError({ status: 401, message: 'Unauthorized' });
    expect(result.category).toBe('auth');
    expect(result.retryable).toBe(true);
  });

  it('classifies HTTP 403 as auth', () => {
    const result = classifyError({ status: 403, message: 'Forbidden' });
    expect(result.category).toBe('auth');
  });

  it('classifies HTTP 429 as rate-limit', () => {
    const result = classifyError({ status: 429, message: 'Too Many Requests' });
    expect(result.category).toBe('rate-limit');
    expect(result.retryable).toBe(true);
    expect(result.maxRetries).toBe(5);
  });

  it('classifies HTTP 500 as server-error', () => {
    const result = classifyError({ status: 500, message: 'Internal Server Error' });
    expect(result.category).toBe('server-error');
    expect(result.retryable).toBe(true);
  });

  it('classifies HTTP 502 as server-error', () => {
    const result = classifyError({ status: 502, message: 'Bad Gateway' });
    expect(result.category).toBe('server-error');
  });

  it('classifies ECONNREFUSED as network', () => {
    const err = new Error('connect ECONNREFUSED');
    (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';
    const result = classifyError(err);
    expect(result.category).toBe('network');
  });

  it('classifies ETIMEDOUT as network', () => {
    const err = new Error('request timed out');
    (err as NodeJS.ErrnoException).code = 'ETIMEDOUT';
    const result = classifyError(err);
    expect(result.category).toBe('network');
  });

  it('classifies ENOTFOUND as network', () => {
    const err = new Error('getaddrinfo ENOTFOUND');
    (err as NodeJS.ErrnoException).code = 'ENOTFOUND';
    const result = classifyError(err);
    expect(result.category).toBe('network');
  });

  it('classifies context length error as context-overflow', () => {
    const result = classifyError(new Error('This model maximum context length is 4096 tokens'));
    expect(result.category).toBe('context-overflow');
  });

  it('classifies max tokens error as context-overflow', () => {
    const result = classifyError(new Error('max tokens exceeded'));
    expect(result.category).toBe('context-overflow');
  });

  it('classifies timeout message as timeout', () => {
    const result = classifyError(new Error('operation timed out'));
    expect(result.category).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('classifies safety/blocked as safety-block', () => {
    const result = classifyError(new Error('content blocked by safety filter'));
    expect(result.category).toBe('safety-block');
    expect(result.retryable).toBe(false);
  });

  it('classifies budget errors', () => {
    const result = classifyError(new Error('cost limit exceeded'));
    expect(result.category).toBe('budget');
    expect(result.retryable).toBe(false);
  });

  it('classifies validation errors', () => {
    const result = classifyError(new Error('invalid input schema'));
    expect(result.category).toBe('validation');
    expect(result.retryable).toBe(false);
  });

  it('classifies TypeError as tool-error', () => {
    const result = classifyError(new TypeError('Cannot read property x'));
    expect(result.category).toBe('tool-error');
  });

  it('classifies unknown errors', () => {
    const result = classifyError(new Error('something completely unknown happened'));
    expect(result.category).toBe('unknown');
  });

  it('returns correct recovery strategy for each category', () => {
    const categories: ErrorCategory[] = [
      'auth', 'rate-limit', 'context-overflow', 'server-error', 'network',
      'tool-error', 'safety-block', 'validation', 'budget', 'timeout', 'unknown',
    ];

    for (const cat of categories) {
      const strategy = getRecoveryStrategy(cat);
      expect(strategy).toBe(RECOVERY_STRATEGIES[cat]);
      expect(strategy).toHaveProperty('retry');
      expect(strategy).toHaveProperty('maxAttempts');
      expect(strategy).toHaveProperty('backoffBase');
      expect(strategy).toHaveProperty('failover');
      expect(strategy).toHaveProperty('compress');
      expect(strategy).toHaveProperty('notify');
    }
  });

  it('formatErrorForUser returns Chinese messages', () => {
    const classified = classifyError({ status: 429, message: 'Rate limited' });
    const formatted = formatErrorForUser(classified);
    expect(formatted).toContain('请求限流');
    expect(formatted).toContain('建议');
  });

  it('formatErrorForUser works for all categories', () => {
    const categories: ErrorCategory[] = [
      'auth', 'rate-limit', 'context-overflow', 'server-error', 'network',
      'tool-error', 'safety-block', 'validation', 'budget', 'timeout', 'unknown',
    ];

    for (const cat of categories) {
      const error: ClassifiedError = {
        category: cat,
        message: 'test',
        originalError: new Error('test'),
        retryable: false,
        maxRetries: 0,
        backoffMs: 0,
        suggestion: '建议',
      };
      const formatted = formatErrorForUser(error);
      expect(formatted).toContain('建议');
    }
  });

  it('handles string errors', () => {
    const result = classifyError('some string error');
    expect(result.category).toBe('unknown');
    expect(result.message).toBe('some string error');
  });

  it('handles statusCode property', () => {
    const result = classifyError({ statusCode: 503, message: 'Service Unavailable' });
    expect(result.category).toBe('server-error');
  });

  it('handles nested response.status', () => {
    const result = classifyError({ response: { status: 401 }, message: 'Auth failed' });
    expect(result.category).toBe('auth');
  });
});

// ---------------------------------------------------------------------------
// HealthChecker
// ---------------------------------------------------------------------------

describe('HealthChecker', () => {
  it('runs all registered checks', async () => {
    const checker = new HealthChecker();

    checker.register(
      new ProviderHealthCheck('openai', async () => true),
    );
    checker.register(
      new MemoryStoreCheck(async () => true),
    );

    const report = await checker.runAll();
    expect(report.results).toHaveLength(2);
    expect(report.overallStatus).toBe('healthy');
    expect(report.timestamp).toBeGreaterThan(0);
  });

  it('reports overall status based on worst check', async () => {
    const checker = new HealthChecker();

    checker.register(
      new ProviderHealthCheck('openai', async () => true),
    );
    checker.register(
      new ProviderHealthCheck('failing', async () => false),
    );

    const report = await checker.runAll();
    expect(report.overallStatus).toBe('unhealthy');
  });

  it('degraded when partially available', async () => {
    const checker = new HealthChecker();

    checker.register(
      new ProviderHealthCheck('openai', async () => true),
    );
    checker.register(
      new ToolAvailabilityCheck(async () => ({
        available: 3,
        total: 5,
        missing: ['tool-a', 'tool-b'],
      })),
    );

    const report = await checker.runAll();
    expect(report.overallStatus).toBe('degraded');
  });

  it('handles check timeout/failure gracefully', async () => {
    const checker = new HealthChecker();

    checker.register(
      new ProviderHealthCheck('crashing', async () => {
        throw new Error('connection refused');
      }),
    );

    const report = await checker.runAll();
    expect(report.results).toHaveLength(1);
    expect(report.results[0].status).toBe('unhealthy');
    expect(report.overallStatus).toBe('unhealthy');
  });

  it('runOne returns result for specific check', async () => {
    const checker = new HealthChecker();
    checker.register(
      new ProviderHealthCheck('openai', async () => true),
    );
    checker.register(
      new MemoryStoreCheck(async () => true),
    );

    const result = await checker.runOne('llm-provider');
    expect(result).toBeDefined();
    expect(result!.name).toBe('llm-provider');
    expect(result!.status).toBe('healthy');
  });

  it('runOne returns undefined for unknown check', async () => {
    const checker = new HealthChecker();
    const result = await checker.runOne('nonexistent');
    expect(result).toBeUndefined();
  });

  it('ToolAvailabilityCheck reports healthy when all tools available', async () => {
    const check = new ToolAvailabilityCheck(async () => ({
      available: 10,
      total: 10,
      missing: [],
    }));
    const result = await check.check();
    expect(result.status).toBe('healthy');
  });

  it('ToolAvailabilityCheck reports unhealthy when most tools missing', async () => {
    const check = new ToolAvailabilityCheck(async () => ({
      available: 1,
      total: 10,
      missing: Array.from({ length: 9 }, (_, i) => `tool-${i}`),
    }));
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
  });

  it('MemoryStoreCheck reports status correctly', async () => {
    const healthy = new MemoryStoreCheck(async () => true);
    const unhealthy = new MemoryStoreCheck(async () => false);

    expect((await healthy.check()).status).toBe('healthy');
    expect((await unhealthy.check()).status).toBe('unhealthy');
  });

  it('MemoryStoreCheck handles errors', async () => {
    const check = new MemoryStoreCheck(async () => {
      throw new Error('store error');
    });
    const result = await check.check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toContain('store error');
  });

  it('empty health checker is healthy', async () => {
    const checker = new HealthChecker();
    const report = await checker.runAll();
    expect(report.overallStatus).toBe('healthy');
    expect(report.results).toHaveLength(0);
  });
});
