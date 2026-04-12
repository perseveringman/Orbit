import { describe, it, expect } from 'vitest';
import type { OrbitEvent, ActionLog, DayNote, JournalSummary, BehaviorInsight } from '@orbit/domain';

import {
  // 1. Five-Layer Model
  LAYER_CONFIGS,
  getLayerConfig,
  type JournalLayer,
  type JournalDayView,

  // 2. Semantic Events
  SEMANTIC_EVENT_CATALOG,
  createSemanticEvent,
  categorizeEvent,
  type SemanticEventCategory,

  // 3. Privacy Classifier
  PrivacyKeywords,
  classifyPrivacy,
  deriveAgentAccess,
  applyPrivacyOverride,
  canAgentAccess,
  type PrivacyOverride,

  // 4. Action Log Aggregator
  DEFAULT_AGGREGATION_RULES,
  aggregateEvents,
  formatActionLogTitle,

  // 5. Journal Page
  groupByHour,
  buildJournalPage,

  // 6. Day Note Service
  createDayNote,
  updateDayNote,

  // 7. Summary Generator
  buildDaySummaryPrompt,
  buildWeekSummaryPrompt,
  buildMonthSummaryPrompt,
  createJournalSummary,
  shouldAutoGenerate,

  // 8. Behavior Insight Engine
  INSIGHT_PATTERNS,
  createBehaviorInsight,
  isExpired,
  dismissInsight,
  type InsightDetectorInput,

  // 9. Retention Strategy
  RETENTION_POLICIES,
  getRetentionTier,
  getExpiryDate,
  isRetained,
  collectExpiredItems,

  // 10. Privacy Mode
  startProtectedSession,
  endProtectedSession,
  isInProtectedMode,
  requestSealedAccess,
  isSealedAccessValid,
} from '../src/index';

// ── Helpers ────────────────────────────────────────────────

