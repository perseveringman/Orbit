import { describe, expect, it, beforeEach } from 'vitest';

import type { AgentMessage } from '../src/types.js';
import { generateId } from '../src/types.js';
import { TokenEstimator } from '../src/session/token-estimator.js';
import {
  SessionManager,
  type SessionRecord,
} from '../src/session/session-manager.js';
import {
  HeadTailStrategy,
  ImportanceStrategy,
  SlidingWindowStrategy,
  CompressionEngine,
  createDefaultCompressionEngine,
  type CompressionOptions,
} from '../src/session/compression-engine.js';

// ---- Helpers ----

function msg(
  role: AgentMessage['role'],
  content: string,
  extra?: Partial<AgentMessage>,
): AgentMessage {
  return {
    id: generateId('msg'),
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function makeMessages(count: number, prefix = 'Message'): AgentMessage[] {
  const msgs: AgentMessage[] = [];
  for (let i = 0; i < count; i++) {
    const role: AgentMessage['role'] = i % 2 === 0 ? 'user' : 'assistant';
    msgs.push(msg(role, `${prefix} ${i}`));
  }
  return msgs;
}

const DEFAULT_OPTS: CompressionOptions = {
  targetTokens: 500,
  preserveHead: 2,
  preserveTail: 2,
  preserveToolResults: false,
};

// ===========================================================================
// TokenEstimator
// ===========================================================================

describe('TokenEstimator', () => {
  it('estimates English text at ~4 chars/token', () => {
    const text = 'Hello world'; // 11 chars → ceil(11/4) = 3
    expect(TokenEstimator.estimate(text)).toBe(3);
  });

  it('estimates CJK text at ~2 chars/token', () => {
    const text = '你好世界测试'; // 6 CJK chars → ceil(6/2) = 3
    expect(TokenEstimator.estimate(text)).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(TokenEstimator.estimate('')).toBe(0);
  });

  it('estimates a single message including overhead', () => {
    const m = msg('user', 'Hello world');
    const tokens = TokenEstimator.estimateMessage(m);
    // 3 (content) + 4 (overhead) = 7
    expect(tokens).toBe(7);
  });

  it('accounts for tool calls in message estimation', () => {
    const m = msg('assistant', 'Calling tool', {
      toolCalls: [
        { id: 'tc1', name: 'search', arguments: '{"q":"test"}' },
      ],
    });
    const withoutTools = TokenEstimator.estimateMessage(msg('assistant', 'Calling tool'));
    const withTools = TokenEstimator.estimateMessage(m);
    expect(withTools).toBeGreaterThan(withoutTools);
  });

  it('estimates multiple messages', () => {
    const messages = [msg('user', 'Hi'), msg('assistant', 'Hello')];
    const total = TokenEstimator.estimateMessages(messages);
    expect(total).toBeGreaterThan(0);
    expect(total).toBe(
      TokenEstimator.estimateMessage(messages[0]) +
        TokenEstimator.estimateMessage(messages[1]),
    );
  });

  it('fitsInBudget returns true when within budget', () => {
    const messages = [msg('user', 'Hi')];
    expect(TokenEstimator.fitsInBudget(messages, 1000)).toBe(true);
  });

  it('fitsInBudget returns false when over budget', () => {
    const messages = [msg('user', 'x'.repeat(1000))];
    expect(TokenEstimator.fitsInBudget(messages, 5)).toBe(false);
  });
});

// ===========================================================================
// SessionManager
// ===========================================================================

describe('SessionManager', () => {
  let mgr: SessionManager;

  beforeEach(() => {
    mgr = new SessionManager();
  });

  it('creates a session with defaults', () => {
    const s = mgr.create('project');
    expect(s.id).toContain('ses_');
    expect(s.surface).toBe('project');
    expect(s.messages).toHaveLength(0);
    expect(s.tokenCount).toBe(0);
    expect(s.compressed).toBe(false);
  });

  it('creates a session with metadata', () => {
    const s = mgr.create('reader', { foo: 'bar' });
    expect(s.metadata).toEqual({ foo: 'bar' });
  });

  it('retrieves a session by id', () => {
    const s = mgr.create('project');
    expect(mgr.get(s.id)).toBe(s);
  });

  it('returns undefined for unknown id', () => {
    expect(mgr.get('nonexistent')).toBeUndefined();
  });

  it('adds a message and updates token count', () => {
    const s = mgr.create('project');
    const m = msg('user', 'Hello world');
    mgr.addMessage(s.id, m);
    expect(s.messages).toHaveLength(1);
    expect(s.tokenCount).toBeGreaterThan(0);
  });

  it('throws when adding message to unknown session', () => {
    expect(() => mgr.addMessage('bad', msg('user', 'x'))).toThrow(
      'Session not found',
    );
  });

  describe('fork', () => {
    it('creates a child session linked to parent', () => {
      const parent = mgr.create('project');
      mgr.addMessage(parent.id, msg('user', 'Hello'));
      const child = mgr.fork(parent.id);
      expect(child.parentId).toBe(parent.id);
      expect(child.surface).toBe(parent.surface);
      expect(child.metadata).toHaveProperty('forkedFrom', parent.id);
    });

    it('includes summary message when provided', () => {
      const parent = mgr.create('project');
      mgr.addMessage(parent.id, msg('user', 'Hello'));
      const child = mgr.fork(parent.id, { summary: 'We discussed X' });
      expect(child.messages.length).toBeGreaterThanOrEqual(1);
      expect(child.messages[0].role).toBe('system');
      expect(child.messages[0].content).toContain('We discussed X');
    });

    it('preserves last N messages from parent', () => {
      const parent = mgr.create('project');
      for (let i = 0; i < 5; i++) {
        mgr.addMessage(parent.id, msg('user', `msg-${i}`));
      }
      const child = mgr.fork(parent.id, { preserveMessages: 2 });
      const contents = child.messages.map((m) => m.content);
      expect(contents).toContain('msg-3');
      expect(contents).toContain('msg-4');
    });

    it('throws when forking unknown session', () => {
      expect(() => mgr.fork('bad')).toThrow('Session not found');
    });
  });

  describe('getLineage', () => {
    it('returns [self] for root session', () => {
      const s = mgr.create('project');
      const lineage = mgr.getLineage(s.id);
      expect(lineage).toHaveLength(1);
      expect(lineage[0].id).toBe(s.id);
    });

    it('returns [root, ..., self] for forked chain', () => {
      const root = mgr.create('project');
      const child = mgr.fork(root.id);
      const grandchild = mgr.fork(child.id);
      const lineage = mgr.getLineage(grandchild.id);
      expect(lineage.map((s) => s.id)).toEqual([
        root.id,
        child.id,
        grandchild.id,
      ]);
    });
  });

  describe('getChildren', () => {
    it('returns children of a session', () => {
      const parent = mgr.create('project');
      const c1 = mgr.fork(parent.id);
      const c2 = mgr.fork(parent.id);
      const children = mgr.getChildren(parent.id);
      expect(children.map((c) => c.id).sort()).toEqual(
        [c1.id, c2.id].sort(),
      );
    });

    it('returns empty for session with no children', () => {
      const s = mgr.create('project');
      expect(mgr.getChildren(s.id)).toHaveLength(0);
    });
  });

  it('lists all sessions', () => {
    mgr.create('project');
    mgr.create('reader');
    expect(mgr.list()).toHaveLength(2);
  });

  it('deletes a session', () => {
    const s = mgr.create('project');
    expect(mgr.delete(s.id)).toBe(true);
    expect(mgr.get(s.id)).toBeUndefined();
  });

  it('delete returns false for unknown id', () => {
    expect(mgr.delete('nope')).toBe(false);
  });

  it('estimateTokens delegates to TokenEstimator', () => {
    const messages = [msg('user', 'Hello')];
    expect(mgr.estimateTokens(messages)).toBe(
      TokenEstimator.estimateMessages(messages),
    );
  });
});

// ===========================================================================
// HeadTailStrategy
// ===========================================================================

describe('HeadTailStrategy', () => {
  const strategy = new HeadTailStrategy();

  it('preserves head and tail messages', () => {
    const messages = makeMessages(10);
    const result = strategy.compress(messages, DEFAULT_OPTS);
    // First 2 should be from head, last 2 from tail
    expect(result.messages[0].content).toBe(messages[0].content);
    expect(result.messages[1].content).toBe(messages[1].content);
    const last = result.messages[result.messages.length - 1];
    expect(last.content).toBe(messages[9].content);
  });

  it('includes a summary marker for compressed middle', () => {
    const messages = makeMessages(10);
    const result = strategy.compress(messages, DEFAULT_OPTS);
    expect(result.summary).toBeDefined();
    expect(result.removedCount).toBeGreaterThan(0);
  });

  it('returns all messages when count ≤ head+tail', () => {
    const messages = makeMessages(4);
    const result = strategy.compress(messages, {
      ...DEFAULT_OPTS,
      preserveHead: 2,
      preserveTail: 2,
    });
    expect(result.removedCount).toBe(0);
  });

  it('handles empty input', () => {
    const result = strategy.compress([], DEFAULT_OPTS);
    expect(result.messages).toHaveLength(0);
    expect(result.removedCount).toBe(0);
  });
});

// ===========================================================================
// ImportanceStrategy
// ===========================================================================

describe('ImportanceStrategy', () => {
  const strategy = new ImportanceStrategy();

  it('keeps user messages over assistant text', () => {
    const messages: AgentMessage[] = [
      msg('system', 'System prompt'),
      msg('user', 'Question 1'),
      msg('assistant', 'Long reasoning that is not critical '.repeat(10)),
      msg('assistant', 'More reasoning text '.repeat(10)),
      msg('user', 'Question 2'),
      msg('assistant', 'Answer'),
      msg('user', 'Follow up'),
      msg('assistant', 'Final answer'),
    ];

    const result = strategy.compress(messages, {
      targetTokens: 200,
      preserveHead: 1,
      preserveTail: 1,
      preserveToolResults: false,
    });

    const roles = result.messages.map((m) => m.role);
    const userCount = roles.filter((r) => r === 'user').length;
    const assistantCount = roles.filter((r) => r === 'assistant').length;
    // User messages should be prioritised
    expect(userCount).toBeGreaterThanOrEqual(assistantCount);
  });

  it('preserves tool results when they exist', () => {
    const messages: AgentMessage[] = [
      msg('system', 'System prompt'),
      msg('user', 'Search for X'),
      msg('assistant', 'Calling tool', {
        toolCalls: [{ id: 'tc1', name: 'search', arguments: '{}' }],
      }),
      msg('tool', 'Tool result data', { toolCallId: 'tc1' }),
      msg('assistant', 'Low value reasoning '.repeat(20)),
      msg('user', 'Thanks'),
    ];

    const result = strategy.compress(messages, {
      targetTokens: 300,
      preserveHead: 1,
      preserveTail: 1,
      preserveToolResults: false,
    });

    // Tool results have high importance (0.8) — they should be kept
    const hasToolResult = result.messages.some((m) => m.role === 'tool');
    expect(hasToolResult).toBe(true);
  });

  it('handles empty input', () => {
    const result = strategy.compress([], DEFAULT_OPTS);
    expect(result.messages).toHaveLength(0);
  });

  it('returns all messages when within budget', () => {
    const messages = makeMessages(4);
    const result = strategy.compress(messages, {
      ...DEFAULT_OPTS,
      targetTokens: 100_000,
    });
    expect(result.removedCount).toBe(0);
  });
});

// ===========================================================================
// SlidingWindowStrategy
// ===========================================================================

describe('SlidingWindowStrategy', () => {
  const strategy = new SlidingWindowStrategy();

  it('keeps the most recent messages within budget', () => {
    const messages = makeMessages(20);
    const result = strategy.compress(messages, {
      targetTokens: 100,
      preserveHead: 1,
      preserveTail: 0,
      preserveToolResults: false,
    });

    // Should start with the first message (head)
    expect(result.messages[0].content).toBe(messages[0].content);
    // Should end with the most recent messages
    const lastKept = result.messages[result.messages.length - 1];
    expect(lastKept.content).toBe(messages[messages.length - 1].content);
    // Should have fewer messages than original
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it('handles empty input', () => {
    const result = strategy.compress([], DEFAULT_OPTS);
    expect(result.messages).toHaveLength(0);
  });

  it('keeps all messages if they fit in budget', () => {
    const messages = makeMessages(3);
    const result = strategy.compress(messages, {
      targetTokens: 100_000,
      preserveHead: 1,
      preserveTail: 0,
      preserveToolResults: false,
    });
    expect(result.messages).toHaveLength(3);
  });
});

// ===========================================================================
// CompressionEngine
// ===========================================================================

describe('CompressionEngine', () => {
  it('lists built-in strategies', () => {
    const engine = createDefaultCompressionEngine();
    const names = engine.listStrategies();
    expect(names).toContain('head-tail');
    expect(names).toContain('importance');
    expect(names).toContain('sliding-window');
  });

  it('compresses with a named strategy', () => {
    const engine = createDefaultCompressionEngine();
    const messages = makeMessages(10);
    const result = engine.compress(messages, {
      ...DEFAULT_OPTS,
      strategy: 'head-tail',
    });
    expect(result.strategy).toBe('head-tail');
  });

  it('auto-selects sliding-window for ≤10 messages', () => {
    const engine = createDefaultCompressionEngine();
    const result = engine.compress(makeMessages(8), DEFAULT_OPTS);
    expect(result.strategy).toBe('sliding-window');
  });

  it('auto-selects head-tail for 11–50 messages', () => {
    const engine = createDefaultCompressionEngine();
    const result = engine.compress(makeMessages(30), DEFAULT_OPTS);
    expect(result.strategy).toBe('head-tail');
  });

  it('auto-selects importance for >50 messages', () => {
    const engine = createDefaultCompressionEngine();
    const result = engine.compress(makeMessages(60), DEFAULT_OPTS);
    expect(result.strategy).toBe('importance');
  });

  it('throws for unknown strategy', () => {
    const engine = createDefaultCompressionEngine();
    expect(() =>
      engine.compress(makeMessages(5), {
        ...DEFAULT_OPTS,
        strategy: 'nonexistent',
      }),
    ).toThrow('Unknown compression strategy');
  });

  it('compresses within target budget', () => {
    const engine = createDefaultCompressionEngine();
    const messages = makeMessages(40);
    const originalTokens = TokenEstimator.estimateMessages(messages);
    const result = engine.compress(messages, {
      targetTokens: Math.floor(originalTokens / 2),
      preserveHead: 2,
      preserveTail: 2,
      preserveToolResults: false,
    });
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    expect(result.ratio).toBeLessThan(1);
  });

  it('allows adding custom strategies', () => {
    const engine = createDefaultCompressionEngine();
    engine.addStrategy({
      name: 'custom',
      description: 'A custom strategy',
      compress(messages, _options) {
        return {
          messages,
          originalTokens: 0,
          compressedTokens: 0,
          ratio: 1,
          strategy: 'custom',
          removedCount: 0,
        };
      },
    });
    expect(engine.listStrategies()).toContain('custom');
  });
});
