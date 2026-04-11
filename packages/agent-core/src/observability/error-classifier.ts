// ---------------------------------------------------------------------------
// @orbit/agent-core – Error Classifier
// ---------------------------------------------------------------------------

// ---- Types ----

export type ErrorCategory =
  | 'auth'
  | 'rate-limit'
  | 'context-overflow'
  | 'server-error'
  | 'network'
  | 'tool-error'
  | 'safety-block'
  | 'validation'
  | 'budget'
  | 'timeout'
  | 'unknown';

export interface ClassifiedError {
  readonly category: ErrorCategory;
  readonly message: string;
  readonly originalError: unknown;
  readonly retryable: boolean;
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly suggestion: string;
}

export interface RecoveryStrategy {
  readonly retry: boolean;
  readonly maxAttempts: number;
  readonly backoffBase: number;
  readonly failover: boolean;
  readonly compress: boolean;
  readonly notify: boolean;
}

// ---- Recovery strategies ----

export const RECOVERY_STRATEGIES: Record<ErrorCategory, RecoveryStrategy> = {
  'auth':             { retry: true,  maxAttempts: 1, backoffBase: 0,    failover: true,  compress: false, notify: true  },
  'rate-limit':       { retry: true,  maxAttempts: 5, backoffBase: 1000, failover: true,  compress: false, notify: false },
  'context-overflow': { retry: true,  maxAttempts: 1, backoffBase: 0,    failover: false, compress: true,  notify: true  },
  'server-error':     { retry: true,  maxAttempts: 3, backoffBase: 2000, failover: true,  compress: false, notify: false },
  'network':          { retry: true,  maxAttempts: 3, backoffBase: 1000, failover: false, compress: false, notify: true  },
  'tool-error':       { retry: false, maxAttempts: 0, backoffBase: 0,    failover: false, compress: false, notify: false },
  'safety-block':     { retry: false, maxAttempts: 0, backoffBase: 0,    failover: false, compress: false, notify: true  },
  'validation':       { retry: false, maxAttempts: 0, backoffBase: 0,    failover: false, compress: false, notify: true  },
  'budget':           { retry: false, maxAttempts: 0, backoffBase: 0,    failover: false, compress: false, notify: true  },
  'timeout':          { retry: true,  maxAttempts: 2, backoffBase: 5000, failover: true,  compress: false, notify: true  },
  'unknown':          { retry: true,  maxAttempts: 1, backoffBase: 1000, failover: false, compress: false, notify: true  },
};

// ---- Suggestion messages (Chinese) ----

const SUGGESTIONS: Record<ErrorCategory, string> = {
  'auth':             '请检查 API 密钥或访问令牌是否有效，尝试重新授权。',
  'rate-limit':       '请求过于频繁，系统将自动重试。请稍后再试。',
  'context-overflow': '上下文过长，系统将尝试压缩。可尝试减少对话长度。',
  'server-error':     '服务端出错，系统将自动重试。如持续失败请联系管理员。',
  'network':          '网络连接异常，请检查网络后重试。',
  'tool-error':       '工具执行失败，请检查工具参数或联系开发者。',
  'safety-block':     '请求被安全策略拦截，请修改请求内容后重试。',
  'validation':       '输入参数验证失败，请检查输入格式。',
  'budget':           '已达到费用上限，请调整预算设置后继续。',
  'timeout':          '操作超时，系统将自动重试。如持续超时请检查服务状态。',
  'unknown':          '发生未知错误，请稍后重试或联系支持团队。',
};

// ---- Classification helpers ----

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (e.response && typeof e.response === 'object') {
      const resp = e.response as Record<string, unknown>;
      if (typeof resp.status === 'number') return resp.status;
    }
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
  }
  return String(error);
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.code === 'string') return e.code;
  }
  return undefined;
}

// ---- Classify ----

export function classifyError(error: unknown): ClassifiedError {
  const message = getErrorMessage(error);
  const statusCode = getStatusCode(error);
  const errorCode = getErrorCode(error);
  const lowerMsg = message.toLowerCase();

  let category: ErrorCategory = 'unknown';

  // HTTP status code based classification
  if (statusCode !== undefined) {
    if (statusCode === 401 || statusCode === 403) {
      category = 'auth';
    } else if (statusCode === 429) {
      category = 'rate-limit';
    } else if (statusCode >= 500 && statusCode < 600) {
      category = 'server-error';
    }
  }

  // Error code based classification (Node.js network errors)
  if (category === 'unknown' && errorCode) {
    const networkCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE', 'EAI_AGAIN'];
    if (networkCodes.includes(errorCode)) {
      category = 'network';
    }
  }

  // Message-based classification
  if (category === 'unknown') {
    if (lowerMsg.includes('context length') || lowerMsg.includes('max tokens') || lowerMsg.includes('maximum context')) {
      category = 'context-overflow';
    } else if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out') || lowerMsg.includes('deadline exceeded')) {
      category = 'timeout';
    } else if (lowerMsg.includes('safety') || lowerMsg.includes('content policy') || lowerMsg.includes('blocked')) {
      category = 'safety-block';
    } else if (lowerMsg.includes('budget') || lowerMsg.includes('cost limit') || lowerMsg.includes('spending limit')) {
      category = 'budget';
    } else if (lowerMsg.includes('validation') || lowerMsg.includes('invalid') || lowerMsg.includes('schema')) {
      category = 'validation';
    } else if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many requests')) {
      category = 'rate-limit';
    } else if (lowerMsg.includes('unauthorized') || lowerMsg.includes('forbidden') || lowerMsg.includes('authentication')) {
      category = 'auth';
    }
  }

  // Error type based classification
  if (category === 'unknown' && error instanceof Error) {
    if (error instanceof TypeError || error instanceof SyntaxError) {
      category = 'tool-error';
    }
  }

  const strategy = RECOVERY_STRATEGIES[category];

  return {
    category,
    message,
    originalError: error,
    retryable: strategy.retry,
    maxRetries: strategy.maxAttempts,
    backoffMs: strategy.backoffBase,
    suggestion: SUGGESTIONS[category],
  };
}

// ---- Recovery strategy lookup ----

export function getRecoveryStrategy(category: ErrorCategory): RecoveryStrategy {
  return RECOVERY_STRATEGIES[category];
}

// ---- User-friendly error formatting (Chinese) ----

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  'auth':             '认证错误',
  'rate-limit':       '请求限流',
  'context-overflow': '上下文溢出',
  'server-error':     '服务端错误',
  'network':          '网络错误',
  'tool-error':       '工具执行错误',
  'safety-block':     '安全拦截',
  'validation':       '参数验证错误',
  'budget':           '预算超限',
  'timeout':          '操作超时',
  'unknown':          '未知错误',
};

export function formatErrorForUser(error: ClassifiedError): string {
  const label = CATEGORY_LABELS[error.category];
  return `[${label}] ${error.message}\n建议: ${error.suggestion}`;
}