function makeEvent(overrides: Partial<OrbitEvent> = {}): OrbitEvent {
  return {
    objectType: 'event',
    id: `evt_test_${Math.random().toString(36).slice(2)}`,
    streamUid: 'default',
    eventType: 'object.updated',
    actorType: 'user',
    actorId: 'user_1',
    surface: 'app',
    objectUid: 'article:abc',
    relatedUids: null,
    payload: null,
    captureMode: 'explicit',
    privacyLevel: 'normal',
    agentAccess: 'full_local_only',
    retentionClass: 'crumb',
    occurredAt: '2025-01-15T10:00:00Z',
    redactedAt: null,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

function makeActionLog(overrides: Partial<ActionLog> = {}): ActionLog {
  return {
    objectType: 'action_log',
    id: `alog_test_${Math.random().toString(36).slice(2)}`,
    dayKey: '2025-01-15',
    actionKind: 'object.updated',
    primaryObjectUid: 'article:abc',
    relatedUids: null,
    title: 'Updated',
    subtitle: null,
    detail: null,
    sourceEventIds: ['evt_1'],
    importance: 'normal',
    privacyLevel: 'normal',
    agentAccess: 'full_local_only',
    startedAt: '2025-01-15T10:00:00Z',
    endedAt: '2025-01-15T10:05:00Z',
    durationSeconds: 300,
    createdAt: '2025-01-15T10:05:00Z',
    updatedAt: '2025-01-15T10:05:00Z',
    ...overrides,
  };
}

function makeDayNote(overrides: Partial<DayNote> = {}): DayNote {
  return {
    objectType: 'day_note',
    id: 'dnote_test_1',
    dayKey: '2025-01-15',
    noteKind: 'journal',
    markdown: 'Today I worked on the journal system.',
    filePath: null,
    privacyLevel: 'normal',
    agentAccess: 'summary_only',
    reflectsOnUids: null,
    recordingMode: 'normal',
    createdAt: '2025-01-15T22:00:00Z',
    updatedAt: '2025-01-15T22:00:00Z',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<JournalSummary> = {}): JournalSummary {
  return {
    objectType: 'journal_summary',
    id: 'jsum_test_1',
    scope: 'day',
    scopeKey: '2025-01-15',
    sourceActionLogIds: ['alog_1'],
    sourceNoteIds: null,
    summaryMarkdown: '# Day Summary\nGood progress today.',
    generatedBy: 'system',
    privacyLevel: 'normal',
    agentAccess: 'summary_only',
    versionNo: 1,
    supersededBy: null,
    expiresAt: null,
    createdAt: '2025-01-15T23:00:00Z',
    updatedAt: '2025-01-15T23:00:00Z',
    ...overrides,
  };
}

function makeInsight(overrides: Partial<BehaviorInsight> = {}): BehaviorInsight {
  return {
    objectType: 'behavior_insight',
    id: 'ins_test_1',
    insightType: 'focus_pattern',
    scopeStart: '2025-01-01T00:00:00Z',
    scopeEnd: '2025-01-15T00:00:00Z',
    statement: 'You spend 60% of time on reading.',
    evidence: { readRatio: 0.6 },
    confidence: 0.8,
    sampleSize: 50,
    status: 'proposed',
    visibility: 'user_visible',
    createdBy: 'agent',
    expiresAt: '2025-04-15T00:00:00Z',
    dismissedReason: null,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════
// 1. Five-Layer Model
// ════════════════════════════════════════════════════════════

describe('Five-Layer Model', () => {
  it('LAYER_CONFIGS has an entry for each layer', () => {
    const layers: JournalLayer[] = ['event', 'action_log', 'day_note', 'journal_summary', 'behavior_insight'];
    for (const layer of layers) {
      expect(LAYER_CONFIGS[layer]).toBeDefined();
      expect(LAYER_CONFIGS[layer].layer).toBe(layer);
    }
  });

  it('getLayerConfig returns correct config', () => {
    const cfg = getLayerConfig('day_note');
    expect(cfg.layer).toBe('day_note');
    expect(cfg.retentionDays).toBeNull();
    expect(cfg.privacyDefault).toBe('normal');
  });

  it('event layer has 30-day retention', () => {
    expect(getLayerConfig('event').retentionDays).toBe(30);
  });

  it('action_log layer has 15-minute aggregation window', () => {
    expect(getLayerConfig('action_log').aggregationWindow).toBe(15);
  });

  it('behavior_insight defaults to deny agent access', () => {
    expect(getLayerConfig('behavior_insight').agentAccessDefault).toBe('deny');
  });
});

// ════════════════════════════════════════════════════════════
// 2. Semantic Events
// ════════════════════════════════════════════════════════════

describe('Semantic Events', () => {
  it('SEMANTIC_EVENT_CATALOG covers all 7 categories', () => {
    const categories: SemanticEventCategory[] = [
      'object_lifecycle', 'relation_change', 'reading',
      'research', 'writing', 'execution', 'journal',
    ];
    for (const cat of categories) {
      expect(SEMANTIC_EVENT_CATALOG[cat]).toBeDefined();
      expect(SEMANTIC_EVENT_CATALOG[cat].length).toBeGreaterThan(0);
    }
  });

  it('createSemanticEvent produces a valid OrbitEvent', () => {
    const event = createSemanticEvent('reading', 'reading.started', {
      actorType: 'user',
      actorId: 'user_1',
      objectUid: 'article:xyz',
    });

    expect(event.objectType).toBe('event');
    expect(event.eventType).toBe('reading.started');
    expect(event.actorType).toBe('user');
    expect(event.surface).toBe('reader');
    expect(event.objectUid).toBe('article:xyz');
    expect(event.id).toMatch(/^evt_/);
  });

  it('createSemanticEvent accepts payload argument', () => {
    const event = createSemanticEvent('writing', 'writing.published', {
      actorType: 'user',
    }, { wordCount: 1500 });

    expect(event.payload).toEqual({ wordCount: 1500 });
  });

  it('categorizeEvent correctly identifies categories', () => {
    expect(categorizeEvent(makeEvent({ eventType: 'reading.started' }))).toBe('reading');
    expect(categorizeEvent(makeEvent({ eventType: 'task.completed' }))).toBe('execution');
    expect(categorizeEvent(makeEvent({ eventType: 'journal.note_created' }))).toBe('journal');
    expect(categorizeEvent(makeEvent({ eventType: 'object.created' }))).toBe('object_lifecycle');
    expect(categorizeEvent(makeEvent({ eventType: 'research.query_created' }))).toBe('research');
    expect(categorizeEvent(makeEvent({ eventType: 'writing.published' }))).toBe('writing');
    expect(categorizeEvent(makeEvent({ eventType: 'relation.linked' }))).toBe('relation_change');
  });

  it('categorizeEvent defaults to object_lifecycle for unknown types', () => {
    expect(categorizeEvent(makeEvent({ eventType: 'unknown.something' }))).toBe('object_lifecycle');
  });
});

// ════════════════════════════════════════════════════════════
// 3. Privacy Classifier
// ════════════════════════════════════════════════════════════

describe('Privacy Classifier', () => {
  it('classifyPrivacy returns normal for innocuous content', () => {
    expect(classifyPrivacy('Today I read a great article about TypeScript.')).toBe('normal');
  });

  it('classifyPrivacy returns sensitive for sensitive keywords', () => {
    expect(classifyPrivacy('My salary details are confidential.')).toBe('sensitive');
    expect(classifyPrivacy('Doctor therapy session notes.')).toBe('sensitive');
  });

  it('classifyPrivacy returns sealed for sealed keywords', () => {
    expect(classifyPrivacy('This is top secret classified information.')).toBe('sealed');
    expect(classifyPrivacy('Attorney-client privilege applies.')).toBe('sealed');
  });

  it('sealed takes precedence over sensitive', () => {
    expect(classifyPrivacy('My salary is top secret.')).toBe('sealed');
  });

  it('deriveAgentAccess maps privacy levels correctly', () => {
    expect(deriveAgentAccess('normal')).toBe('full_local_only');
    expect(deriveAgentAccess('sensitive')).toBe('summary_only');
    expect(deriveAgentAccess('sealed')).toBe('deny');
  });

  it('applyPrivacyOverride returns auto when no override', () => {
    expect(applyPrivacyOverride('normal', null)).toBe('normal');
  });

  it('applyPrivacyOverride uses override level when provided', () => {
    const override: PrivacyOverride = {
      level: 'sealed',
      reason: 'User requested',
      overriddenBy: 'user_1',
      overriddenAt: '2025-01-15T10:00:00Z',
    };
    expect(applyPrivacyOverride('normal', override)).toBe('sealed');
  });

  it('canAgentAccess denies everything for sealed', () => {
    expect(canAgentAccess('sealed', 'full_local_only', 'read')).toBe(false);
    expect(canAgentAccess('sealed', 'full_local_only', 'summarize')).toBe(false);
    expect(canAgentAccess('sealed', 'full_local_only', 'full')).toBe(false);
  });

  it('canAgentAccess allows only summarize for summary_only', () => {
    expect(canAgentAccess('normal', 'summary_only', 'read')).toBe(false);
    expect(canAgentAccess('normal', 'summary_only', 'summarize')).toBe(true);
    expect(canAgentAccess('normal', 'summary_only', 'full')).toBe(false);
  });

  it('canAgentAccess allows everything for full_local_only + normal', () => {
    expect(canAgentAccess('normal', 'full_local_only', 'read')).toBe(true);
    expect(canAgentAccess('normal', 'full_local_only', 'summarize')).toBe(true);
    expect(canAgentAccess('normal', 'full_local_only', 'full')).toBe(true);
  });

  it('canAgentAccess denies everything for deny', () => {
    expect(canAgentAccess('normal', 'deny', 'read')).toBe(false);
    expect(canAgentAccess('normal', 'deny', 'summarize')).toBe(false);
  });

  it('PrivacyKeywords has sensitive and sealed lists', () => {
    expect(PrivacyKeywords.sensitive.length).toBeGreaterThan(0);
    expect(PrivacyKeywords.sealed.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════
// 4. Action Log Aggregator
// ════════════════════════════════════════════════════════════

describe('Action Log Aggregator', () => {
  it('returns empty array for no events', () => {
    expect(aggregateEvents([])).toEqual([]);
  });

  it('creates one action log per ungrouped event', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'journal.note_created', occurredAt: '2025-01-15T10:00:00Z' }),
      makeEvent({ id: 'e2', eventType: 'research.query_created', occurredAt: '2025-01-15T11:00:00Z' }),
    ];
    const logs = aggregateEvents(events);
    expect(logs.length).toBe(2);
  });

  it('collapses same-type same-object events within time window', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'object.updated', objectUid: 'article:a', occurredAt: '2025-01-15T10:00:00Z' }),
      makeEvent({ id: 'e2', eventType: 'object.updated', objectUid: 'article:a', occurredAt: '2025-01-15T10:05:00Z' }),
      makeEvent({ id: 'e3', eventType: 'object.updated', objectUid: 'article:a', occurredAt: '2025-01-15T10:10:00Z' }),
    ];
    const logs = aggregateEvents(events);
    expect(logs.length).toBe(1);
    expect(logs[0].sourceEventIds).toEqual(['e1', 'e2', 'e3']);
    expect(logs[0].subtitle).toContain('3 events');
  });

  it('does not collapse events beyond time window', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'object.updated', objectUid: 'article:a', occurredAt: '2025-01-15T10:00:00Z' }),
      makeEvent({ id: 'e2', eventType: 'object.updated', objectUid: 'article:a', occurredAt: '2025-01-15T10:30:00Z' }),
    ];
    const logs = aggregateEvents(events);
    expect(logs.length).toBe(2);
  });

  it('does not collapse events with different objectUids', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'object.updated', objectUid: 'article:a', occurredAt: '2025-01-15T10:00:00Z' }),
      makeEvent({ id: 'e2', eventType: 'object.updated', objectUid: 'article:b', occurredAt: '2025-01-15T10:05:00Z' }),
    ];
    const logs = aggregateEvents(events);
    expect(logs.length).toBe(2);
  });

  it('merges payloads for merge strategy', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'object.updated', objectUid: 'a:1', occurredAt: '2025-01-15T10:00:00Z', payload: { field: 'title' } }),
      makeEvent({ id: 'e2', eventType: 'object.updated', objectUid: 'a:1', occurredAt: '2025-01-15T10:05:00Z', payload: { field: 'body' } }),
    ];
    const logs = aggregateEvents(events);
    expect(logs[0].detail).toEqual({ field: 'body' }); // merge = Object.assign, last wins
  });

  it('picks highest importance (major) from events', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'task.completed', objectUid: 'task:1', occurredAt: '2025-01-15T10:00:00Z' }),
    ];
    const logs = aggregateEvents(events);
    expect(logs[0].importance).toBe('major');
  });

  it('uses stricter privacy when events have different levels', () => {
    const events = [
      makeEvent({ id: 'e1', eventType: 'object.updated', objectUid: 'a:1', occurredAt: '2025-01-15T10:00:00Z', privacyLevel: 'normal' }),
      makeEvent({ id: 'e2', eventType: 'object.updated', objectUid: 'a:1', occurredAt: '2025-01-15T10:05:00Z', privacyLevel: 'sensitive' }),
    ];
    const logs = aggregateEvents(events);
    expect(logs[0].privacyLevel).toBe('sensitive');
  });

  it('DEFAULT_AGGREGATION_RULES is non-empty', () => {
    expect(DEFAULT_AGGREGATION_RULES.length).toBeGreaterThan(0);
  });

  it('formatActionLogTitle returns human-readable titles', () => {
    expect(formatActionLogTitle('task.completed')).toBe('Task completed');
    expect(formatActionLogTitle('reading.started', 'My Article')).toBe('Started reading: My Article');
    expect(formatActionLogTitle('unknown.type')).toBe('unknown.type');
  });
});

