import { describe, expect, it, beforeEach } from 'vitest';

import {
  createCandidate,
  confirmCandidate,
  rejectCandidate,
  createLearningStore,
  createLearningLoop,
} from '../src/learning/index.js';

import type {
  LearningCandidate,
  LearningStore,
  LearningLoop,
} from '../src/learning/index.js';

// ===========================================================================
// Learning Candidate
// ===========================================================================

describe('LearningCandidate', () => {
  it('createCandidate returns a proposed candidate', () => {
    const c = createCandidate('user_correction', 'ops', 'use pnpm', 'Always use pnpm over npm');
    expect(c.id).toContain('lc_');
    expect(c.source).toBe('user_correction');
    expect(c.domain).toBe('ops');
    expect(c.pattern).toBe('use pnpm');
    expect(c.description).toBe('Always use pnpm over npm');
    expect(c.status).toBe('proposed');
    expect(c.confidence).toBe(0.5);
    expect(c.usageCount).toBe(0);
    expect(c.successCount).toBe(0);
    expect(c.failureCount).toBe(0);
  });

  it('confirmCandidate sets status and boosts confidence', () => {
    const c = createCandidate('explicit_feedback', 'writing', 'tone', 'Use formal tone');
    const confirmed = confirmCandidate(c);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedAt).toBeDefined();
    expect(confirmed.confidence).toBeGreaterThan(c.confidence);
  });

  it('rejectCandidate sets status and zeroes confidence', () => {
    const c = createCandidate('repeated_pattern', 'ops', 'bad pattern', 'Nope');
    const rejected = rejectCandidate(c);
    expect(rejected.status).toBe('rejected');
    expect(rejected.confidence).toBe(0);
  });
});

// ===========================================================================
// Learning Store
// ===========================================================================

