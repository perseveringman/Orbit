import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

import {
  TaskQueue,
  TaskScheduler,
  AGENT_PROFILES,
  getProfile,
  matchProfile,
  profileToAgentConfig,
} from '../src/index';

import type { TaskRecord, TaskHandler, AgentProfile, AgentConfig } from '../src/index';

// ===========================================================================
// TaskQueue
// ===========================================================================

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue(2); // max 2 concurrent
  });

  // ---- submit & getTask ----

  it('submit creates a pending task', () => {
    const handler: TaskHandler = async () => 'done';
    queue.registerHandler('echo', handler);

    const task = queue.submit('echo', 'Echo test');
    expect(task.status).toBe('pending');
    expect(task.name).toBe('echo');
    expect(task.description).toBe('Echo test');
    expect(task.priority).toBe('normal');
    expect(task.progress).toBe(0);

    const found = queue.getTask(task.id);
    expect(found).toBe(task);
  });

  it('submit respects custom priority and metadata', () => {
    const task = queue.submit('job', 'Job', {
      priority: 'critical',
      metadata: { source: 'test' },
    });
    expect(task.priority).toBe('critical');
    expect(task.metadata).toEqual({ source: 'test' });
  });

  // ---- processNext ----

  it('processNext runs a pending task to completion', async () => {
    queue.registerHandler('greet', async () => 'hello');
    queue.submit('greet', 'Greeting');

    const result = await queue.processNext();
    expect(result).toBeDefined();
    expect(result!.status).toBe('completed');
    expect(result!.result).toBe('hello');
    expect(result!.progress).toBe(1);
    expect(result!.completedAt).toBeGreaterThan(0);
  });

  it('processNext marks task failed when handler throws', async () => {
    queue.registerHandler('fail', async () => {
      throw new Error('boom');
    });
    queue.submit('fail', 'Failing task');

    const result = await queue.processNext();
    expect(result!.status).toBe('failed');
    expect(result!.error).toBe('boom');
  });

  it('processNext marks task failed when no handler registered', async () => {
    queue.submit('unknown', 'No handler');

    const result = await queue.processNext();
    expect(result!.status).toBe('failed');
    expect(result!.error).toContain('No handler');
  });

  it('processNext returns undefined when queue is empty', async () => {
    const result = await queue.processNext();
    expect(result).toBeUndefined();
  });

  // ---- priority ordering ----

  it('processNext picks highest priority task first', async () => {
    const order: string[] = [];
    queue.registerHandler('track', async (task) => {
      order.push(task.priority);
      return task.priority;
    });

    queue.submit('track', 'Low', { priority: 'low' });
    queue.submit('track', 'Critical', { priority: 'critical' });
    queue.submit('track', 'High', { priority: 'high' });
    queue.submit('track', 'Normal', { priority: 'normal' });

    await queue.processNext();
    await queue.processNext();
    await queue.processNext();
    await queue.processNext();

    expect(order).toEqual(['critical', 'high', 'normal', 'low']);
  });

  // ---- max concurrent limit ----

  it('respects maxConcurrent limit', async () => {
    let running = 0;
    let maxSeen = 0;

    queue.registerHandler('slow', async (_task, _signal, onProgress) => {
      running++;
      maxSeen = Math.max(maxSeen, running);
      onProgress(0.5);
      await new Promise((r) => setTimeout(r, 50));
      running--;
      return 'done';
    });

    queue.submit('slow', 'A');
    queue.submit('slow', 'B');
    queue.submit('slow', 'C');

    // Start 3 tasks concurrently — only 2 should run at a time
    const p1 = queue.processNext();
    const p2 = queue.processNext();
    const p3 = queue.processNext(); // should return undefined (at limit)

    const r3 = await p3;
    expect(r3).toBeUndefined();

    await p1;
    await p2;
    expect(maxSeen).toBe(2);
  });

  // ---- handler receives abort signal and progress callback ----

  it('handler receives working abort signal on cancel', async () => {
    let signalAborted = false;

    queue.registerHandler('cancellable', async (_task, signal) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          signalAborted = true;
          resolve();
        });
        // Also resolve after timeout to prevent hanging
        setTimeout(resolve, 500);
      });
      return 'done';
    });

    const task = queue.submit('cancellable', 'To be cancelled');
    const processing = queue.processNext();

    // Wait briefly for handler to start
    await new Promise((r) => setTimeout(r, 10));
    queue.cancel(task.id);

    await processing;
    expect(signalAborted).toBe(true);
    expect(task.status).toBe('cancelled');
  });

  it('handler receives working progress callback', async () => {
    queue.registerHandler('progress', async (_task, _signal, onProgress) => {
      onProgress(0.25);
      onProgress(0.5);
      onProgress(0.75);
      return 'done';
    });

    const task = queue.submit('progress', 'Track progress');
    await queue.processNext();

    // After completion, progress is set to 1
    expect(task.progress).toBe(1);
  });

  it('progress callback clamps values to 0-1', async () => {
    let midProgress = 0;

    queue.registerHandler('clamp', async (task, _signal, onProgress) => {
      onProgress(-0.5);
      expect(task.progress).toBe(0);
      onProgress(1.5);
      midProgress = task.progress;
      return 'done';
    });

    queue.submit('clamp', 'Clamped progress');
    await queue.processNext();

    expect(midProgress).toBe(1);
  });

  // ---- cancel ----

  it('cancel a pending task', () => {
    queue.submit('x', 'Task X');
    const task = queue.list()[0]!;

    const result = queue.cancel(task.id);
    expect(result).toBe(true);
    expect(task.status).toBe('cancelled');
  });

  it('cancel returns false for completed task', async () => {
    queue.registerHandler('fast', async () => 'done');
    const task = queue.submit('fast', 'Quick');
    await queue.processNext();

    expect(queue.cancel(task.id)).toBe(false);
  });

  it('cancel returns false for unknown id', () => {
    expect(queue.cancel('nonexistent')).toBe(false);
  });

  // ---- list ----

  it('list returns tasks filtered by status', () => {
    queue.registerHandler('x', async () => 'ok');
    queue.submit('x', 'A');
    queue.submit('x', 'B');

    expect(queue.list({ status: 'pending' })).toHaveLength(2);
    expect(queue.list({ status: 'running' })).toHaveLength(0);
  });

  it('list respects limit', () => {
    queue.submit('x', 'A');
    queue.submit('x', 'B');
    queue.submit('x', 'C');

    expect(queue.list({ limit: 2 })).toHaveLength(2);
  });

  // ---- getStats ----

  it('getStats returns correct counts', async () => {
    queue.registerHandler('ok', async () => 'done');
    queue.registerHandler('fail', async () => {
      throw new Error('err');
    });

    queue.submit('ok', 'A');
    queue.submit('fail', 'B');
    queue.submit('ok', 'C');

    await queue.processNext(); // A → completed
    await queue.processNext(); // B → failed

    const stats = queue.getStats();
    expect(stats.pending).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.running).toBe(0);
  });

  // ---- cleanup ----

  it('cleanup removes completed/failed/cancelled tasks', async () => {
    queue.registerHandler('ok', async () => 'done');
    queue.submit('ok', 'A');
    queue.submit('ok', 'B');
    queue.submit('ok', 'C');

    await queue.processNext(); // A → completed
    queue.cancel(queue.list({ status: 'pending' })[0]!.id); // B or C → cancelled

    const removed = queue.cleanup();
    expect(removed).toBe(2);

    // Only 1 pending task remains
    expect(queue.list()).toHaveLength(1);
    expect(queue.getStats().pending).toBe(1);
  });
});