// ════════════════════════════════════════════════════════════
// 5. Journal Page
// ════════════════════════════════════════════════════════════

describe('Journal Page', () => {
  it('groupByHour groups action logs by hour', () => {
    const logs = [
      makeActionLog({ startedAt: '2025-01-15T09:15:00Z' }),
      makeActionLog({ startedAt: '2025-01-15T09:45:00Z' }),
      makeActionLog({ startedAt: '2025-01-15T14:00:00Z' }),
    ];
    const groups = groupByHour(logs);
    expect(groups.length).toBe(2);
    expect(groups[0].hour).toBe(9);
    expect(groups[0].logs.length).toBe(2);
    expect(groups[1].hour).toBe(14);
    expect(groups[1].logs.length).toBe(1);
  });

  it('groupByHour returns empty array for no logs', () => {
    expect(groupByHour([])).toEqual([]);
  });

  it('groupByHour sorts groups by hour ascending', () => {
    const logs = [
      makeActionLog({ startedAt: '2025-01-15T16:00:00Z' }),
      makeActionLog({ startedAt: '2025-01-15T08:00:00Z' }),
    ];
    const groups = groupByHour(logs);
    expect(groups[0].hour).toBe(8);
    expect(groups[1].hour).toBe(16);
  });

  it('buildJournalPage assembles all regions', () => {
    const note = makeDayNote();
    const logs = [makeActionLog({ importance: 'major' }), makeActionLog()];
    const summary = makeSummary();
    const insights = [makeInsight()];

    const page = buildJournalPage('2025-01-15', note, logs, summary, insights);

    expect(page.dateHeader.dayKey).toBe('2025-01-15');
    expect(page.dateHeader.dayOfWeek).toBe('Wednesday');
    expect(page.dateHeader.notableEventsCount).toBe(1);
    expect(page.dayNote).toBe(note);
    expect(page.timeline.totalCount).toBe(2);
    expect(page.summary).toBe(summary);
    expect(page.insights).toEqual(insights);
  });

  it('buildJournalPage handles null dayNote and summary', () => {
    const page = buildJournalPage('2025-01-15', null, [], null, []);
    expect(page.dayNote).toBeNull();
    expect(page.summary).toBeNull();
    expect(page.timeline.totalCount).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════
// 6. Day Note Service
// ════════════════════════════════════════════════════════════

describe('Day Note Service', () => {
  it('createDayNote creates a valid DayNote', () => {
    const note = createDayNote('2025-01-15', 'A great day of coding.');
    expect(note.objectType).toBe('day_note');
    expect(note.dayKey).toBe('2025-01-15');
    expect(note.noteKind).toBe('journal');
    expect(note.markdown).toBe('A great day of coding.');
    expect(note.privacyLevel).toBe('normal');
    expect(note.recordingMode).toBe('normal');
    expect(note.id).toMatch(/^dnote_/);
  });

  it('createDayNote auto-classifies privacy from content', () => {
    const note = createDayNote('2025-01-15', 'My salary is too low.');
    expect(note.privacyLevel).toBe('sensitive');
    expect(note.agentAccess).toBe('summary_only');
  });

  it('createDayNote accepts explicit privacy level', () => {
    const note = createDayNote('2025-01-15', 'Normal text', 'sealed');
    expect(note.privacyLevel).toBe('sealed');
    expect(note.agentAccess).toBe('deny');
  });

  it('updateDayNote preserves id but updates markdown', () => {
    const original: DayNote = {
      objectType: 'day_note',
      id: 'dnote_orig',
      dayKey: '2025-01-15',
      noteKind: 'journal',
      markdown: 'Original text.',
      filePath: null,
      privacyLevel: 'normal',
      agentAccess: 'full_local_only',
      reflectsOnUids: null,
      recordingMode: 'normal',
      createdAt: '2025-01-15T08:00:00Z',
      updatedAt: '2025-01-15T08:00:00Z',
    };
    const updated = updateDayNote(original, 'Updated text.');
    expect(updated.id).toBe('dnote_orig');
    expect(updated.dayKey).toBe('2025-01-15');
    expect(updated.markdown).toBe('Updated text.');
    expect(updated.updatedAt).not.toBe('2025-01-15T08:00:00Z');
  });

  it('updateDayNote re-classifies privacy', () => {
    const original = createDayNote('2025-01-15', 'Normal text.');
    const updated = updateDayNote(original, 'My medical records are here.');
    expect(updated.privacyLevel).toBe('sensitive');
  });
});

// ════════════════════════════════════════════════════════════
// 7. Summary Generator
// ════════════════════════════════════════════════════════════

describe('Summary Generator', () => {
  it('buildDaySummaryPrompt includes action logs', () => {
    const logs = [makeActionLog({ title: 'Updated article' })];
    const prompt = buildDaySummaryPrompt(logs, null);
    expect(prompt).toContain('Updated article');
    expect(prompt).toContain('Activity Log');
  });

  it('buildDaySummaryPrompt includes day note when provided', () => {
    const note = makeDayNote({ markdown: 'Had a productive day.' });
    const prompt = buildDaySummaryPrompt([], note);
    expect(prompt).toContain('Had a productive day.');
    expect(prompt).toContain('User Journal Entry');
  });

  it('buildWeekSummaryPrompt includes daily summaries', () => {
    const summaries = [makeSummary({ scopeKey: '2025-01-15', summaryMarkdown: 'Good day.' })];
    const prompt = buildWeekSummaryPrompt(summaries, []);
    expect(prompt).toContain('2025-01-15');
    expect(prompt).toContain('Good day.');
  });

  it('buildWeekSummaryPrompt highlights major events', () => {
    const logs = [makeActionLog({ importance: 'major', title: 'Milestone reached' })];
    const prompt = buildWeekSummaryPrompt([], logs);
    expect(prompt).toContain('Milestone reached');
  });

  it('buildMonthSummaryPrompt includes week summaries', () => {
    const weeks = [makeSummary({ scopeKey: 'W03', summaryMarkdown: 'Progress on project.' })];
    const prompt = buildMonthSummaryPrompt(weeks);
    expect(prompt).toContain('W03');
    expect(prompt).toContain('Progress on project.');
  });

  it('createJournalSummary produces valid JournalSummary', () => {
    const request = {
      scope: 'day' as const,
      scopeKey: '2025-01-15',
      sourceActionLogs: [makeActionLog({ id: 'alog_1' })],
      sourceNotes: [makeDayNote({ id: 'dnote_1' })],
    };
    const summary = createJournalSummary(request, '# Summary\nGood day.');
    expect(summary.objectType).toBe('journal_summary');
    expect(summary.scope).toBe('day');
    expect(summary.scopeKey).toBe('2025-01-15');
    expect(summary.sourceActionLogIds).toEqual(['alog_1']);
    expect(summary.sourceNoteIds).toEqual(['dnote_1']);
    expect(summary.summaryMarkdown).toContain('Good day.');
    expect(summary.generatedBy).toBe('system');
    expect(summary.versionNo).toBe(1);
  });

  it('createJournalSummary handles null sourceNotes', () => {
    const request = {
      scope: 'week' as const,
      scopeKey: '2025-W03',
      sourceActionLogs: [],
      sourceNotes: null,
    };
    const summary = createJournalSummary(request, 'Week summary.');
    expect(summary.sourceNoteIds).toBeNull();
  });

  it('shouldAutoGenerate allows first summary', () => {
    expect(shouldAutoGenerate('day', 0)).toBe(true);
    expect(shouldAutoGenerate('week', 0)).toBe(true);
    expect(shouldAutoGenerate('month', 0)).toBe(true);
  });

  it('shouldAutoGenerate blocks duplicate summaries', () => {
    expect(shouldAutoGenerate('day', 1)).toBe(false);
    expect(shouldAutoGenerate('week', 2)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
// 8. Behavior Insight Engine
// ════════════════════════════════════════════════════════════

describe('Behavior Insight Engine', () => {
  it('INSIGHT_PATTERNS covers all 4 behavior types', () => {
    const types = INSIGHT_PATTERNS.map((p) => p.type);
    expect(types).toContain('focus_pattern');
    expect(types).toContain('input_to_output');
    expect(types).toContain('project_drift');
    expect(types).toContain('review_gap');
  });

  it('focus_pattern detector fires for dominant activity', () => {
    const pattern = INSIGHT_PATTERNS.find((p) => p.type === 'focus_pattern')!;
    const input: InsightDetectorInput = {
      actionLogCounts: { 'reading': 80, 'writing': 10, 'task': 10 },
      dayCount: 14,
      readingCount: 80,
      writingCount: 10,
      projectIds: ['p1'],
      reviewCount: 5,
    };
    const result = pattern.detector(input);
    expect(result).not.toBeNull();
    expect(result!.statement).toContain('80%');
  });

  it('focus_pattern detector returns null for insufficient data', () => {
    const pattern = INSIGHT_PATTERNS.find((p) => p.type === 'focus_pattern')!;
    const input: InsightDetectorInput = {
      actionLogCounts: { 'reading': 5 },
      dayCount: 3,
      readingCount: 5,
      writingCount: 2,
      projectIds: ['p1'],
      reviewCount: 1,
    };
    expect(pattern.detector(input)).toBeNull();
  });

  it('input_to_output detector detects heavy reading', () => {
    const pattern = INSIGHT_PATTERNS.find((p) => p.type === 'input_to_output')!;
    const input: InsightDetectorInput = {
      actionLogCounts: {},
      dayCount: 10,
      readingCount: 90,
      writingCount: 10,
      projectIds: [],
      reviewCount: 0,
    };
    const result = pattern.detector(input);
    expect(result).not.toBeNull();
    expect(result!.statement).toContain('reading');
  });

  it('project_drift detector detects scattered activity', () => {
    const pattern = INSIGHT_PATTERNS.find((p) => p.type === 'project_drift')!;
    const input: InsightDetectorInput = {
      actionLogCounts: {},
      dayCount: 20,
      readingCount: 10,
      writingCount: 10,
      projectIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      reviewCount: 5,
    };
    const result = pattern.detector(input);
    expect(result).not.toBeNull();
    expect(result!.statement).toContain('5 projects');
  });

  it('review_gap detector fires when no reviews', () => {
    const pattern = INSIGHT_PATTERNS.find((p) => p.type === 'review_gap')!;
    const input: InsightDetectorInput = {
      actionLogCounts: {},
      dayCount: 10,
      readingCount: 5,
      writingCount: 5,
      projectIds: ['p1'],
      reviewCount: 0,
    };
    const result = pattern.detector(input);
    expect(result).not.toBeNull();
    expect(result!.statement).toContain('No review');
  });

  it('createBehaviorInsight produces valid insight', () => {
    const insight = createBehaviorInsight(
      'focus_pattern',
      'You focus heavily on reading.',
      { readRatio: 0.75 },
      '2025-01-01T00:00:00Z',
      '2025-01-15T00:00:00Z',
      0.8,
    );
    expect(insight.objectType).toBe('behavior_insight');
    expect(insight.insightType).toBe('focus_pattern');
    expect(insight.status).toBe('proposed');
    expect(insight.confidence).toBe(0.8);
    expect(insight.expiresAt).toBeDefined();
  });

  it('isExpired returns false for future expiry', () => {
    const insight = makeInsight({ expiresAt: '2099-01-01T00:00:00Z' });
    expect(isExpired(insight)).toBe(false);
  });

  it('isExpired returns true for past expiry', () => {
    const insight = makeInsight({ expiresAt: '2020-01-01T00:00:00Z' });
    expect(isExpired(insight)).toBe(true);
  });

  it('dismissInsight sets status and reason', () => {
    const insight = makeInsight();
    const dismissed = dismissInsight(insight, 'Not relevant');
    expect(dismissed.status).toBe('dismissed');
    expect(dismissed.dismissedReason).toBe('Not relevant');
    expect(dismissed.id).toBe(insight.id);
  });
});

// ════════════════════════════════════════════════════════════
// 9. Retention Strategy
// ════════════════════════════════════════════════════════════

describe('Retention Strategy', () => {
  it('RETENTION_POLICIES has all 4 tiers', () => {
    expect(RETENTION_POLICIES.core_permanent).toBeDefined();
    expect(RETENTION_POLICIES.crumb_short).toBeDefined();
    expect(RETENTION_POLICIES.insight_medium).toBeDefined();
    expect(RETENTION_POLICIES.tech_log).toBeDefined();
  });

  it('core_permanent has no expiry', () => {
    expect(RETENTION_POLICIES.core_permanent.maxDays).toBeNull();
  });

  it('getRetentionTier classifies objects correctly', () => {
    expect(getRetentionTier('day_note')).toBe('core_permanent');
    expect(getRetentionTier('journal_summary')).toBe('core_permanent');
    expect(getRetentionTier('action_log', 'normal')).toBe('crumb_short');
    expect(getRetentionTier('action_log', 'major')).toBe('core_permanent');
    expect(getRetentionTier('behavior_insight')).toBe('insight_medium');
    expect(getRetentionTier('event')).toBe('tech_log');
  });

  it('getExpiryDate returns null for permanent tier', () => {
    expect(getExpiryDate('core_permanent', '2025-01-15T00:00:00Z')).toBeNull();
  });

  it('getExpiryDate returns date for crumb_short', () => {
    const expiry = getExpiryDate('crumb_short', '2025-01-15T00:00:00Z');
    expect(expiry).not.toBeNull();
    const expiryDate = new Date(expiry!);
    const created = new Date('2025-01-15T00:00:00Z');
    const diffDays = (expiryDate.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(30);
  });

  it('getExpiryDate returns 90 days for insight_medium', () => {
    const expiry = getExpiryDate('insight_medium', '2025-01-15T00:00:00Z');
    expect(expiry).not.toBeNull();
    const diffDays = (new Date(expiry!).getTime() - new Date('2025-01-15T00:00:00Z').getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(90);
  });

  it('isRetained returns true for core items', () => {
    expect(isRetained({ objectType: 'day_note', createdAt: '2020-01-01T00:00:00Z' }, '2025-01-15T00:00:00Z')).toBe(true);
  });

  it('isRetained returns true for pinned insights', () => {
    expect(isRetained({
      objectType: 'behavior_insight',
      createdAt: '2020-01-01T00:00:00Z',
      status: 'pinned',
    }, '2025-01-15T00:00:00Z')).toBe(true);
  });

  it('isRetained returns false for expired events', () => {
    expect(isRetained({
      objectType: 'event',
      createdAt: '2020-01-01T00:00:00Z',
    }, '2025-01-15T00:00:00Z')).toBe(false);
  });

  it('collectExpiredItems filters out retained items', () => {
    const items = [
      { objectType: 'day_note' as const, createdAt: '2020-01-01T00:00:00Z' },
      { objectType: 'event' as const, createdAt: '2020-01-01T00:00:00Z' },
      { objectType: 'event' as const, createdAt: '2025-01-14T00:00:00Z' },
    ];
    const expired = collectExpiredItems(items, '2025-01-15T00:00:00Z');
    expect(expired.length).toBe(1);
    expect(expired[0].objectType).toBe('event');
    expect(expired[0].createdAt).toBe('2020-01-01T00:00:00Z');
  });
});

// ════════════════════════════════════════════════════════════
// 10. Privacy Mode
// ════════════════════════════════════════════════════════════

describe('Privacy Mode', () => {
  it('startProtectedSession creates session with no end', () => {
    const session = startProtectedSession('Doctor appointment');
    expect(session.id).toMatch(/^psess_/);
    expect(session.startedAt).toBeDefined();
    expect(session.endedAt).toBeNull();
    expect(session.reason).toBe('Doctor appointment');
  });

  it('startProtectedSession without reason sets null', () => {
    const session = startProtectedSession();
    expect(session.reason).toBeNull();
  });

  it('endProtectedSession sets endedAt', () => {
    const session = startProtectedSession('Break');
    const ended = endProtectedSession(session);
    expect(ended.id).toBe(session.id);
    expect(ended.endedAt).not.toBeNull();
    expect(ended.reason).toBe('Break');
  });

  it('isInProtectedMode returns true when session is active', () => {
    const active = startProtectedSession();
    expect(isInProtectedMode([active])).toBe(true);
  });

  it('isInProtectedMode returns false when all sessions ended', () => {
    const session = startProtectedSession();
    const ended = endProtectedSession(session);
    expect(isInProtectedMode([ended])).toBe(false);
  });

  it('isInProtectedMode returns false for empty list', () => {
    expect(isInProtectedMode([])).toBe(false);
  });

  it('requestSealedAccess creates time-limited access', () => {
    const access = requestSealedAccess('note:secret_1', 'Need to review');
    expect(access.objectId).toBe('note:secret_1');
    expect(access.reason).toBe('Need to review');
    expect(access.requestedBy).toBe('user');
    expect(new Date(access.expiresAt).getTime()).toBeGreaterThan(new Date(access.grantedAt).getTime());
  });

  it('isSealedAccessValid returns true before expiry', () => {
    const access = requestSealedAccess('note:1', 'test');
    expect(isSealedAccessValid(access, access.grantedAt)).toBe(true);
  });

  it('isSealedAccessValid returns false after expiry', () => {
    const access = requestSealedAccess('note:1', 'test');
    const farFuture = '2099-01-01T00:00:00Z';
    expect(isSealedAccessValid(access, farFuture)).toBe(false);
  });
});
