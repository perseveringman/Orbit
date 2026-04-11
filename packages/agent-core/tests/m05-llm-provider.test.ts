import { describe, expect, it, beforeEach } from 'vitest';

import {
  // LLM Provider
  ProviderRegistry,
  // Model Metadata
  MODEL_CATALOG,
  getModelMetadata,
  estimateCost,
  // Cost Tracker
  CostTracker,
  // Rate Limiter
  RateLimiter,
  jitteredBackoff,
  // Stream Utilities
  collectStreamToResponse,
  // Compatibility adapter
  LLMAdapterFromProvider,
} from '../src/index';

import type {
  LLMProvider,
  StreamChunk,
  ProviderConfig,
  TokenUsage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  BudgetConfig,
  ModelMetadata,
  RateLimitState,
} from '../src/index';

// ---------------------------------------------------------------------------
// Mock provider for testing
// ---------------------------------------------------------------------------

function makeMockProvider(
  name = 'mock',
  overrides?: Partial<LLMProvider>,
): LLMProvider {
  return {
    name,
    chatCompletion: overrides?.chatCompletion ?? (async () => ({
      id: 'resp_1',
      choices: [
        {
          message: {
            id: 'msg_1',
            role: 'assistant' as const,
            content: 'Hello from mock',
            timestamp: new Date().toISOString(),
          },
          finishReason: 'stop' as const,
        },
      ],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    })),
    chatCompletionStream: overrides?.chatCompletionStream ?? (async function* () {
      yield { type: 'text-delta' as const, text: 'Hello' };
      yield { type: 'text-delta' as const, text: ' world' };
      yield {
        type: 'usage' as const,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
      yield { type: 'done' as const, finishReason: 'stop' };
    }),
  };
}

// ---------------------------------------------------------------------------
// ProviderRegistry
// ---------------------------------------------------------------------------

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('registers and retrieves a provider', () => {
    const provider = makeMockProvider('openai');
    registry.register(provider);

    expect(registry.get('openai')).toBe(provider);
    expect(registry.list()).toEqual(['openai']);
  });

  it('first registered provider becomes default', () => {
    const p1 = makeMockProvider('openai');
    const p2 = makeMockProvider('anthropic');

    registry.register(p1);
    registry.register(p2);

    expect(registry.getDefault()).toBe(p1);
  });

  it('setDefault changes the default provider', () => {
    const p1 = makeMockProvider('openai');
    const p2 = makeMockProvider('anthropic');

    registry.register(p1);
    registry.register(p2);
    registry.setDefault('anthropic');

    expect(registry.getDefault()).toBe(p2);
  });

  it('throws on getDefault with no providers', () => {
    expect(() => registry.getDefault()).toThrow('no providers registered');
  });

  it('throws on setDefault with unregistered name', () => {
    expect(() => registry.setDefault('unknown')).toThrow('not registered');
  });

  it('returns undefined for unknown provider', () => {
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('lists all registered provider names', () => {
    registry.register(makeMockProvider('a'));
    registry.register(makeMockProvider('b'));
    registry.register(makeMockProvider('c'));

    expect(registry.list()).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// ModelMetadata
// ---------------------------------------------------------------------------

describe('ModelMetadata', () => {
  it('MODEL_CATALOG is a non-empty array', () => {
    expect(MODEL_CATALOG.length).toBeGreaterThan(0);
  });

  it('every catalog entry has required fields', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.id).toBeTruthy();
      expect(m.provider).toBeTruthy();
      expect(m.displayName).toBeTruthy();
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.maxOutput).toBeGreaterThan(0);
      expect(typeof m.costPer1MInput).toBe('number');
      expect(typeof m.costPer1MOutput).toBe('number');
      expect(typeof m.supportsVision).toBe('boolean');
      expect(typeof m.supportsStreaming).toBe('boolean');
      expect(typeof m.supportsFunctionCalling).toBe('boolean');
      expect(typeof m.supportsThinking).toBe('boolean');
    }
  });

  it('getModelMetadata returns metadata for known model', () => {
    const meta = getModelMetadata('gpt-4o');
    expect(meta).toBeDefined();
    expect(meta!.provider).toBe('openai');
    expect(meta!.contextWindow).toBe(128_000);
  });

  it('getModelMetadata returns undefined for unknown model', () => {
    expect(getModelMetadata('nonexistent-model')).toBeUndefined();
  });

  it('estimateCost computes correct cost', () => {
    const usage: TokenUsage = {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    };
    // gpt-4o: $2.5 input + $10 output = $12.5
    const cost = estimateCost('gpt-4o', usage);
    expect(cost).toBeCloseTo(12.5, 2);
  });

  it('estimateCost returns 0 for unknown model', () => {
    const usage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    };
    expect(estimateCost('unknown-model', usage)).toBe(0);
  });

  it('estimateCost returns 0 for zero-cost models', () => {
    const usage: TokenUsage = {
      promptTokens: 1_000_000,
      completionTokens: 500_000,
      totalTokens: 1_500_000,
    };
    const cost = estimateCost('llama3.1', usage);
    expect(cost).toBe(0);
  });

  it('catalog includes models from multiple providers', () => {
    const providers = new Set(MODEL_CATALOG.map((m) => m.provider));
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('ollama')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('starts with zero session total', () => {
    expect(tracker.getSessionTotal()).toBe(0);
  });

  it('records a cost entry', () => {
    const usage: TokenUsage = {
      promptTokens: 500_000,
      completionTokens: 100_000,
      totalTokens: 600_000,
    };
    const record = tracker.record('gpt-4o', 'openai', usage);

    expect(record.model).toBe('gpt-4o');
    expect(record.provider).toBe('openai');
    expect(record.usage).toBe(usage);
    expect(record.estimatedCostUsd).toBeGreaterThan(0);
    expect(record.timestamp).toBeGreaterThan(0);
  });

  it('accumulates session total across records', () => {
    const usage1: TokenUsage = { promptTokens: 1_000_000, completionTokens: 0, totalTokens: 1_000_000 };
    const usage2: TokenUsage = { promptTokens: 0, completionTokens: 1_000_000, totalTokens: 1_000_000 };

    tracker.record('gpt-4o', 'openai', usage1);
    tracker.record('gpt-4o', 'openai', usage2);

    // $2.5 input + $10 output = $12.5
    expect(tracker.getSessionTotal()).toBeCloseTo(12.5, 2);
  });

  it('checkBudget returns ok within budget', () => {
    const config: BudgetConfig = { maxCostPerSession: 10.0, maxCostPerDay: 50.0, warnThreshold: 0.8 };
    const status = tracker.checkBudget(config);

    expect(status.status).toBe('ok');
    expect(status.spent).toBe(0);
    expect(status.limit).toBe(10.0);
  });

  it('checkBudget returns warning at threshold', () => {
    const usage: TokenUsage = { promptTokens: 1_000_000, completionTokens: 500_000, totalTokens: 1_500_000 };
    tracker.record('gpt-4o', 'openai', usage);
    // Cost: 2.5 + 5.0 = $7.5

    const config: BudgetConfig = { maxCostPerSession: 9.0, maxCostPerDay: 50.0, warnThreshold: 0.8 };
    // 80% of 9.0 = 7.2, spent = 7.5 → warning
    const status = tracker.checkBudget(config);

    expect(status.status).toBe('warning');
  });

  it('checkBudget returns exceeded over limit', () => {
    const usage: TokenUsage = { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 };
    tracker.record('gpt-4o', 'openai', usage);
    // Cost: 2.5 + 10.0 = $12.5

    const config: BudgetConfig = { maxCostPerSession: 10.0, maxCostPerDay: 50.0, warnThreshold: 0.8 };
    const status = tracker.checkBudget(config);

    expect(status.status).toBe('exceeded');
  });

  it('getRecords returns all recorded entries', () => {
    const usage: TokenUsage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
    tracker.record('gpt-4o', 'openai', usage);
    tracker.record('gpt-4o-mini', 'openai', usage);

    expect(tracker.getRecords()).toHaveLength(2);
    expect(tracker.getRecords()[0].model).toBe('gpt-4o');
    expect(tracker.getRecords()[1].model).toBe('gpt-4o-mini');
  });
});

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it('returns 0 wait for unknown provider', () => {
    expect(limiter.shouldWait('openai')).toBe(0);
  });

  it('returns undefined state for unknown provider', () => {
    expect(limiter.getState('openai')).toBeUndefined();
  });

  it('updates state from headers', () => {
    const headers = new Headers({
      'x-ratelimit-remaining-requests': '50',
      'x-ratelimit-remaining-tokens': '10000',
    });
    limiter.updateFromHeaders('openai', headers);

    const state = limiter.getState('openai');
    expect(state).toBeDefined();
    expect(state!.remainingRequests).toBe(50);
    expect(state!.remainingTokens).toBe(10000);
  });

  it('shouldWait returns positive ms when rate limited', () => {
    const futureReset = new Date(Date.now() + 5000).toISOString();
    const headers = new Headers({
      'x-ratelimit-remaining-requests': '0',
      'x-ratelimit-reset-requests': futureReset,
    });
    limiter.updateFromHeaders('openai', headers);

    const wait = limiter.shouldWait('openai');
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(5000);
  });

  it('shouldWait returns 0 when requests remain', () => {
    const headers = new Headers({
      'x-ratelimit-remaining-requests': '10',
    });
    limiter.updateFromHeaders('openai', headers);

    expect(limiter.shouldWait('openai')).toBe(0);
  });
});

