// ---------------------------------------------------------------------------
// @orbit/agent-core – M11 UX Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProgressTracker,
  PHASE_MESSAGES,
  PHASE_PROGRESS,
  type ProgressPhase,
  type ProgressState,
} from '../src/ux/progress-tracker.js';
import {
  MessageFormatter,
  TOOL_DISPLAY,
  type FormattedMessage,
} from '../src/ux/message-formatter.js';
import { TokenDisplay } from '../src/ux/token-display.js';
import { StreamingAccumulator } from '../src/ux/streaming-accumulator.js';
import type { OrbitAgentEvent } from '../src/events.js';

// ---- Helpers ----

let seqTs = 1000;
function ev<T extends OrbitAgentEvent>(partial: Omit<T, 'runId' | 'timestamp'>): T {
  seqTs += 100;
  return { ...partial, runId: 'r1', timestamp: seqTs } as T;
}

// ==========================================================================
// ProgressTracker
// ==========================================================================

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
    seqTs = 1000;
  });

  it('starts in idle phase', () => {
    const s = tracker.getState();
    expect(s.phase).toBe('idle');
    expect(s.progress).toBe(0);
    expect(s.elapsed).toBe(0);
  });

  it('transitions to thinking on orchestrator:started', () => {
    const s = tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    expect(s.phase).toBe('thinking');
    expect(s.icon).toBe('🧠');
    expect(s.message).toBe('正在思考...');
    expect(s.progress).toBeCloseTo(0.1);
  });

  it('transitions to planning on orchestrator:routed', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    const s = tracker.processEvent(ev({ type: 'orchestrator:routed', domain: 'code', reason: 'test' }));
    expect(s.phase).toBe('planning');
    expect(s.detail).toBe('code');
  });

  it('transitions to executing on agent:tool-call', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    const s = tracker.processEvent(ev({ type: 'agent:tool-call', toolName: 'file_read', args: {}, toolCallId: 'tc1' }));
    expect(s.phase).toBe('executing');
    expect(s.toolName).toBe('file_read');
  });

  it('transitions to responding on agent:stream-delta', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    const s = tracker.processEvent(ev({ type: 'agent:stream-delta', delta: 'hello' }));
    expect(s.phase).toBe('responding');
  });

  it('updates iteration info on agent:iteration', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    tracker.processEvent(ev({ type: 'agent:tool-call', toolName: 'shell_exec', args: {}, toolCallId: 'tc1' }));
    const s = tracker.processEvent(
      ev({ type: 'agent:iteration', iteration: 3, maxIterations: 10, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }),
    );
    expect(s.iterationInfo).toEqual({ current: 3, max: 10 });
  });

  it('refines progress based on iteration during executing phase', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    tracker.processEvent(ev({ type: 'agent:tool-call', toolName: 'shell_exec', args: {}, toolCallId: 'tc1' }));
    tracker.processEvent(
      ev({ type: 'agent:iteration', iteration: 5, maxIterations: 10, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }),
    );
    const s = tracker.getState();
    // executing phase: 0.4 + (5/10)*0.3 = 0.55
    expect(s.progress).toBeCloseTo(0.55);
  });

  it('transitions to done on orchestrator:completed', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    const s = tracker.processEvent(ev({ type: 'orchestrator:completed', sessionId: 's1', totalTokens: 100, totalDurationMs: 500 }));
    expect(s.phase).toBe('done');
    expect(s.progress).toBe(1);
  });

  it('transitions to error on orchestrator:error', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    const s = tracker.processEvent(ev({ type: 'orchestrator:error', error: 'boom' }));
    expect(s.phase).toBe('error');
    expect(s.detail).toBe('boom');
  });

  it('transitions to error on agent:error', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    const s = tracker.processEvent(ev({ type: 'agent:error', domain: 'code', error: 'fail' }));
    expect(s.phase).toBe('error');
    expect(s.icon).toBe('❌');
  });

  it('computes elapsed time', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    const s = tracker.processEvent(ev({ type: 'agent:stream-delta', delta: 'hi' }));
    expect(s.elapsed).toBe(100); // two events, 100ms apart
  });

  it('supports listener subscribe/unsubscribe', () => {
    const states: ProgressState[] = [];
    const unsub = tracker.onUpdate((s) => states.push(s));

    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    expect(states).toHaveLength(1);

    unsub();
    tracker.processEvent(ev({ type: 'agent:stream-delta', delta: 'x' }));
    expect(states).toHaveLength(1); // no more updates
  });

  it('reset returns to idle', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    tracker.reset();
    const s = tracker.getState();
    expect(s.phase).toBe('idle');
    expect(s.elapsed).toBe(0);
  });

  it('PHASE_MESSAGES covers all phases', () => {
    const phases: ProgressPhase[] = ['idle', 'thinking', 'planning', 'executing', 'reviewing', 'responding', 'done', 'error'];
    for (const p of phases) {
      expect(PHASE_MESSAGES[p]).toBeDefined();
      expect(PHASE_MESSAGES[p].message.length).toBeGreaterThan(0);
      expect(PHASE_MESSAGES[p].icon.length).toBeGreaterThan(0);
    }
  });

  it('PHASE_PROGRESS covers all phases with valid values', () => {
    const phases: ProgressPhase[] = ['idle', 'thinking', 'planning', 'executing', 'reviewing', 'responding', 'done', 'error'];
    for (const p of phases) {
      expect(typeof PHASE_PROGRESS[p]).toBe('number');
      expect(PHASE_PROGRESS[p]).toBeGreaterThanOrEqual(0);
      expect(PHASE_PROGRESS[p]).toBeLessThanOrEqual(1);
    }
  });

  it('transitions to reviewing on agent:tool-result', () => {
    tracker.processEvent(ev({ type: 'orchestrator:started', sessionId: 's1', surface: 'cli' }));
    tracker.processEvent(ev({ type: 'agent:tool-call', toolName: 'file_read', args: {}, toolCallId: 'tc1' }));
    const s = tracker.processEvent(
      ev({ type: 'agent:tool-result', toolName: 'file_read', toolCallId: 'tc1', success: true, result: 'ok', durationMs: 50 }),
    );
    expect(s.phase).toBe('reviewing');
  });
});