// ===========================================================================
// Agent Profiles
// ===========================================================================

describe('AgentProfiles', () => {
  it('AGENT_PROFILES contains 7 profiles', () => {
    expect(AGENT_PROFILES).toHaveLength(7);
  });

  it('each profile has required fields', () => {
    for (const p of AGENT_PROFILES) {
      expect(p.name).toBeTruthy();
      expect(p.domain).toBeTruthy();
      expect(p.displayName).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.systemPrompt).toBeTruthy();
      expect(p.model).toBeTruthy();
      expect(typeof p.temperature).toBe('number');
      expect(typeof p.maxIterations).toBe('number');
      expect(Array.isArray(p.allowedTools)).toBe(true);
      expect(Array.isArray(p.blockedTools)).toBe(true);
      expect(Array.isArray(p.specializations)).toBe(true);
    }
  });

  // ---- getProfile ----

  it('getProfile returns profile by name', () => {
    const p = getProfile('planner');
    expect(p).toBeDefined();
    expect(p!.name).toBe('planner');
    expect(p!.domain).toBe('planning');
  });

  it('getProfile returns undefined for unknown name', () => {
    expect(getProfile('nonexistent')).toBeUndefined();
  });

  // ---- matchProfile ----

  it('matchProfile returns planner for "plan a roadmap"', () => {
    const p = matchProfile('plan a roadmap');
    expect(p.name).toBe('planner');
  });

  it('matchProfile returns researcher for "search and investigate"', () => {
    const p = matchProfile('search and investigate');
    expect(p.name).toBe('researcher');
  });

  it('matchProfile returns coder for "debug and fix code"', () => {
    const p = matchProfile('debug and fix code');
    expect(p.name).toBe('coder');
  });

  it('matchProfile returns writer for "write an essay draft"', () => {
    const p = matchProfile('write an essay draft');
    expect(p.name).toBe('writer');
  });

  it('matchProfile returns reviewer for "review and audit"', () => {
    const p = matchProfile('review and audit');
    expect(p.name).toBe('reviewer');
  });

  it('matchProfile returns reader for "summarize and extract"', () => {
    const p = matchProfile('summarize and extract');
    expect(p.name).toBe('reader');
  });

  it('matchProfile falls back to assistant for unrecognized input', () => {
    const p = matchProfile('xyzzy foobar');
    expect(p.name).toBe('assistant');
  });

  it('matchProfile picks profile with most keyword hits', () => {
    // "code debug fix build test" has 5 coder specializations
    const p = matchProfile('code debug fix build test');
    expect(p.name).toBe('coder');
  });

  // ---- profileToAgentConfig ----

  it('profileToAgentConfig converts profile to AgentConfig', () => {
    const profile = getProfile('planner')!;
    const config: AgentConfig = profileToAgentConfig(profile);

    expect(config.name).toBe('planner');
    expect(config.domain).toBe('planning');
    expect(config.systemPrompt).toBe(profile.systemPrompt);
    expect(config.model).toBe('gpt-4o');
    expect(config.maxIterations).toBe(10);
    expect(config.temperature).toBe(0.3);
    expect(config.allowedCapabilities).toEqual(profile.allowedTools);
    expect(config.blockedCapabilities).toEqual(profile.blockedTools);
  });
});