describe('LearningStore', () => {
  let store: LearningStore;

  beforeEach(() => {
    store = createLearningStore();
  });

  it('addCandidate and getCandidate', () => {
    const c = createCandidate('success_pattern', 'ops', 'p1', 'desc');
    store.addCandidate(c);
    const retrieved = store.getCandidate(c.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(c.id);
  });

  it('getCandidate returns null for unknown id', () => {
    expect(store.getCandidate('unknown')).toBeNull();
  });

  it('getCandidatesByStatus filters correctly', () => {
    const c1 = createCandidate('user_correction', 'ops', 'p1', 'd1');
    const c2 = confirmCandidate(createCandidate('explicit_feedback', 'ops', 'p2', 'd2'));
    store.addCandidate(c1);
    store.addCandidate(c2);

    expect(store.getCandidatesByStatus('proposed')).toHaveLength(1);
    expect(store.getCandidatesByStatus('confirmed')).toHaveLength(1);
  });

  it('getCandidatesByDomain filters correctly', () => {
    store.addCandidate(createCandidate('user_correction', 'ops', 'p1', 'd1'));
    store.addCandidate(createCandidate('user_correction', 'writing', 'p2', 'd2'));
    store.addCandidate(createCandidate('user_correction', 'ops', 'p3', 'd3'));

    expect(store.getCandidatesByDomain('ops')).toHaveLength(2);
    expect(store.getCandidatesByDomain('writing')).toHaveLength(1);
  });

  it('updateCandidate modifies and returns updated candidate', () => {
    const c = createCandidate('success_pattern', 'ops', 'p', 'd');
    store.addCandidate(c);
    const updated = store.updateCandidate(c.id, { status: 'confirmed' });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('confirmed');
  });

  it('updateCandidate returns null for unknown id', () => {
    expect(store.updateCandidate('nope', { status: 'confirmed' })).toBeNull();
  });

  it('recordUsage increments counts and adjusts confidence', () => {
    const c = createCandidate('success_pattern', 'ops', 'p', 'd');
    store.addCandidate(c);

    store.recordUsage(c.id, true);
    const afterSuccess = store.getCandidate(c.id)!;
    expect(afterSuccess.usageCount).toBe(1);
    expect(afterSuccess.successCount).toBe(1);
    expect(afterSuccess.confidence).toBeGreaterThan(0.5);

    store.recordUsage(c.id, false);
    const afterFailure = store.getCandidate(c.id)!;
    expect(afterFailure.usageCount).toBe(2);
    expect(afterFailure.failureCount).toBe(1);
  });

  it('getGraduated returns only graduated candidates', () => {
    const c = createCandidate('success_pattern', 'ops', 'p', 'd');
    store.addCandidate(c);
    store.updateCandidate(c.id, { status: 'graduated' });

    expect(store.getGraduated()).toHaveLength(1);
    expect(store.getGraduated()[0].status).toBe('graduated');
  });

  it('prune removes old rejected/archived candidates', () => {
    const old = createCandidate('user_correction', 'ops', 'old', 'old pattern');
    store.addCandidate(old);
    store.updateCandidate(old.id, {
      status: 'rejected',
      createdAt: '2020-01-01T00:00:00.000Z',
    });

    const recent = createCandidate('user_correction', 'ops', 'new', 'new pattern');
    store.addCandidate(recent);

    const removed = store.prune('2024-01-01T00:00:00.000Z');
    expect(removed).toBe(1);
    expect(store.getCandidate(old.id)).toBeNull();
    expect(store.getCandidate(recent.id)).not.toBeNull();
  });
});

// ===========================================================================
// Learning Loop
// ===========================================================================

describe('LearningLoop', () => {
  let store: LearningStore;
  let loop: LearningLoop;

  beforeEach(() => {
    store = createLearningStore();
    loop = createLearningLoop(store);
  });

  it('propose creates and stores a candidate', () => {
    const c = loop.propose('user_correction', 'ops', 'use pnpm', 'Prefer pnpm');
    expect(c.status).toBe('proposed');
    expect(store.getCandidate(c.id)).not.toBeNull();
  });

  it('confirm transitions proposed → confirmed', () => {
    const c = loop.propose('explicit_feedback', 'writing', 'formal', 'Use formal tone');
    const confirmed = loop.confirm(c.id);
    expect(confirmed).not.toBeNull();
    expect(confirmed!.status).toBe('confirmed');
  });

  it('confirm returns null for non-proposed candidates', () => {
    const c = loop.propose('user_correction', 'ops', 'p', 'd');
    loop.confirm(c.id);
    // Already confirmed — second confirm should return null
    expect(loop.confirm(c.id)).toBeNull();
  });

  it('reject transitions proposed → rejected', () => {
    const c = loop.propose('user_correction', 'ops', 'bad', 'Bad pattern');
    const rejected = loop.reject(c.id);
    expect(rejected).not.toBeNull();
    expect(rejected!.status).toBe('rejected');
  });

  it('reject also works on confirmed candidates', () => {
    const c = loop.propose('user_correction', 'ops', 'p', 'd');
    loop.confirm(c.id);
    const rejected = loop.reject(c.id);
    expect(rejected).not.toBeNull();
    expect(rejected!.status).toBe('rejected');
  });

  it('graduate transitions confirmed → graduated', () => {
    const c = loop.propose('success_pattern', 'ops', 'p', 'd');
    loop.confirm(c.id);
    const graduated = loop.graduate(c.id);
    expect(graduated).not.toBeNull();
    expect(graduated!.status).toBe('graduated');
    expect(graduated!.graduatedAt).toBeDefined();
  });

  it('graduate returns null for non-confirmed candidates', () => {
    const c = loop.propose('user_correction', 'ops', 'p', 'd');
    expect(loop.graduate(c.id)).toBeNull();
  });

  it('recordOutcome delegates to store and logs audit', () => {
    const c = loop.propose('success_pattern', 'ops', 'p', 'd');
    loop.recordOutcome(c.id, true);
    loop.recordOutcome(c.id, false);

    const updated = store.getCandidate(c.id)!;
    expect(updated.usageCount).toBe(2);
    expect(updated.successCount).toBe(1);
    expect(updated.failureCount).toBe(1);
  });

  it('getActivePatterns returns confirmed and graduated for a domain', () => {
    const c1 = loop.propose('user_correction', 'ops', 'p1', 'd1');
    loop.confirm(c1.id);

    const c2 = loop.propose('success_pattern', 'ops', 'p2', 'd2');
    loop.confirm(c2.id);
    loop.graduate(c2.id);

    const c3 = loop.propose('user_correction', 'writing', 'p3', 'd3');
    loop.confirm(c3.id);

    const opsPatterns = loop.getActivePatterns('ops');
    expect(opsPatterns).toHaveLength(2);

    const writingPatterns = loop.getActivePatterns('writing');
    expect(writingPatterns).toHaveLength(1);
  });

  it('getProposals returns only proposed candidates', () => {
    loop.propose('user_correction', 'ops', 'p1', 'd1');
    const c2 = loop.propose('user_correction', 'ops', 'p2', 'd2');
    loop.confirm(c2.id);

    expect(loop.getProposals()).toHaveLength(1);
  });

  it('getAuditLog records all actions', () => {
    const c = loop.propose('user_correction', 'ops', 'p', 'd');
    loop.confirm(c.id);
    loop.recordOutcome(c.id, true);
    loop.graduate(c.id);

    const log = loop.getAuditLog();
    expect(log.length).toBe(4);
    expect(log.map((e) => e.action)).toEqual(['proposed', 'confirmed', 'used', 'graduated']);
  });
});
