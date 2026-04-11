// ---------------------------------------------------------------------------
// @orbit/agent-core – Structured Logger
// ---------------------------------------------------------------------------

// ---- Types ----

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  readonly timestamp: number;
  readonly level: LogLevel;
  readonly module: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly traceId?: string;
  readonly spanId?: string;
}

export interface LogTransport {
  write(entry: LogEntry): void;
}

// ---- Level ordering ----

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

// ---- ConsoleLogTransport ----

export class ConsoleLogTransport implements LogTransport {
  write(entry: LogEntry): void {
    const prefix = `[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}] [${entry.module}]`;
    const msg = `${prefix} ${entry.message}`;
    if (entry.level === 'error' || entry.level === 'fatal') {
      console.error(msg);
    } else if (entry.level === 'warn') {
      console.warn(msg);
    } else if (entry.level === 'debug' || entry.level === 'trace') {
      console.debug(msg);
    } else {
      console.log(msg);
    }
  }
}

// ---- BufferLogTransport ----

export class BufferLogTransport implements LogTransport {
  private buffer: LogEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  write(entry: LogEntry): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  getEntries(filter?: {
    level?: LogLevel;
    module?: string;
    traceId?: string;
  }): readonly LogEntry[] {
    if (!filter) return [...this.buffer];

    return this.buffer.filter((entry) => {
      if (filter.level && entry.level !== filter.level) return false;
      if (filter.module && entry.module !== filter.module) return false;
      if (filter.traceId && entry.traceId !== filter.traceId) return false;
      return true;
    });
  }

  clear(): void {
    this.buffer = [];
  }
}

// ---- Logger ----

export class Logger {
  private readonly module: string;
  private transports: LogTransport[];
  private minLevel: LogLevel;
  private traceId?: string;
  private spanId?: string;

  constructor(
    module: string,
    options?: {
      minLevel?: LogLevel;
      transports?: LogTransport[];
      traceId?: string;
      spanId?: string;
    },
  ) {
    this.module = module;
    this.minLevel = options?.minLevel ?? 'info';
    this.transports = options?.transports ? [...options.transports] : [];
    this.traceId = options?.traceId;
    this.spanId = options?.spanId;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    this.log('fatal', message, context);
  }

  child(module: string): Logger {
    return new Logger(module, {
      minLevel: this.minLevel,
      transports: this.transports,
      traceId: this.traceId,
      spanId: this.spanId,
    });
  }

  withTrace(traceId: string, spanId?: string): Logger {
    return new Logger(this.module, {
      minLevel: this.minLevel,
      transports: this.transports,
      traceId,
      spanId,
    });
  }

  // ---- Private ----

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      module: this.module,
      message,
      context,
      traceId: this.traceId,
      spanId: this.spanId,
    };

    for (const transport of this.transports) {
      transport.write(entry);
    }
  }
}