describe('jitteredBackoff', () => {
  it('returns a number >= base delay for attempt 0', () => {
    const delay = jitteredBackoff(0, 1000);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(2000);
  });

  it('increases with attempt number', () => {
    // Run multiple trials to confirm tendency
    const delays0 = Array.from({ length: 20 }, () => jitteredBackoff(0, 100));
    const delays3 = Array.from({ length: 20 }, () => jitteredBackoff(3, 100));

    const avg0 = delays0.reduce((a, b) => a + b) / delays0.length;
    const avg3 = delays3.reduce((a, b) => a + b) / delays3.length;

    expect(avg3).toBeGreaterThan(avg0);
  });

  it('uses default base delay of 1000', () => {
    const delay = jitteredBackoff(0);
    expect(delay).toBeGreaterThanOrEqual(1000);
  });
});

// ---------------------------------------------------------------------------
// Stream Utilities
// ---------------------------------------------------------------------------

describe('collectStreamToResponse', () => {
  it('collects text deltas into content', async () => {
    async function* chunks(): AsyncGenerator<StreamChunk> {
      yield { type: 'text-delta', text: 'Hello' };
      yield { type: 'text-delta', text: ' world' };
      yield { type: 'usage', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      yield { type: 'done', finishReason: 'stop' };
    }

    const response = await collectStreamToResponse(chunks());

    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.content).toBe('Hello world');
    expect(response.choices[0].message.role).toBe('assistant');
    expect(response.choices[0].finishReason).toBe('stop');
    expect(response.usage.promptTokens).toBe(10);
    expect(response.usage.completionTokens).toBe(5);
  });

  it('collects tool call chunks', async () => {
    async function* chunks(): AsyncGenerator<StreamChunk> {
      yield { type: 'tool-call-start', toolCallId: 'tc_1', name: 'search' };
      yield { type: 'tool-call-delta', toolCallId: 'tc_1', arguments: '{"q":' };
      yield { type: 'tool-call-delta', toolCallId: 'tc_1', arguments: '"test"}' };
      yield { type: 'tool-call-end', toolCallId: 'tc_1' };
      yield { type: 'done', finishReason: 'tool_calls' };
    }

    const response = await collectStreamToResponse(chunks());

    expect(response.choices[0].finishReason).toBe('tool_calls');
    expect(response.choices[0].message.toolCalls).toHaveLength(1);
    expect(response.choices[0].message.toolCalls![0].name).toBe('search');
    expect(response.choices[0].message.toolCalls![0].arguments).toBe('{"q":"test"}');
  });

  it('handles empty stream', async () => {
    async function* chunks(): AsyncGenerator<StreamChunk> {
      yield { type: 'done', finishReason: 'stop' };
    }

    const response = await collectStreamToResponse(chunks());

    expect(response.choices[0].message.content).toBe('');
    expect(response.choices[0].finishReason).toBe('stop');
  });
});