// ==========================================================================
// MessageFormatter
// ==========================================================================

describe('MessageFormatter', () => {
  let fmt: MessageFormatter;

  beforeEach(() => {
    fmt = new MessageFormatter();
  });

  describe('formatAssistantMessage', () => {
    it('returns text for plain content', () => {
      const msgs = fmt.formatAssistantMessage('Hello world');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].type).toBe('text');
      expect(msgs[0].content).toBe('Hello world');
    });

    it('returns empty array for empty content', () => {
      expect(fmt.formatAssistantMessage('')).toHaveLength(0);
    });

    it('extracts code blocks', () => {
      const content = 'Before\n```typescript\nconst x = 1;\n```\nAfter';
      const msgs = fmt.formatAssistantMessage(content);
      expect(msgs).toHaveLength(3);
      expect(msgs[0].type).toBe('text');
      expect(msgs[0].content).toBe('Before');
      expect(msgs[1].type).toBe('code');
      expect(msgs[1].language).toBe('typescript');
      expect(msgs[1].content).toBe('const x = 1;\n');
      expect(msgs[2].type).toBe('text');
      expect(msgs[2].content).toBe('After');
    });

    it('handles multiple code blocks', () => {
      const content = '```js\na()\n```\ntext\n```py\nb()\n```';
      const msgs = fmt.formatAssistantMessage(content);
      expect(msgs).toHaveLength(3);
      expect(msgs[0].type).toBe('code');
      expect(msgs[0].language).toBe('js');
      expect(msgs[1].type).toBe('text');
      expect(msgs[2].type).toBe('code');
      expect(msgs[2].language).toBe('py');
    });

    it('handles code block without language', () => {
      const content = '```\nhello\n```';
      const msgs = fmt.formatAssistantMessage(content);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].type).toBe('code');
      expect(msgs[0].language).toBeUndefined();
    });
  });

  describe('formatToolResult', () => {
    it('formats success result', () => {
      const msg = fmt.formatToolResult('file_read', '/path/to/file', true, 42);
      expect(msg.type).toBe('tool-result');
      expect(msg.content).toContain('📄');
      expect(msg.content).toContain('读取文件');
      expect(msg.content).toContain('✅');
      expect(msg.content).toContain('42ms');
      expect(msg.metadata?.success).toBe(true);
    });

    it('formats failure result', () => {
      const msg = fmt.formatToolResult('shell_exec', 'err', false, 1500);
      expect(msg.content).toContain('❌');
      expect(msg.content).toContain('1.5s');
    });

    it('uses fallback icon for unknown tools', () => {
      const msg = fmt.formatToolResult('unknown_tool', 'res', true, 10);
      expect(msg.content).toContain('🔧');
    });

    it('handles empty result', () => {
      const msg = fmt.formatToolResult('file_read', '', true, 5);
      expect(msg.type).toBe('tool-result');
      expect(msg.content).not.toContain('\n');
    });
  });

  describe('formatError', () => {
    it('formats error with category and suggestion', () => {
      const msg = fmt.formatError('Something broke', '网络', '请检查连接');
      expect(msg.type).toBe('error');
      expect(msg.content).toContain('[网络]');
      expect(msg.content).toContain('Something broke');
      expect(msg.content).toContain('建议');
      expect(msg.content).toContain('请检查连接');
    });

    it('formats error without extras', () => {
      const msg = fmt.formatError('plain error');
      expect(msg.content).toBe('plain error');
    });
  });

  describe('formatSystem', () => {
    it('prefixes with info icon', () => {
      const msg = fmt.formatSystem('系统消息');
      expect(msg.type).toBe('system');
      expect(msg.content).toContain('ℹ️');
      expect(msg.content).toContain('系统消息');
    });
  });

  describe('formatProgress', () => {
    it('includes icon, message, detail, and percentage', () => {
      const state: ProgressState = {
        phase: 'executing',
        message: '正在执行工具...',
        detail: 'file_read',
        icon: '⚡',
        progress: 0.5,
        elapsed: 2000,
        toolName: 'file_read',
        iterationInfo: { current: 2, max: 5 },
      };
      const msg = fmt.formatProgress(state);
      expect(msg.type).toBe('progress');
      expect(msg.content).toContain('⚡');
      expect(msg.content).toContain('file_read');
      expect(msg.content).toContain('2/5');
      expect(msg.content).toContain('50%');
    });
  });
});

