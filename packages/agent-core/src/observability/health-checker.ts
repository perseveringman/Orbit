// ---------------------------------------------------------------------------
// @orbit/agent-core – Health Checker
// ---------------------------------------------------------------------------

// ---- Types ----

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface CheckResult {
  readonly name: string;
  readonly status: HealthStatus;
  readonly message: string;
  readonly durationMs: number;
  readonly details?: Record<string, unknown>;
}

export interface HealthCheck {
  readonly name: string;
  readonly description: string;
  check(): Promise<CheckResult>;
}

// ---- Built-in checks ----

export class ProviderHealthCheck implements HealthCheck {
  readonly name = 'llm-provider';
  readonly description = '检查 LLM Provider 连通性';

  private readonly providerName: string;
  private readonly testFn: () => Promise<boolean>;

  constructor(providerName: string, testFn: () => Promise<boolean>) {
    this.providerName = providerName;
    this.testFn = testFn;
  }

  async check(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const ok = await this.testFn();
      const durationMs = Date.now() - start;
      return {
        name: this.name,
        status: ok ? 'healthy' : 'unhealthy',
        message: ok
          ? `${this.providerName} 连接正常`
          : `${this.providerName} 连接失败`,
        durationMs,
        details: { provider: this.providerName },
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      return {
        name: this.name,
        status: 'unhealthy',
        message: `${this.providerName} 检查异常: ${message}`,
        durationMs,
        details: { provider: this.providerName, error: message },
      };
    }
  }
}

export class ToolAvailabilityCheck implements HealthCheck {
  readonly name = 'tool-availability';
  readonly description = '检查工具可用性';

  private readonly checkFn: () => Promise<{
    available: number;
    total: number;
    missing: string[];
  }>;

  constructor(
    checkFn: () => Promise<{
      available: number;
      total: number;
      missing: string[];
    }>,
  ) {
    this.checkFn = checkFn;
  }

  async check(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const result = await this.checkFn();
      const durationMs = Date.now() - start;
      const ratio = result.total === 0 ? 1 : result.available / result.total;

      let status: HealthStatus;
      if (ratio >= 1) status = 'healthy';
      else if (ratio >= 0.5) status = 'degraded';
      else status = 'unhealthy';

      return {
        name: this.name,
        status,
        message: `工具可用: ${result.available}/${result.total}`,
        durationMs,
        details: {
          available: result.available,
          total: result.total,
          missing: result.missing,
        },
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      return {
        name: this.name,
        status: 'unhealthy',
        message: `工具检查异常: ${message}`,
        durationMs,
        details: { error: message },
      };
    }
  }
}

export class MemoryStoreCheck implements HealthCheck {
  readonly name = 'memory-store';
  readonly description = '检查记忆存储健康';

  private readonly storeFn: () => Promise<boolean>;

  constructor(storeFn: () => Promise<boolean>) {
    this.storeFn = storeFn;
  }

  async check(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const ok = await this.storeFn();
      const durationMs = Date.now() - start;
      return {
        name: this.name,
        status: ok ? 'healthy' : 'unhealthy',
        message: ok ? '记忆存储正常' : '记忆存储异常',
        durationMs,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      return {
        name: this.name,
        status: 'unhealthy',
        message: `记忆存储检查异常: ${message}`,
        durationMs,
        details: { error: message },
      };
    }
  }
}

// ---- HealthChecker ----

export class HealthChecker {
  private readonly checks: HealthCheck[] = [];

  register(check: HealthCheck): void {
    this.checks.push(check);
  }

  async runAll(): Promise<{
    readonly overallStatus: HealthStatus;
    readonly results: readonly CheckResult[];
    readonly timestamp: number;
  }> {
    const results = await Promise.all(
      this.checks.map(async (check) => {
        try {
          return await check.check();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            name: check.name,
            status: 'unhealthy' as HealthStatus,
            message: `检查失败: ${message}`,
            durationMs: 0,
          };
        }
      }),
    );

    let overallStatus: HealthStatus = 'healthy';
    for (const r of results) {
      if (r.status === 'unhealthy') {
        overallStatus = 'unhealthy';
        break;
      }
      if (r.status === 'degraded') {
        overallStatus = 'degraded';
      }
    }

    return { overallStatus, results, timestamp: Date.now() };
  }

  async runOne(name: string): Promise<CheckResult | undefined> {
    const check = this.checks.find((c) => c.name === name);
    if (!check) return undefined;
    try {
      return await check.check();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        name: check.name,
        status: 'unhealthy',
        message: `检查失败: ${message}`,
        durationMs: 0,
      };
    }
  }
}