// ===========================================================================
// TaskScheduler
// ===========================================================================

describe('TaskScheduler', () => {
  let queue: TaskQueue;
  let scheduler: TaskScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new TaskQueue();
    scheduler = new TaskScheduler(queue);
  });

  afterEach(() => {
    scheduler.stopAll();
    vi.useRealTimers();
  });

  // ---- scheduleInterval ----

  it('scheduleInterval creates an active scheduled task', () => {
    queue.registerHandler('ping', async () => 'pong');
    const s = scheduler.scheduleInterval('ping', 'Periodic ping', 1000);

    expect(s.taskName).toBe('ping');
    expect(s.intervalMs).toBe(1000);
    expect(s.active).toBe(true);
    expect(s.runCount).toBe(0);
  });

  it('scheduleInterval triggers on tick after interval', () => {
    queue.registerHandler('ping', async () => 'pong');
    scheduler.scheduleInterval('ping', 'Periodic', 1000);

    // Advance time past the interval
    vi.advanceTimersByTime(1001);

    const stats = queue.getStats();
    expect(stats.pending).toBeGreaterThanOrEqual(1);
  });

  it('scheduleInterval respects maxRuns', () => {
    queue.registerHandler('limited', async () => 'ok');
    const s = scheduler.scheduleInterval('limited', 'Limited', 100, 2);

    // Trigger first run
    vi.advanceTimersByTime(101);
    expect(s.runCount).toBeGreaterThanOrEqual(1);

    // Trigger second run
    vi.advanceTimersByTime(101);

    // Trigger potential third — should not happen
    vi.advanceTimersByTime(101);

    expect(s.runCount).toBe(2);
    expect(s.active).toBe(false);
  });

  // ---- scheduleDelay ----

  it('scheduleDelay creates a one-shot task', () => {
    queue.registerHandler('delayed', async () => 'ok');
    const s = scheduler.scheduleDelay('delayed', 'One-shot', 500);

    expect(s.delayMs).toBe(500);
    expect(s.maxRuns).toBe(1);
    expect(s.active).toBe(true);

    vi.advanceTimersByTime(501);

    expect(s.runCount).toBe(1);
    expect(s.active).toBe(false);
  });

  // ---- tick ----

  it('tick returns submitted task IDs', () => {
    queue.registerHandler('tick-test', async () => 'ok');
    const s = scheduler.scheduleInterval('tick-test', 'Test', 100);

    // Not due yet
    let submitted = scheduler.tick();
    expect(submitted).toHaveLength(0);

    // Advance past interval
    vi.advanceTimersByTime(101);
    submitted = scheduler.tick();
    // At least one tick happened (via timer or manual)
    expect(s.runCount).toBeGreaterThanOrEqual(1);
  });

  // ---- cancel ----

  it('cancel stops a scheduled task', () => {
    queue.registerHandler('c', async () => 'ok');
    const s = scheduler.scheduleInterval('c', 'Cancel me', 100);

    expect(scheduler.cancel(s.id)).toBe(true);
    expect(s.active).toBe(false);

    vi.advanceTimersByTime(200);
    expect(s.runCount).toBe(0);
  });

  it('cancel returns false for unknown id', () => {
    expect(scheduler.cancel('nonexistent')).toBe(false);
  });

  // ---- pause / resume ----

  it('pause stops execution, resume restarts it', () => {
    queue.registerHandler('pr', async () => 'ok');
    const s = scheduler.scheduleInterval('pr', 'Pausable', 100);

    // Pause immediately
    expect(scheduler.pause(s.id)).toBe(true);
    expect(s.active).toBe(false);

    // Advance — should not trigger
    vi.advanceTimersByTime(200);
    expect(s.runCount).toBe(0);

    // Resume
    expect(scheduler.resume(s.id)).toBe(true);
    expect(s.active).toBe(true);

    // Advance past interval
    vi.advanceTimersByTime(101);
    expect(s.runCount).toBeGreaterThanOrEqual(1);
  });

  it('pause returns false if already paused', () => {
    queue.registerHandler('x', async () => 'ok');
    const s = scheduler.scheduleInterval('x', 'X', 100);
    scheduler.pause(s.id);
    expect(scheduler.pause(s.id)).toBe(false);
  });

  it('resume returns false if already active', () => {
    queue.registerHandler('x', async () => 'ok');
    const s = scheduler.scheduleInterval('x', 'X', 100);
    expect(scheduler.resume(s.id)).toBe(false);
  });

  // ---- list ----

  it('list returns all scheduled tasks', () => {
    queue.registerHandler('a', async () => 'ok');
    scheduler.scheduleInterval('a', 'A', 100);
    scheduler.scheduleDelay('a', 'B', 200);

    expect(scheduler.list()).toHaveLength(2);
  });

  // ---- stopAll ----

  it('stopAll deactivates all scheduled tasks', () => {
    queue.registerHandler('x', async () => 'ok');
    scheduler.scheduleInterval('x', 'A', 100);
    scheduler.scheduleInterval('x', 'B', 200);

    scheduler.stopAll();

    for (const s of scheduler.list()) {
      expect(s.active).toBe(false);
    }

    vi.advanceTimersByTime(1000);

    // No tasks submitted
    expect(queue.getStats().pending).toBe(0);
  });
});
