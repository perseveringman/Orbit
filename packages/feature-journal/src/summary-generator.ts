import type {
  ActionLog,
  DayNote,
  JournalSummary,
  JournalSummaryScope,
} from '@orbit/domain';

// ── Request types ──────────────────────────────────────────

export interface SummaryRequest {
  readonly scope: JournalSummaryScope;
  readonly scopeKey: string;
  readonly sourceActionLogs: readonly ActionLog[];
  readonly sourceNotes: readonly DayNote[] | null;
}

// ── Prompt builder interface ───────────────────────────────

export interface SummaryPromptBuilder {
  readonly buildPrompt: (request: SummaryRequest) => string;
}

// ── Prompt builders ────────────────────────────────────────

export function buildDaySummaryPrompt(
  actionLogs: readonly ActionLog[],
  dayNote: DayNote | null,
): string {
  const lines: string[] = [
    'Generate a concise daily journal summary based on the following activity:',
    '',
    `## Activity Log (${actionLogs.length} entries)`,
  ];

  for (const log of actionLogs) {
    lines.push(`- [${log.startedAt}] ${log.title}${log.subtitle ? ` (${log.subtitle})` : ''}`);
  }

  if (dayNote) {
    lines.push('', '## User Journal Entry', dayNote.markdown);
  }

  lines.push(
    '',
    '## Instructions',
    '- Summarize key activities and accomplishments',
    '- Note any patterns or themes',
    '- Keep the summary under 200 words',
    '- Use markdown formatting',
  );

  return lines.join('\n');
}

export function buildWeekSummaryPrompt(
  daySummaries: readonly JournalSummary[],
  weekActionLogs: readonly ActionLog[],
): string {
  const lines: string[] = [
    'Generate a weekly journal summary based on the following daily summaries and activity:',
    '',
    `## Daily Summaries (${daySummaries.length} days)`,
  ];

  for (const summary of daySummaries) {
    lines.push(`### ${summary.scopeKey}`, summary.summaryMarkdown, '');
  }

  lines.push(`## Week Activity (${weekActionLogs.length} total actions)`);

  const majorLogs = weekActionLogs.filter((l) => l.importance === 'major');
  if (majorLogs.length > 0) {
    lines.push('', '### Major Events');
    for (const log of majorLogs) {
      lines.push(`- ${log.title}`);
    }
  }

  lines.push(
    '',
    '## Instructions',
    '- Identify weekly themes and progress',
    '- Highlight accomplishments and blockers',
    '- Keep the summary under 300 words',
    '- Use markdown formatting',
  );

  return lines.join('\n');
}

export function buildMonthSummaryPrompt(
  weekSummaries: readonly JournalSummary[],
): string {
  const lines: string[] = [
    'Generate a monthly journal summary based on the following weekly summaries:',
    '',
    `## Weekly Summaries (${weekSummaries.length} weeks)`,
  ];

  for (const summary of weekSummaries) {
    lines.push(`### ${summary.scopeKey}`, summary.summaryMarkdown, '');
  }

  lines.push(
    '',
    '## Instructions',
    '- Identify monthly trends and progress arcs',
    '- Note significant achievements and shifts',
    '- Keep the summary under 400 words',
    '- Use markdown formatting',
  );

  return lines.join('\n');
}

// ── Factory ────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  _counter += 1;
  return `jsum_${ts}_${_counter.toString(36)}`;
}

export function createJournalSummary(
  request: SummaryRequest,
  generatedMarkdown: string,
): JournalSummary {
  const now = new Date().toISOString();
  return {
    objectType: 'journal_summary',
    id: generateId(),
    scope: request.scope,
    scopeKey: request.scopeKey,
    sourceActionLogIds: request.sourceActionLogs.map((l) => l.id),
    sourceNoteIds: request.sourceNotes?.map((n) => n.id) ?? null,
    summaryMarkdown: generatedMarkdown,
    generatedBy: 'system',
    privacyLevel: 'normal',
    agentAccess: 'summary_only',
    versionNo: 1,
    supersededBy: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Auto-generation guard ──────────────────────────────────

const MAX_SUMMARIES: Readonly<Record<JournalSummaryScope, number>> = {
  day: 1,
  week: 1,
  month: 1,
};

export function shouldAutoGenerate(
  scope: JournalSummaryScope,
  existingCount: number,
): boolean {
  return existingCount < MAX_SUMMARIES[scope];
}
