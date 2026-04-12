import { describe, it, expect } from 'vitest';
import type { Vision, VisionVersion, IsoDateTimeString } from '@orbit/domain';

import {
  // Onboarding
  createOnboardingSession,
  advanceStep,
  canAdvance,
  completeOnboarding,
  // Vision repository
  createVision,
  createVisionVersion,
  generateSlug,
  // Version chain
  appendVersion,
  getVersionHistory,
  diffVersions,
  // Agent injection
  buildSystemPromptPrinciples,
  buildMemoryContextSummary,
  buildReviewFullText,
  buildAgentVisionContext,
  // Reminder strategy
  shouldRemind,
  generateReminder,
  REMINDER_RULES,
  // Directive service
  createDirectiveFromVision,
  suggestDirective,
  // Privacy boundary
  getEffectivePrivacy,
  filterForSync,
  filterForAgent,
  DEFAULT_POLICY,
} from '../src/index.ts';

// ── Test helpers ───────────────────────────────────────────

const NOW = '2025-06-01T00:00:00.000Z' as IsoDateTimeString;

function makeVision(overrides: Partial<Vision> = {}): Vision {
  return {
    objectType: 'vision',
    id: 'v-1',
    slug: 'my-vision',
    title: 'My Vision',
    currentVersionId: 'vv-1',
    status: 'active',
    reminderMode: 'decision_points',
    scope: 'life',
    ownerUserId: 'user-1',
    sourceFileId: null,
    createdAt: NOW,
    updatedAt: NOW,
    lastReaffirmedAt: null,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<VisionVersion> = {}): VisionVersion {
  return {
    id: 'vv-1',
    visionId: 'v-1',
    versionNo: 1,
    sourceFileId: 'file-1',
    bodyMarkdown: '# My Vision\n\nI want to build great things.',
    summaryForAgent: 'User wants to build great things.',
    changeNote: null,
    authoredBy: 'user',
    createdAt: NOW,
    ...overrides,
  };
}

// ── 1. Onboarding Flow ────────────────────────────────────

describe('onboarding-flow', () => {
  it('creates a session with 6 steps starting at positioning_intro', () => {
    const session = createOnboardingSession();
    expect(session.steps).toHaveLength(6);
    expect(session.currentStepId).toBe('positioning_intro');
    expect(session.completedAt).toBeNull();
    expect(session.steps.every((s) => !s.isComplete)).toBe(true);
  });

  it('canAdvance returns false when step is not complete', () => {
    const session = createOnboardingSession();
    expect(canAdvance(session)).toBe(false);
  });

  it('advanceStep marks current step complete and moves to next', () => {
    const session = createOnboardingSession();
    const advanced = advanceStep(session, { welcomed: true });
    expect(advanced.steps[0].isComplete).toBe(true);
    expect(advanced.steps[0].data).toEqual({ welcomed: true });
    expect(advanced.currentStepId).toBe('vision_writing');
  });

  it('canAdvance returns true after step data is set', () => {
    const session = createOnboardingSession();
    const advanced = advanceStep(session, { welcomed: true });
    expect(canAdvance(advanced)).toBe(false); // new step not yet complete
    const step1Complete = { ...advanced };
    // The new current step (vision_writing) is not yet complete
    expect(canAdvance(step1Complete)).toBe(false);
  });

  it('completeOnboarding returns session with completedAt when all steps done', () => {
    let session = createOnboardingSession();
    for (let i = 0; i < 6; i++) {
      session = advanceStep(session, { step: i });
    }
    expect(session.steps.every((s) => s.isComplete)).toBe(true);
    const completed = completeOnboarding(session);
    expect(completed.completedAt).not.toBeNull();
  });

  it('completeOnboarding does nothing if steps incomplete', () => {
    const session = createOnboardingSession();
    const result = completeOnboarding(session);
    expect(result.completedAt).toBeNull();
  });
});

// ── 2. Vision Repository ──────────────────────────────────

describe('vision-repository', () => {
  it('generateSlug creates kebab-case slug', () => {
    expect(generateSlug('My Life Vision')).toBe('my-life-vision');
  });

  it('generateSlug deduplicates with existing slugs', () => {
    const existing = ['my-vision'];
    expect(generateSlug('My Vision', existing)).toBe('my-vision-2');
  });

  it('generateSlug deduplicates sequentially', () => {
    const existing = ['my-vision', 'my-vision-2'];
    expect(generateSlug('My Vision', existing)).toBe('my-vision-3');
  });

  it('generateSlug handles special characters', () => {
    expect(generateSlug('Hello, World! @#$')).toBe('hello-world');
  });

  it('createVision produces a valid Vision object', () => {
    const vision = createVision({
      id: 'v-1',
      title: 'Career Vision',
      scope: 'career',
      reminderMode: 'review_only',
      ownerUserId: 'user-1',
    });
    expect(vision.objectType).toBe('vision');
    expect(vision.slug).toBe('career-vision');
    expect(vision.status).toBe('active');
    expect(vision.lastReaffirmedAt).toBeNull();
    expect(vision.createdAt).toBeTruthy();
  });

  it('createVision respects existingSlugs', () => {
    const vision = createVision(
      { id: 'v-2', title: 'Career Vision', scope: 'career', reminderMode: 'silent', ownerUserId: 'u' },
      ['career-vision'],
    );
    expect(vision.slug).toBe('career-vision-2');
  });

  it('createVisionVersion produces a valid VisionVersion', () => {
    const vv = createVisionVersion({
      id: 'vv-1',
      visionId: 'v-1',
      versionNo: 1,
      sourceFileId: 'file-1',
      bodyMarkdown: '# My Vision',
      summaryForAgent: 'Summary',
      authoredBy: 'user',
    });
    expect(vv.id).toBe('vv-1');
    expect(vv.versionNo).toBe(1);
    expect(vv.changeNote).toBeNull();
    expect(vv.createdAt).toBeTruthy();
  });
});

// ── 3. Version Chain ──────────────────────────────────────

describe('version-chain', () => {
  it('appendVersion creates version with next versionNo', () => {
    const v1 = makeVersion({ versionNo: 1 });
    const v2 = appendVersion([v1], {
      id: 'vv-2',
      visionId: 'v-1',
      sourceFileId: 'file-2',
      bodyMarkdown: 'Updated body',
      summaryForAgent: 'Updated summary',
      changeNote: 'Refined wording',
      authoredBy: 'user',
    });
    expect(v2.versionNo).toBe(2);
    expect(v2.changeNote).toBe('Refined wording');
  });

  it('appendVersion starts at 1 for empty array', () => {
    const v1 = appendVersion([], {
      id: 'vv-1',
      visionId: 'v-1',
      sourceFileId: 'file-1',
      bodyMarkdown: 'Body',
      summaryForAgent: 'Summary',
      changeNote: null,
      authoredBy: 'user',
    });
    expect(v1.versionNo).toBe(1);
  });

  it('getVersionHistory sorts by versionNo ascending', () => {
    const v3 = makeVersion({ id: 'vv-3', versionNo: 3 });
    const v1 = makeVersion({ id: 'vv-1', versionNo: 1 });
    const v2 = makeVersion({ id: 'vv-2', versionNo: 2 });
    const sorted = getVersionHistory([v3, v1, v2]);
    expect(sorted.map((v) => v.versionNo)).toEqual([1, 2, 3]);
  });

  it('diffVersions computes added, removed, unchanged lines', () => {
    const v1 = makeVersion({ bodyMarkdown: 'line1\nline2\nline3' });
    const v2 = makeVersion({ bodyMarkdown: 'line1\nline2-modified\nline4' });
    const diff = diffVersions(v1, v2);
    expect(diff.unchanged).toContain('line1');
    expect(diff.removed).toContain('line2');
    expect(diff.removed).toContain('line3');
    expect(diff.added).toContain('line2-modified');
    expect(diff.added).toContain('line4');
  });
});

// ── 4. Agent Injection ────────────────────────────────────

describe('agent-injection', () => {
  it('buildSystemPromptPrinciples includes vision title and scope', () => {
    const vision = makeVision();
    const prompt = buildSystemPromptPrinciples(vision);
    expect(prompt).toContain('My Vision');
    expect(prompt).toContain('life');
    expect(prompt).toContain('decision_points');
  });

  it('buildMemoryContextSummary includes version info and summary', () => {
    const vision = makeVision();
    const version = makeVersion();
    const summary = buildMemoryContextSummary(vision, version);
    expect(summary).toContain('My Vision');
    expect(summary).toContain('Version: 1');
    expect(summary).toContain('User wants to build great things.');
  });

  it('buildReviewFullText includes all versions in order', () => {
    const v1 = makeVersion({ versionNo: 1, bodyMarkdown: 'First draft' });
    const v2 = makeVersion({ versionNo: 2, bodyMarkdown: 'Refined draft', changeNote: 'Clarity pass' });
    const fullText = buildReviewFullText([v2, v1]);
    const idx1 = fullText.indexOf('Version 1');
    const idx2 = fullText.indexOf('Version 2');
    expect(idx1).toBeLessThan(idx2);
    expect(fullText).toContain('Clarity pass');
  });

  it('buildAgentVisionContext combines all 3 layers', () => {
    const vision = makeVision();
    const versions = [makeVersion()];
    const ctx = buildAgentVisionContext(vision, versions);
    expect(ctx.systemPromptPrinciples).toContain('My Vision');
    expect(ctx.memoryContextSummary).toContain('User wants to build great things.');
    expect(ctx.reviewFullText).toContain('# Vision — Full Review');
  });

  it('buildAgentVisionContext handles empty versions', () => {
    const vision = makeVision();
    const ctx = buildAgentVisionContext(vision, []);
    expect(ctx.memoryContextSummary).toContain('No versions available');
    expect(ctx.reviewFullText).toContain('No versions available');
  });
});

// ── 5. Reminder Strategy ──────────────────────────────────

describe('reminder-strategy', () => {
  const ctx = { trigger: 'before_choice' as const, timestamp: NOW };

  it('shouldRemind returns true for allowed trigger+mode', () => {
    const vision = makeVision({ reminderMode: 'decision_points' });
    const result = shouldRemind('before_choice', vision, ctx);
    expect(result.shouldRemind).toBe(true);
  });

  it('shouldRemind returns false for silent mode', () => {
    const vision = makeVision({ reminderMode: 'silent' });
    const result = shouldRemind('before_choice', vision, ctx);
    expect(result.shouldRemind).toBe(false);
    expect(result.reason).toContain('silent');
  });

  it('shouldRemind returns false for archived vision', () => {
    const vision = makeVision({ status: 'archived' });
    const result = shouldRemind('before_choice', vision, ctx);
    expect(result.shouldRemind).toBe(false);
    expect(result.reason).toContain('not active');
  });

  it('shouldRemind returns false when trigger not allowed for mode', () => {
    const vision = makeVision({ reminderMode: 'on_request' });
    const result = shouldRemind('before_choice', vision, ctx);
    expect(result.shouldRemind).toBe(false);
  });

  it('on_review is allowed for review_only mode', () => {
    const vision = makeVision({ reminderMode: 'review_only' });
    const result = shouldRemind('on_review', vision, { trigger: 'on_review', timestamp: NOW });
    expect(result.shouldRemind).toBe(true);
  });

  it('on_help is allowed for on_request mode', () => {
    const vision = makeVision({ reminderMode: 'on_request' });
    const result = shouldRemind('on_help', vision, { trigger: 'on_help', timestamp: NOW });
    expect(result.shouldRemind).toBe(true);
  });

  it('generateReminder returns a gentle message', () => {
    const vision = makeVision();
    const msg = generateReminder('before_choice', vision, ctx);
    expect(msg.tone).toBe('gentle');
    expect(msg.trigger).toBe('before_choice');
    expect(msg.body).toContain('My Vision');
  });

  it('REMINDER_RULES has 4 rules', () => {
    expect(REMINDER_RULES).toHaveLength(4);
  });
});

// ── 6. Directive Service ──────────────────────────────────

describe('directive-service', () => {
  it('createDirectiveFromVision creates a draft directive linked to vision', () => {
    const vision = makeVision();
    const directive = createDirectiveFromVision(vision, {
      id: 'd-1',
      title: 'Focus on learning',
      body: 'Dedicate time each week to learning new skills.',
      scope: 'quarter',
      ownerUserId: 'user-1',
    });
    expect(directive.objectType).toBe('directive');
    expect(directive.status).toBe('draft');
    expect(directive.visionId).toBe('v-1');
    expect(directive.decisionMode).toBe('user_written');
    expect(directive.title).toBe('Focus on learning');
  });

  it('createDirectiveFromVision sets null body when not provided', () => {
    const vision = makeVision();
    const directive = createDirectiveFromVision(vision, {
      id: 'd-2',
      title: 'Quick directive',
      body: null,
      scope: null,
      ownerUserId: 'user-1',
    });
    expect(directive.body).toBeNull();
    expect(directive.scope).toBeNull();
  });

  it('suggestDirective returns a suggestion linked to vision', () => {
    const vision = makeVision();
    const suggestion = suggestDirective(vision, {});
    expect(suggestion.visionId).toBe('v-1');
    expect(suggestion.confidence).toBeGreaterThan(0);
    expect(suggestion.confidence).toBeLessThanOrEqual(1);
    expect(suggestion.proposedTitle).toBeTruthy();
    expect(suggestion.reasoning).toBeTruthy();
  });
});

// ── 7. Privacy Boundary ───────────────────────────────────

describe('privacy-boundary', () => {
  const vision = makeVision();
  const version = makeVersion();

  it('getEffectivePrivacy returns defaults when no preference', () => {
    const policy = getEffectivePrivacy(vision, null);
    expect(policy.defaultVisibility).toBe('local_only');
    expect(policy.syncPolicy).toBe('summary_only');
    expect(policy.agentAccessLevel).toBe('summary_only');
  });

  it('getEffectivePrivacy merges user preference', () => {
    const policy = getEffectivePrivacy(vision, { visibility: 'cloud_full', agentAccessLevel: 'full' });
    expect(policy.defaultVisibility).toBe('cloud_full');
    expect(policy.agentAccessLevel).toBe('full');
    expect(policy.syncPolicy).toBe('summary_only'); // default fallback
  });

  it('filterForSync with never policy strips all content', () => {
    const policy = { ...DEFAULT_POLICY, syncPolicy: 'never' as const };
    const result = filterForSync(vision, version, policy);
    expect(result.bodyMarkdown).toBeNull();
    expect(result.summaryForAgent).toBeNull();
    expect(result.title).toBe('My Vision');
  });

  it('filterForSync with summary_only includes summary but not body', () => {
    const result = filterForSync(vision, version, DEFAULT_POLICY);
    expect(result.bodyMarkdown).toBeNull();
    expect(result.summaryForAgent).toBe('User wants to build great things.');
  });

  it('filterForSync with full includes everything', () => {
    const policy = { ...DEFAULT_POLICY, syncPolicy: 'full' as const };
    const result = filterForSync(vision, version, policy);
    expect(result.bodyMarkdown).toContain('My Vision');
    expect(result.summaryForAgent).toBeTruthy();
  });

  it('filterForAgent with none strips all content', () => {
    const policy = { ...DEFAULT_POLICY, agentAccessLevel: 'none' as const };
    const result = filterForAgent(vision, version, policy);
    expect(result.bodyMarkdown).toBeNull();
    expect(result.summaryForAgent).toBeNull();
  });

  it('filterForAgent with summary_only includes summary', () => {
    const result = filterForAgent(vision, version, DEFAULT_POLICY);
    expect(result.bodyMarkdown).toBeNull();
    expect(result.summaryForAgent).toBe('User wants to build great things.');
  });

  it('filterForAgent with full includes everything', () => {
    const policy = { ...DEFAULT_POLICY, agentAccessLevel: 'full' as const };
    const result = filterForAgent(vision, version, policy);
    expect(result.bodyMarkdown).toContain('My Vision');
    expect(result.summaryForAgent).toBeTruthy();
  });

  it('filterForSync handles null version', () => {
    const result = filterForSync(vision, null, DEFAULT_POLICY);
    expect(result.summaryForAgent).toBeNull();
  });
});