describe('TOOL_DISPLAY', () => {
  it('has entries for all built-in tools', () => {
    const expectedTools = [
      'shell_exec', 'file_read', 'file_write', 'file_list', 'file_search',
      'grep', 'web_fetch', 'web_search', 'ask_user', 'datetime',
      'calculate', 'json_parse', 'text_transform',
    ];
    for (const tool of expectedTools) {
      const entry = TOOL_DISPLAY[tool];
      expect(entry).toBeDefined();
      expect(entry.icon.length).toBeGreaterThan(0);
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.category.length).toBeGreaterThan(0);
    }
  });
});

// ==========================================================================
// TokenDisplay
// ==========================================================================

describe('TokenDisplay', () => {
  describe('formatTokens', () => {
    it('formats small numbers as-is', () => {
      expect(TokenDisplay.formatTokens(0)).toBe('0');
      expect(TokenDisplay.formatTokens(42)).toBe('42');
      expect(TokenDisplay.formatTokens(999)).toBe('999');
    });

    it('formats thousands with k suffix', () => {
      expect(TokenDisplay.formatTokens(1000)).toBe('1k');
      expect(TokenDisplay.formatTokens(1234)).toBe('1.2k');
      expect(TokenDisplay.formatTokens(10_500)).toBe('10.5k');
      expect(TokenDisplay.formatTokens(100_000)).toBe('100k');
    });

    it('formats millions with M suffix', () => {
      expect(TokenDisplay.formatTokens(1_000_000)).toBe('1M');
      expect(TokenDisplay.formatTokens(2_500_000)).toBe('2.5M');
    });

    it('handles negative numbers', () => {
      expect(TokenDisplay.formatTokens(-5)).toBe('0');
    });
  });

  describe('formatCost', () => {
    it('formats zero cost', () => {
      expect(TokenDisplay.formatCost(0)).toBe('$0.00');
    });

    it('formats small costs with 4 decimal places', () => {
      expect(TokenDisplay.formatCost(0.0034)).toBe('$0.0034');
    });

    it('formats medium costs with 3 decimal places', () => {
      expect(TokenDisplay.formatCost(0.125)).toBe('$0.125');
    });

    it('formats large costs with 2 decimal places', () => {
      expect(TokenDisplay.formatCost(5.67)).toBe('$5.67');
    });
  });

  describe('contextBar', () => {
    it('shows empty bar for zero usage', () => {
      expect(TokenDisplay.contextBar(0, 128000)).toBe('░░░░░░░░░░');
    });

    it('shows full bar at max usage', () => {
      expect(TokenDisplay.contextBar(128000, 128000)).toBe('██████████');
    });

    it('shows partial bar', () => {
      const bar = TokenDisplay.contextBar(64000, 128000);
      expect(bar).toBe('█████░░░░░');
      expect(bar.length).toBe(10);
    });

    it('supports custom width', () => {
      const bar = TokenDisplay.contextBar(50, 100, 5);
      expect(bar).toBe('███░░');
      expect(bar.length).toBe(5);
    });

    it('handles zero max', () => {
      expect(TokenDisplay.contextBar(100, 0)).toBe('░░░░░░░░░░');
    });

    it('clamps at 100%', () => {
      const bar = TokenDisplay.contextBar(200000, 128000);
      expect(bar).toBe('██████████');
    });
  });

  describe('getDisplayInfo', () => {
    it('computes display info with known model', () => {
      const info = TokenDisplay.getDisplayInfo(
        { promptTokens: 1500, completionTokens: 800, totalTokens: 2300 },
        'gpt-4o',
      );
      expect(info.promptTokens).toBe('1.5k');
      expect(info.completionTokens).toBe('800');
      expect(info.totalTokens).toBe('2.3k');
      expect(info.estimatedCost).toMatch(/^\$/);
      expect(info.contextUsage).toBeGreaterThan(0);
      expect(info.contextBar.length).toBe(10);
    });

    it('handles unknown model', () => {
      const info = TokenDisplay.getDisplayInfo(
        { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        'unknown-model',
      );
      expect(info.estimatedCost).toBe('$0.00');
      expect(info.contextUsage).toBe(0);
    });

    it('handles no model', () => {
      const info = TokenDisplay.getDisplayInfo(
        { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      );
      expect(info.estimatedCost).toBe('$0.00');
    });
  });
});

// ==========================================================================
// StreamingAccumulator
// ==========================================================================

describe('StreamingAccumulator', () => {
  let acc: StreamingAccumulator;

  beforeEach(() => {
    acc = new StreamingAccumulator();
    seqTs = 1000;
  });

  it('starts empty', () => {
    const s = acc.getState();
    expect(s.content).toBe('');
    expect(s.isStreaming).toBe(false);
    expect(s.toolCalls.size).toBe(0);
  });

  it('accumulates text deltas', () => {
    acc.processEvent(ev({ type: 'agent:stream-delta', delta: 'Hello' }));
    acc.processEvent(ev({ type: 'agent:stream-delta', delta: ' World' }));
    expect(acc.getContent()).toBe('Hello World');
    expect(acc.getState().isStreaming).toBe(true);
  });

  it('tracks tool calls', () => {
    acc.processEvent(ev({ type: 'agent:tool-call', toolName: 'file_read', args: { path: '/a' }, toolCallId: 'tc1' }));
    const s = acc.getState();
    expect(s.toolCalls.size).toBe(1);
    const tc = s.toolCalls.get('tc1');
    expect(tc?.name).toBe('file_read');
    expect(tc?.complete).toBe(false);
  });

  it('marks tool calls complete on result', () => {
    acc.processEvent(ev({ type: 'agent:tool-call', toolName: 'file_read', args: {}, toolCallId: 'tc1' }));
    expect(acc.hasActiveToolCalls()).toBe(true);

    acc.processEvent(ev({ type: 'agent:tool-result', toolName: 'file_read', toolCallId: 'tc1', success: true, result: 'ok', durationMs: 10 }));
    expect(acc.hasActiveToolCalls()).toBe(false);
    expect(acc.getState().toolCalls.get('tc1')?.complete).toBe(true);
  });

  it('stops streaming on agent:completed', () => {
    acc.processEvent(ev({ type: 'agent:stream-delta', delta: 'hi' }));
    expect(acc.getState().isStreaming).toBe(true);
    acc.processEvent(ev({ type: 'agent:completed', domain: 'code', responseContent: 'hi', totalTokens: 10, totalDurationMs: 100 }));
    expect(acc.getState().isStreaming).toBe(false);
  });

  it('stops streaming on error', () => {
    acc.processEvent(ev({ type: 'agent:stream-delta', delta: 'x' }));
    acc.processEvent(ev({ type: 'agent:error', domain: 'code', error: 'boom' }));
    expect(acc.getState().isStreaming).toBe(false);
  });

  it('resets state', () => {
    acc.processEvent(ev({ type: 'agent:stream-delta', delta: 'x' }));
    acc.processEvent(ev({ type: 'agent:tool-call', toolName: 'grep', args: {}, toolCallId: 'tc1' }));
    acc.reset();
    expect(acc.getContent()).toBe('');
    expect(acc.getState().toolCalls.size).toBe(0);
    expect(acc.getState().isStreaming).toBe(false);
    expect(acc.getState().lastUpdate).toBe(0);
  });

  it('hasActiveToolCalls returns false with no tool calls', () => {
    expect(acc.hasActiveToolCalls()).toBe(false);
  });

  it('handles multiple concurrent tool calls', () => {
    acc.processEvent(ev({ type: 'agent:tool-call', toolName: 'file_read', args: {}, toolCallId: 'tc1' }));
    acc.processEvent(ev({ type: 'agent:tool-call', toolName: 'grep', args: {}, toolCallId: 'tc2' }));
    expect(acc.hasActiveToolCalls()).toBe(true);

    acc.processEvent(ev({ type: 'agent:tool-result', toolName: 'file_read', toolCallId: 'tc1', success: true, result: '', durationMs: 5 }));
    expect(acc.hasActiveToolCalls()).toBe(true); // tc2 still active

    acc.processEvent(ev({ type: 'agent:tool-result', toolName: 'grep', toolCallId: 'tc2', success: true, result: '', durationMs: 5 }));
    expect(acc.hasActiveToolCalls()).toBe(false);
  });

  it('updates lastUpdate timestamp', () => {
    const s = acc.processEvent(ev({ type: 'agent:stream-delta', delta: 'x' }));
    expect(s.lastUpdate).toBeGreaterThan(0);
  });
});
