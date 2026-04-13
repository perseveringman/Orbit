// ---------------------------------------------------------------------------
// @orbit/agent-core – Journal Domain Tools
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { BuiltinTool, ToolCategory, ToolOutput } from './types.js';
import type { Toolset } from './toolset-registry.js';

// ── Local types ────────────────────────────────────────────

type SemanticEventCategory =
  | 'object_lifecycle'
  | 'relation_change'
  | 'reading'
  | 'research'
  | 'writing'
  | 'execution'
  | 'journal';

type JournalSummaryScope = 'day' | 'week' | 'month';

type PrivacyLevel = 'normal' | 'sensitive' | 'sealed';

type AgentAccess = 'full_local_only' | 'summary_only' | 'deny';

type ActorType = 'user' | 'agent' | 'system';

// ── Privacy keywords (from feature-journal/privacy-classifier.ts) ──

const SENSITIVE_KEYWORDS: readonly string[] = [
  'password', 'secret', 'private', 'confidential', 'personal',
  'salary', 'medical', 'health', 'diagnosis', 'therapy',
  'ssn', 'social security', 'credit card', 'bank account', 'financial',
];

const SEALED_KEYWORDS: readonly string[] = [
  'sealed', 'top secret', 'classified', 'restricted access', 'eyes only',
  'attorney-client', 'legally privileged', 'nda', 'non-disclosure',
];

function classifyPrivacy(content: string): PrivacyLevel {
  const lower = content.toLowerCase();
  for (const keyword of SEALED_KEYWORDS) {
    if (lower.includes(keyword)) return 'sealed';
  }
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lower.includes(keyword)) return 'sensitive';
  }
  return 'normal';
}

function deriveAgentAccess(privacyLevel: PrivacyLevel): AgentAccess {
  switch (privacyLevel) {
    case 'sealed': return 'deny';
    case 'sensitive': return 'summary_only';
    case 'normal': return 'full_local_only';
  }
}

// ── Category → surface mapping ─────────────────────────────

type EventSurface = 'app' | 'reader' | 'research' | 'writing' | 'task' | 'journal';

const CATEGORY_TO_SURFACE: Readonly<Record<SemanticEventCategory, EventSurface>> = {
  object_lifecycle: 'app',
  relation_change: 'app',
  reading: 'reader',
  research: 'research',
  writing: 'writing',
  execution: 'task',
  journal: 'journal',
};

// ── Insight patterns (from feature-journal/behavior-insight-engine.ts) ──

interface InsightDetectorInput {
  readonly actionLogCounts: Readonly<Record<string, number>>;
  readonly dayCount: number;
  readonly readingCount: number;
  readonly writingCount: number;
  readonly projectIds: readonly string[];
  readonly reviewCount: number;
}

interface InsightDetectorResult {
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly confidence: number;
}

type InsightType = 'focus_pattern' | 'input_to_output' | 'project_drift' | 'review_gap';

function detectFocusPattern(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 7) return null;
  const kinds = Object.keys(data.actionLogCounts);
  if (kinds.length === 0) return null;
  const sorted = kinds.sort((a, b) => data.actionLogCounts[b] - data.actionLogCounts[a]);
  const topKind = sorted[0];
  const topCount = data.actionLogCounts[topKind];
  const total = Object.values(data.actionLogCounts).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const ratio = topCount / total;
  if (ratio < 0.4) return null;
  return {
    statement: `You spend ${Math.round(ratio * 100)}% of your activity on "${topKind}" tasks.`,
    evidence: { topKind, topCount, total, ratio },
    confidence: Math.min(ratio, 0.95),
  };
}

function detectInputToOutput(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 7) return null;
  if (data.readingCount === 0 && data.writingCount === 0) return null;
  const total = data.readingCount + data.writingCount;
  const readRatio = data.readingCount / total;
  if (readRatio > 0.8) {
    return {
      statement: `Your input-to-output ratio is heavily skewed toward reading (${data.readingCount} reads vs ${data.writingCount} writes).`,
      evidence: { readingCount: data.readingCount, writingCount: data.writingCount, readRatio },
      confidence: 0.7,
    };
  }
  if (readRatio < 0.2) {
    return {
      statement: `You are producing more than consuming — ${data.writingCount} writes vs ${data.readingCount} reads.`,
      evidence: { readingCount: data.readingCount, writingCount: data.writingCount, readRatio },
      confidence: 0.7,
    };
  }
  return null;
}

