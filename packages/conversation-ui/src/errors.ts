// ---------------------------------------------------------------------------
// @orbit/conversation-ui – Error handling utilities
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback } from 'react';

import type { RenderableMessage } from './types.js';

// ---- Classified error ----

export interface ClassifiedError {
  readonly category:
    | 'network'
    | 'rate-limit'
    | 'token-limit'
    | 'tool-failure'
    | 'ipc-disconnect'
    | 'unknown';
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
}

// ---- Classification logic ----

const RATE_LIMIT_RE = /429|rate.?limit/i;
const TOKEN_LIMIT_RE = /token.{0,20}(limit|exceeded|maximum)/i;
const NETWORK_RE = /network|Failed to fetch|ECONNREFUSED/i;
const FETCH_ERROR_RE = /\bfetch\b/i;
const IPC_RE = /timeout|IPC|bridge|主进程/i;

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  ) {
    return (error as Record<string, unknown>).status as number;
  }
  return undefined;
}

function parseRetryAfter(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'headers' in error &&
    typeof (error as Record<string, unknown>).headers === 'object'
  ) {
    const headers = (error as Record<string, unknown>).headers as Record<string, unknown>;

    // Support Headers-like objects (get method) and plain objects
    let raw: string | undefined;
    if (typeof (headers as { get?: unknown }).get === 'function') {
      raw = (headers as { get: (k: string) => string | null }).get('retry-after') ?? undefined;
    } else if ('retry-after' in headers) {
      raw = String(headers['retry-after']);
    }

    if (raw !== undefined) {
      const seconds = Number(raw);
      if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
    }
  }
  return undefined;
}

const DEFAULT_RETRY_AFTER_MS = 30_000;

/**
 * Categorises an arbitrary error into one of the known error scenarios so the
 * UI layer can decide how to render it (banner, inline message, retry, etc.).
 */
export function classifyError(error: unknown): ClassifiedError {
  const status = extractStatus(error);
  const msg = extractMessage(error);

  // Rate-limit (429)
  if (status === 429 || RATE_LIMIT_RE.test(msg)) {
    return {
      category: 'rate-limit',
      message: msg,
      retryable: true,
      retryAfterMs: parseRetryAfter(error) ?? DEFAULT_RETRY_AFTER_MS,
    };
  }

  // Token limit
  if (TOKEN_LIMIT_RE.test(msg)) {
    return { category: 'token-limit', message: msg, retryable: false };
  }

  // Network errors
  if (NETWORK_RE.test(msg) || FETCH_ERROR_RE.test(msg)) {
    return { category: 'network', message: msg, retryable: true };
  }

  // IPC / bridge disconnect
  if (IPC_RE.test(msg)) {
    return { category: 'ipc-disconnect', message: msg, retryable: true };
  }

  // Unknown
  return { category: 'unknown', message: msg, retryable: false };
}

// ---- Renderable message conversion ----

/**
 * Converts a {@link ClassifiedError} into a {@link RenderableMessage} that can
 * be inserted directly into the conversation stream.
 */
export function errorToRenderableMessage(
  error: ClassifiedError,
  existingId?: string,
): RenderableMessage {
  return {
    id: existingId ?? `error-${Date.now()}`,
    type: error.category === 'token-limit' ? 'system' : 'error',
    timestamp: new Date().toISOString(),
    content: error.message,
    metadata: {
      errorCategory: error.category,
      retryable: error.retryable,
      retryAfterMs: error.retryAfterMs,
    },
  };
}

// ---- Retry countdown hook ----

export interface RetryCountdownState {
  readonly remainingMs: number;
  readonly isCountingDown: boolean;
  readonly cancel: () => void;
}

const TICK_INTERVAL_MS = 250;

/**
 * Hook that counts down from `retryAfterMs` and calls `onRetry` when it
 * reaches zero. Returns the current remaining time and a `cancel` function.
 */
export function useRetryCountdown(
  retryAfterMs: number | undefined,
  onRetry: () => void,
): RetryCountdownState {
  const [remainingMs, setRemainingMs] = useState(retryAfterMs ?? 0);
  const [isCountingDown, setIsCountingDown] = useState(retryAfterMs != null && retryAfterMs > 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;

  const cancel = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCountingDown(false);
  }, []);

  useEffect(() => {
    if (retryAfterMs == null || retryAfterMs <= 0) {
      setIsCountingDown(false);
      setRemainingMs(0);
      return;
    }

    const start = Date.now();
    setRemainingMs(retryAfterMs);
    setIsCountingDown(true);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = retryAfterMs - elapsed;

      if (left <= 0) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setRemainingMs(0);
        setIsCountingDown(false);
        onRetryRef.current();
      } else {
        setRemainingMs(left);
      }
    }, TICK_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [retryAfterMs]);

  return { remainingMs, isCountingDown, cancel };
}
