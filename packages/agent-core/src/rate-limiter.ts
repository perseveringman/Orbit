// ---------------------------------------------------------------------------
// @orbit/agent-core – Rate Limiter
// ---------------------------------------------------------------------------

// ---- Types ----

export interface RateLimitState {
  readonly provider: string;
  readonly remainingRequests?: number;
  readonly remainingTokens?: number;
  readonly resetAt?: number;
}

// ---- Rate Limiter ----

/**
 * Tracks rate-limit state per provider from API response headers,
 * and computes wait durations before the next request.
 */
export class RateLimiter {
  private readonly state = new Map<string, RateLimitState>();

  /**
   * Update rate-limit state from response headers.
   * Supports standard rate-limit headers used by OpenAI and Anthropic.
   */
  updateFromHeaders(provider: string, headers: Headers): void {
    const remainingRequests = parseHeaderNumber(
      headers.get('x-ratelimit-remaining-requests'),
    );
    const remainingTokens = parseHeaderNumber(
      headers.get('x-ratelimit-remaining-tokens'),
    );
    const resetMs = parseResetHeader(
      headers.get('x-ratelimit-reset-requests'),
    );

    this.state.set(provider, {
      provider,
      remainingRequests,
      remainingTokens,
      resetAt: resetMs,
    });
  }

  /**
   * Returns the number of milliseconds to wait before making the
   * next request. Returns 0 if no wait is needed.
   */
  shouldWait(provider: string): number {
    const s = this.state.get(provider);
    if (!s) return 0;

    // If remaining requests is 0, wait until reset
    if (s.remainingRequests !== undefined && s.remainingRequests <= 0 && s.resetAt) {
      const wait = s.resetAt - Date.now();
      return Math.max(0, wait);
    }

    return 0;
  }

  /**
   * Get the current rate-limit state for a provider.
   */
  getState(provider: string): RateLimitState | undefined {
    return this.state.get(provider);
  }
}

// ---- Backoff utility ----

/**
 * Compute a jittered exponential backoff delay in milliseconds.
 * @param attempt Zero-based attempt number
 * @param baseDelay Base delay in ms (default 1000)
 */
export function jitteredBackoff(attempt: number, baseDelay = 1000): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * exponential;
  return Math.floor(exponential + jitter);
}

// ---- Internal helpers ----

function parseHeaderNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseResetHeader(value: string | null): number | undefined {
  if (value === null) return undefined;

  // Try parsing as an ISO date string
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.getTime();
  }

  // Try parsing as seconds-from-now (e.g., "1.5s" or "60")
  const match = value.match(/^([\d.]+)s?$/);
  if (match) {
    return Date.now() + Number(match[1]) * 1000;
  }

  return undefined;
}