function detectProjectDrift(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 14) return null;
  if (data.projectIds.length <= 3) return null;
  return {
    statement: `Activity is scattered across ${data.projectIds.length} projects in the last ${data.dayCount} days.`,
    evidence: { projectCount: data.projectIds.length, dayCount: data.dayCount },
    confidence: 0.6,
  };
}

function detectReviewGap(data: InsightDetectorInput): InsightDetectorResult | null {
  if (data.dayCount < 7) return null;
  if (data.reviewCount > 0) return null;
  return {
    statement: `No review activity detected in the last ${data.dayCount} days.`,
    evidence: { reviewCount: data.reviewCount, dayCount: data.dayCount },
    confidence: 0.5,
  };
}

const INSIGHT_DETECTORS: readonly { type: InsightType; detector: (d: InsightDetectorInput) => InsightDetectorResult | null }[] = [
  { type: 'focus_pattern', detector: detectFocusPattern },
  { type: 'input_to_output', detector: detectInputToOutput },
  { type: 'project_drift', detector: detectProjectDrift },
  { type: 'review_gap', detector: detectReviewGap },
];

// ── In-memory store ────────────────────────────────────────

export class JournalDomainStore {
  private readonly events = new Map<string, Record<string, unknown>>();
  private readonly dayNotes = new Map<string, Record<string, unknown>>();
  private readonly summaries = new Map<string, Record<string, unknown>>();

  // ---- Events ----

  addEvent(event: Record<string, unknown>): Record<string, unknown> {
    const id = event.id as string;
    this.events.set(id, event);
    return event;
  }

  listEvents(filters?: { startDate?: string; endDate?: string }): readonly Record<string, unknown>[] {
    let all = [...this.events.values()];
    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      all = all.filter((e) => new Date(e.occurredAt as string).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate).getTime();
      all = all.filter((e) => new Date(e.occurredAt as string).getTime() <= end);
    }
    return all;
  }

  // ---- Day Notes ----

  setDayNote(dayKey: string, note: Record<string, unknown>): void {
    this.dayNotes.set(dayKey, note);
  }

  getDayNote(dayKey: string): Record<string, unknown> | undefined {
    return this.dayNotes.get(dayKey);
  }

  listDayNotes(startDate?: string, endDate?: string): readonly Record<string, unknown>[] {
    let all = [...this.dayNotes.values()];
    if (startDate) all = all.filter((n) => (n.dayKey as string) >= startDate);
    if (endDate) all = all.filter((n) => (n.dayKey as string) <= endDate);
    return all;
  }

  // ---- Summaries ----

  addSummary(summary: Record<string, unknown>): void {
    this.summaries.set(summary.id as string, summary);
  }

  listSummaries(): readonly Record<string, unknown>[] {
    return [...this.summaries.values()];
  }
}

// Singleton store
const store = new JournalDomainStore();

// ── Helpers ────────────────────────────────────────────────

function ok(data: unknown): ToolOutput {
  return { success: true, output: JSON.stringify(data) };
}

function fail(error: string): ToolOutput {
  return { success: false, output: JSON.stringify({ error }) };
}

// ── Tools ──────────────────────────────────────────────────

const CATEGORY: ToolCategory = 'journal';

