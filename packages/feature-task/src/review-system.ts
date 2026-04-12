import type { Review, ReviewCycle, IsoDateTimeString, DecisionMode } from '@orbit/domain';
import type { Task } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export interface ReviewTemplate {
  readonly cycle: ReviewCycle;
  readonly requiredSections: readonly string[];
  readonly promptQuestions: readonly string[];
  readonly outputFormat: string;
}

export interface ReviewInput {
  readonly cycle: ReviewCycle;
  readonly completedTasks: readonly Task[];
  readonly blockedTasks: readonly Task[];
  readonly insights: readonly string[];
  readonly period: { readonly start: IsoDateTimeString; readonly end: IsoDateTimeString };
}

export interface ReviewOutput {
  readonly decisions: readonly string[];
  readonly observations: readonly string[];
  readonly nextActions: readonly string[];
  readonly updatedPriorities: readonly string[];
}

// ── Templates ──────────────────────────────────────────────

export const DAY_REVIEW_TEMPLATE: ReviewTemplate = {
  cycle: 'day',
  requiredSections: ['accomplishments', 'blockers', 'tomorrow_plan'],
  promptQuestions: [
    'What did you complete today?',
    'What blocked you?',
    'What is the single most important thing for tomorrow?',
  ],
  outputFormat: 'markdown',
};

export const WEEK_REVIEW_TEMPLATE: ReviewTemplate = {
  cycle: 'week',
  requiredSections: ['wins', 'challenges', 'project_progress', 'next_week_focus'],
  promptQuestions: [
    'What were the biggest wins this week?',
    'What challenges did you face?',
    'Are your projects on track?',
    'What should you focus on next week?',
  ],
  outputFormat: 'markdown',
};

export const PROJECT_REVIEW_TEMPLATE: ReviewTemplate = {
  cycle: 'month',
  requiredSections: ['milestone_status', 'alignment_check', 'scope_adjustment', 'decisions'],
  promptQuestions: [
    'Are milestones on track?',
    'Is the project still aligned with your vision/direction?',
    'Does the scope need adjustment?',
    'What decisions need to be made?',
  ],
  outputFormat: 'markdown',
};

// ── Functions ──────────────────────────────────────────────

export function buildReviewPrompt(template: ReviewTemplate, input: ReviewInput): string {
  const lines: string[] = [];
  lines.push(`# ${template.cycle.charAt(0).toUpperCase() + template.cycle.slice(1)} Review`);
  lines.push(`Period: ${input.period.start} → ${input.period.end}`);
  lines.push('');

  lines.push('## Context');
  lines.push(`- Completed tasks: ${input.completedTasks.length}`);
  lines.push(`- Blocked tasks: ${input.blockedTasks.length}`);
  if (input.insights.length > 0) {
    lines.push(`- Insights: ${input.insights.join('; ')}`);
  }
  lines.push('');

  lines.push('## Questions');
  for (const q of template.promptQuestions) {
    lines.push(`- ${q}`);
  }
  lines.push('');

  lines.push('## Required Sections');
  for (const section of template.requiredSections) {
    lines.push(`### ${section.replace(/_/g, ' ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function createReview(
  cycle: ReviewCycle,
  input: ReviewInput,
  output: ReviewOutput,
): Review {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    objectType: 'review',
    id: `review-${cycle}-${now}`,
    title: `${cycle.charAt(0).toUpperCase() + cycle.slice(1)} Review`,
    body: [
      '## Decisions',
      ...output.decisions.map((d) => `- ${d}`),
      '',
      '## Observations',
      ...output.observations.map((o) => `- ${o}`),
      '',
      '## Next Actions',
      ...output.nextActions.map((a) => `- ${a}`),
      '',
      '## Updated Priorities',
      ...output.updatedPriorities.map((p) => `- ${p}`),
    ].join('\n'),
    cycle,
    status: 'draft',
    timeWindow: { start: input.period.start, end: input.period.end },
    decisionMode: 'agent_suggested' as DecisionMode,
    decisions: output.decisions,
    sourceFileId: null,
    ownerUserId: 'system',
    createdAt: now,
    updatedAt: now,
  };
}

export function isDueForReview(
  lastReviewedAt: IsoDateTimeString | null,
  cycle: ReviewCycle,
): boolean {
  if (lastReviewedAt === null) return true;

  const last = new Date(lastReviewedAt).getTime();
  const now = Date.now();
  const elapsed = now - last;
  const hour = 1000 * 60 * 60;

  const thresholds: Record<ReviewCycle, number> = {
    day: 24 * hour,
    week: 7 * 24 * hour,
    month: 30 * 24 * hour,
    quarter: 90 * 24 * hour,
    year: 365 * 24 * hour,
  };

  return elapsed >= thresholds[cycle];
}