// ---------------------------------------------------------------------------
// LLMAdapterFromProvider
// ---------------------------------------------------------------------------

describe('LLMAdapterFromProvider', () => {
  it('delegates chatCompletion to provider', async () => {
    const provider = makeMockProvider();
    const adapter = new LLMAdapterFromProvider(provider);

    const request: ChatCompletionRequest = {
      model: 'gpt-4o',
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const response = await adapter.chatCompletion(request);

    expect(response.id).toBe('resp_1');
    expect(response.choices[0].message.content).toBe('Hello from mock');
  });
});

// ---------------------------------------------------------------------------
// StreamChunk type validation
// ---------------------------------------------------------------------------

describe('StreamChunk types', () => {
  it('text-delta chunk has correct shape', () => {
    const chunk: StreamChunk = { type: 'text-delta', text: 'hello' };
    expect(chunk.type).toBe('text-delta');
    if (chunk.type === 'text-delta') {
      expect(chunk.text).toBe('hello');
    }
  });

  it('thinking-delta chunk has correct shape', () => {
    const chunk: StreamChunk = { type: 'thinking-delta', text: 'reasoning...' };
    expect(chunk.type).toBe('thinking-delta');
  });

  it('tool-call-start chunk has correct shape', () => {
    const chunk: StreamChunk = {
      type: 'tool-call-start',
      toolCallId: 'tc_1',
      name: 'search',
    };
    expect(chunk.type).toBe('tool-call-start');
    if (chunk.type === 'tool-call-start') {
      expect(chunk.toolCallId).toBe('tc_1');
      expect(chunk.name).toBe('search');
    }
  });

  it('usage chunk has correct shape', () => {
    const chunk: StreamChunk = {
      type: 'usage',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    };
    expect(chunk.type).toBe('usage');
    if (chunk.type === 'usage') {
      expect(chunk.usage.totalTokens).toBe(15);
    }
  });

  it('done chunk has correct shape', () => {
    const chunk: StreamChunk = { type: 'done', finishReason: 'stop' };
    expect(chunk.type).toBe('done');
    if (chunk.type === 'done') {
      expect(chunk.finishReason).toBe('stop');
    }
  });
});

// ---------------------------------------------------------------------------
// TokenUsage cache token fields
// ---------------------------------------------------------------------------

describe('TokenUsage', () => {
  it('supports optional cache token fields', () => {
    const usage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cacheReadTokens: 80,
      cacheWriteTokens: 20,
    };

    expect(usage.cacheReadTokens).toBe(80);
    expect(usage.cacheWriteTokens).toBe(20);
  });

  it('cache fields are optional', () => {
    const usage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    };

    expect(usage.cacheReadTokens).toBeUndefined();
    expect(usage.cacheWriteTokens).toBeUndefined();
  });
});