export const journalLogEventTool: BuiltinTool = {
  name: 'journal.logEvent',
  description: 'Log a semantic event (object lifecycle, reading, writing, execution, etc.)',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Event category', enum: ['object_lifecycle', 'relation_change', 'reading', 'research', 'writing', 'execution', 'journal'] },
      eventType: { type: 'string', description: 'Specific event type (e.g. "task.completed", "reading.started")' },
      actorType: { type: 'string', description: 'Actor type', enum: ['user', 'agent', 'system'] },
      actorId: { type: 'string', description: 'Actor ID' },
      objectUid: { type: 'string', description: 'Related object UID' },
      payload: { type: 'object', description: 'Additional event payload' },
    },
    required: ['category', 'eventType', 'actorType'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const cat = args.category as SemanticEventCategory;
      const eventType = args.eventType as string;
      const actorType = args.actorType as ActorType;
      const now = new Date().toISOString();

      const event: Record<string, unknown> = {
        objectType: 'event',
        id: generateId('evt'),
        streamUid: 'default',
        eventType,
        actorType,
        actorId: (args.actorId as string) ?? null,
        surface: CATEGORY_TO_SURFACE[cat] ?? 'app',
        objectUid: (args.objectUid as string) ?? null,
        relatedUids: null,
        payload: (args.payload as Record<string, unknown>) ?? null,
        captureMode: 'explicit',
        privacyLevel: 'normal',
        agentAccess: 'full_local_only',
        retentionClass: 'crumb',
        occurredAt: now,
        redactedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      store.addEvent(event);
      return ok(event);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const journalListEventsTool: BuiltinTool = {
  name: 'journal.listEvents',
  description: 'List semantic events for a date range',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      startDate: { type: 'string', description: 'Start date (ISO string)' },
      endDate: { type: 'string', description: 'End date (ISO string)' },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const events = store.listEvents({
        startDate: args.startDate as string | undefined,
        endDate: args.endDate as string | undefined,
      });
      return ok({ count: events.length, events });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const journalGenerateSummaryTool: BuiltinTool = {
  name: 'journal.generateSummary',
  description: 'Generate a daily/weekly/monthly summary from logged events and notes',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      scope: { type: 'string', description: 'Summary scope', enum: ['day', 'week', 'month'] },
      scopeKey: { type: 'string', description: 'Scope key (e.g. "2024-01-15" for day, "2024-W03" for week)' },
    },
    required: ['scope', 'scopeKey'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const scope = args.scope as JournalSummaryScope;
      const scopeKey = args.scopeKey as string;

      const allEvents = store.listEvents();
      const dayNote = store.getDayNote(scopeKey);
      const now = new Date().toISOString();

      // Build summary prompt-like content
      const lines: string[] = [
        `# ${scope.charAt(0).toUpperCase() + scope.slice(1)} Summary — ${scopeKey}`,
        '',
        `## Activity (${allEvents.length} events)`,
      ];

      for (const evt of allEvents.slice(0, 20)) {
        lines.push(`- [${evt.occurredAt}] ${evt.eventType}`);
      }
      if (allEvents.length > 20) {
        lines.push(`- ... and ${allEvents.length - 20} more events`);
      }

      if (dayNote) {
        lines.push('', '## Journal Entry', dayNote.markdown as string);
      }

      const summaryMarkdown = lines.join('\n');

      const summary: Record<string, unknown> = {
        objectType: 'journal_summary',
        id: generateId('jsum'),
        scope,
        scopeKey,
        summaryMarkdown,
        generatedBy: 'system',
        privacyLevel: 'normal',
        agentAccess: 'summary_only',
        versionNo: 1,
        createdAt: now,
        updatedAt: now,
      };

      store.addSummary(summary);
      return ok(summary);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const journalGetInsightsTool: BuiltinTool = {
  name: 'journal.getInsights',
  description: 'Get behavior insights based on activity patterns (focus, input/output ratio, drift, review gaps)',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      dayCount: { type: 'number', description: 'Number of days to analyze (default 14)' },
      actionLogCounts: { type: 'object', description: 'Map of action kind → count' },
      readingCount: { type: 'number', description: 'Number of reading events' },
      writingCount: { type: 'number', description: 'Number of writing events' },
      projectIds: { type: 'array', items: { type: 'string' }, description: 'Active project IDs' },
      reviewCount: { type: 'number', description: 'Number of reviews in period' },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const input: InsightDetectorInput = {
        actionLogCounts: (args.actionLogCounts as Readonly<Record<string, number>>) ?? {},
        dayCount: (args.dayCount as number) ?? 14,
        readingCount: (args.readingCount as number) ?? 0,
        writingCount: (args.writingCount as number) ?? 0,
        projectIds: (args.projectIds as string[]) ?? [],
        reviewCount: (args.reviewCount as number) ?? 0,
      };

      const insights: Array<Record<string, unknown>> = [];
      const now = new Date().toISOString();
      const scopeStart = new Date(Date.now() - input.dayCount * 24 * 60 * 60 * 1000).toISOString();

      for (const pattern of INSIGHT_DETECTORS) {
        const result = pattern.detector(input);
        if (result) {
          insights.push({
            objectType: 'behavior_insight',
            id: generateId('ins'),
            insightType: pattern.type,
            scopeStart,
            scopeEnd: now,
            statement: result.statement,
            evidence: result.evidence,
            confidence: result.confidence,
            status: 'proposed',
            visibility: 'user_visible',
            createdBy: 'agent',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      return ok({ count: insights.length, insights });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const journalWriteNoteTool: BuiltinTool = {
  name: 'journal.writeNote',
  description: 'Write a day note entry for a specific date',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      dayKey: { type: 'string', description: 'Day key in ISO date format (YYYY-MM-DD)' },
      markdown: { type: 'string', description: 'Note content in markdown' },
      privacyLevel: { type: 'string', description: 'Optional privacy override', enum: ['normal', 'sensitive', 'sealed'] },
    },
    required: ['dayKey', 'markdown'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const dayKey = args.dayKey as string;
      const markdown = args.markdown as string;
      const privacyOverride = args.privacyLevel as PrivacyLevel | undefined;
      const now = new Date().toISOString();

      const existing = store.getDayNote(dayKey);
      const privacy = privacyOverride ?? classifyPrivacy(markdown);
      const access = deriveAgentAccess(privacy);

      if (existing) {
        const updated = {
          ...existing,
          markdown,
          privacyLevel: privacy,
          agentAccess: access,
          updatedAt: now,
        };
        store.setDayNote(dayKey, updated);
        return ok(updated);
      }

      const note: Record<string, unknown> = {
        objectType: 'day_note',
        id: generateId('dnote'),
        dayKey,
        noteKind: 'journal',
        markdown,
        filePath: null,
        privacyLevel: privacy,
        agentAccess: access,
        reflectsOnUids: null,
        recordingMode: 'normal',
        createdAt: now,
        updatedAt: now,
      };

      store.setDayNote(dayKey, note);
      return ok(note);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const journalGetNoteTool: BuiltinTool = {
  name: 'journal.getNote',
  description: 'Get the day note for a specific date',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      dayKey: { type: 'string', description: 'Day key in ISO date format (YYYY-MM-DD)' },
    },
    required: ['dayKey'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const dayKey = args.dayKey as string;
      const note = store.getDayNote(dayKey);
      if (!note) return ok({ found: false, dayKey });
      return ok({ found: true, note });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const journalClassifyPrivacyTool: BuiltinTool = {
  name: 'journal.classifyPrivacy',
  description: 'Classify content privacy level (normal, sensitive, sealed) based on keyword analysis',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Content text to classify' },
    },
    required: ['content'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const content = args.content as string;
      const level = classifyPrivacy(content);
      const access = deriveAgentAccess(level);
      return ok({ privacyLevel: level, agentAccess: access });
    } catch (e) {
      return fail(String(e));
    }
  },
};

// ── Exported toolsets ──────────────────────────────────────

export const JOURNAL_DOMAIN_TOOLSETS: Toolset[] = [
  {
    name: 'semantic-events',
    description: 'Semantic event logging and querying',
    category: CATEGORY,
    tools: [journalLogEventTool, journalListEventsTool],
  },
  {
    name: 'journal-summaries',
    description: 'Journal summary generation and behavior insights',
    category: CATEGORY,
    tools: [journalGenerateSummaryTool, journalGetInsightsTool],
  },
  {
    name: 'day-notes',
    description: 'Day note writing and retrieval with privacy classification',
    category: CATEGORY,
    tools: [journalWriteNoteTool, journalGetNoteTool, journalClassifyPrivacyTool],
  },
];
