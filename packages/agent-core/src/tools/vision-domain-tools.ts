// ---------------------------------------------------------------------------
// @orbit/agent-core – Vision Domain Tools
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { BuiltinTool, ToolCategory, ToolOutput } from './types.js';
import type { Toolset } from './toolset-registry.js';

// ── Local types ────────────────────────────────────────────

type VisionScope = 'life' | 'year' | 'quarter';

type VisionReminderMode = 'review_only' | 'decision_points' | 'on_request' | 'silent';

type VisionStatus = 'active' | 'archived' | 'paused';

type VisionAuthoredBy = 'user' | 'agent' | 'collaboration';

type DirectiveScope = 'year' | 'quarter' | 'month' | 'week';

type DirectiveStatus = 'draft' | 'active' | 'paused' | 'archived';

type ReminderTrigger = 'before_choice' | 'on_create' | 'on_review' | 'on_help';

// ── Reminder rules (from feature-vision/reminder-strategy.ts) ──

interface ReminderRule {
  readonly trigger: ReminderTrigger;
  readonly allowedModes: readonly VisionReminderMode[];
  readonly description: string;
}

const REMINDER_RULES: readonly ReminderRule[] = [
  { trigger: 'before_choice', allowedModes: ['review_only', 'decision_points'], description: 'Remind when user is about to make a decision.' },
  { trigger: 'on_create', allowedModes: ['review_only', 'decision_points'], description: 'Remind when creating a new project or task.' },
  { trigger: 'on_review', allowedModes: ['review_only', 'decision_points', 'on_request'], description: 'Remind during daily or weekly review.' },
  { trigger: 'on_help', allowedModes: ['review_only', 'decision_points', 'on_request'], description: 'Remind when user explicitly asks for guidance.' },
];

// ── Slug generation (from feature-vision/vision-repository.ts) ──

function generateSlug(title: string, existingSlugs: readonly string[] = []): string {
  const base = title
    .toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!existingSlugs.includes(base)) return base;
  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

// ── In-memory store ────────────────────────────────────────

export class VisionDomainStore {
  private readonly visions = new Map<string, Record<string, unknown>>();
  private readonly versions = new Map<string, Record<string, unknown>[]>();
  private readonly directives = new Map<string, Record<string, unknown>>();
  private readonly reminders = new Map<string, Record<string, unknown>>();

  // ---- Visions ----

  createVision(input: {
    title: string;
    scope: VisionScope;
    reminderMode: VisionReminderMode;
    ownerUserId: string;
  }): Record<string, unknown> {
    const id = generateId('vis');
    const now = new Date().toISOString();
    const existingSlugs = [...this.visions.values()].map((v) => v.slug as string);
    const slug = generateSlug(input.title, existingSlugs);

    const vision: Record<string, unknown> = {
      objectType: 'vision',
      id,
      slug,
      title: input.title,
      currentVersionId: '',
      status: 'active' as VisionStatus,
      reminderMode: input.reminderMode,
      scope: input.scope,
      ownerUserId: input.ownerUserId,
      sourceFileId: null,
      createdAt: now,
      updatedAt: now,
      lastReaffirmedAt: null,
      deletedAt: null,
    };
    this.visions.set(id, vision);
    return vision;
  }

  getVision(id: string): Record<string, unknown> | undefined {
    return this.visions.get(id);
  }

  updateVision(id: string, patch: Record<string, unknown>): Record<string, unknown> | undefined {
    const vision = this.visions.get(id);
    if (!vision) return undefined;
    const updated = { ...vision, ...patch, id, updatedAt: new Date().toISOString() };
    this.visions.set(id, updated);
    return updated;
  }

  listVisions(ownerUserId?: string): readonly Record<string, unknown>[] {
    const all = [...this.visions.values()];
    if (ownerUserId) return all.filter((v) => v.ownerUserId === ownerUserId);
    return all;
  }

  // ---- Versions ----

  addVersion(visionId: string, input: {
    bodyMarkdown: string;
    summaryForAgent: string;
    changeNote?: string | null;
    authoredBy: VisionAuthoredBy;
  }): Record<string, unknown> {
    const existing = this.versions.get(visionId) ?? [];
    const maxVersionNo = existing.reduce((max, v) => Math.max(max, v.versionNo as number), 0);
    const now = new Date().toISOString();
    const id = generateId('vver');

    const version: Record<string, unknown> = {
      id,
      visionId,
      versionNo: maxVersionNo + 1,
      sourceFileId: `file_${id}`,
      bodyMarkdown: input.bodyMarkdown,
      summaryForAgent: input.summaryForAgent,
      changeNote: input.changeNote ?? null,
      authoredBy: input.authoredBy,
      createdAt: now,
    };

    existing.push(version);
    this.versions.set(visionId, existing);

    // Update vision's currentVersionId
    const vision = this.visions.get(visionId);
    if (vision) {
      this.visions.set(visionId, { ...vision, currentVersionId: id, updatedAt: now });
    }

    return version;
  }

  listVersions(visionId: string): readonly Record<string, unknown>[] {
    return [...(this.versions.get(visionId) ?? [])].sort(
      (a, b) => (a.versionNo as number) - (b.versionNo as number),
    );
  }

  getVersion(visionId: string, versionNo: number): Record<string, unknown> | undefined {
    return (this.versions.get(visionId) ?? []).find((v) => v.versionNo === versionNo);
  }

  // ---- Directives ----

  createDirective(input: {
    title: string;
    body: string | null;
    scope: DirectiveScope | null;
    visionId: string;
    ownerUserId: string;
  }): Record<string, unknown> {
    const id = generateId('dir');
    const now = new Date().toISOString();
    const directive: Record<string, unknown> = {
      objectType: 'directive',
      id,
      title: input.title,
      body: input.body,
      status: 'draft' as DirectiveStatus,
      scope: input.scope,
      visionId: input.visionId,
      decisionMode: 'user_written',
      ownerUserId: input.ownerUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.directives.set(id, directive);
    return directive;
  }

  listDirectives(filters?: { visionId?: string; ownerUserId?: string; status?: string }): readonly Record<string, unknown>[] {
    let all = [...this.directives.values()];
    if (filters?.visionId) all = all.filter((d) => d.visionId === filters.visionId);
    if (filters?.ownerUserId) all = all.filter((d) => d.ownerUserId === filters.ownerUserId);
    if (filters?.status) all = all.filter((d) => d.status === filters.status);
    return all;
  }

  // ---- Reminders ----

  setReminder(visionId: string, reminder: Record<string, unknown>): void {
    this.reminders.set(visionId, reminder);
  }

  getReminder(visionId: string): Record<string, unknown> | undefined {
    return this.reminders.get(visionId);
  }
}

// Singleton store
const store = new VisionDomainStore();

// ── Helpers ────────────────────────────────────────────────

function ok(data: unknown): ToolOutput {
  return { success: true, output: JSON.stringify(data) };
}

function fail(error: string): ToolOutput {
  return { success: false, output: JSON.stringify({ error }) };
}

// ── Tools ──────────────────────────────────────────────────

const CATEGORY: ToolCategory = 'vision';

export const visionCreateTool: BuiltinTool = {
  name: 'vision.create',
  description: 'Create a new vision with title, scope, and reminder mode',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Vision title' },
      scope: { type: 'string', description: 'Vision scope', enum: ['life', 'year', 'quarter'] },
      reminderMode: { type: 'string', description: 'Reminder mode', enum: ['review_only', 'decision_points', 'on_request', 'silent'] },
      ownerUserId: { type: 'string', description: 'Owner user ID (defaults to "default")' },
    },
    required: ['title', 'scope'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const vision = store.createVision({
        title: args.title as string,
        scope: args.scope as VisionScope,
        reminderMode: (args.reminderMode as VisionReminderMode) ?? 'review_only',
        ownerUserId: (args.ownerUserId as string) ?? 'default',
      });
      return ok(vision);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const visionListTool: BuiltinTool = {
  name: 'vision.list',
  description: 'List all visions, optionally filtered by owner',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      ownerUserId: { type: 'string', description: 'Filter by owner user ID' },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const visions = store.listVisions(args.ownerUserId as string | undefined);
      return ok({ count: visions.length, visions });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const visionGetTool: BuiltinTool = {
  name: 'vision.get',
  description: 'Get a vision by ID',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Vision ID' },
    },
    required: ['visionId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const vision = store.getVision(args.visionId as string);
      if (!vision) return fail(`Vision not found: ${args.visionId}`);
      return ok(vision);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const visionUpdateTool: BuiltinTool = {
  name: 'vision.update',
  description: 'Update vision properties (title, status, reminderMode, scope)',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Vision ID' },
      title: { type: 'string', description: 'New title' },
      status: { type: 'string', description: 'New status', enum: ['active', 'archived', 'paused'] },
      reminderMode: { type: 'string', description: 'New reminder mode', enum: ['review_only', 'decision_points', 'on_request', 'silent'] },
      scope: { type: 'string', description: 'New scope', enum: ['life', 'year', 'quarter'] },
    },
    required: ['visionId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const visionId = args.visionId as string;
      const patch: Record<string, unknown> = {};
      if (args.title !== undefined) patch.title = args.title;
      if (args.status !== undefined) patch.status = args.status;
      if (args.reminderMode !== undefined) patch.reminderMode = args.reminderMode;
      if (args.scope !== undefined) patch.scope = args.scope;

      const updated = store.updateVision(visionId, patch);
      if (!updated) return fail(`Vision not found: ${visionId}`);
      return ok(updated);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const visionCreateVersionTool: BuiltinTool = {
  name: 'vision.createVersion',
  description: 'Create a new version snapshot of a vision',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Vision ID' },
      bodyMarkdown: { type: 'string', description: 'Full vision body in markdown' },
      summaryForAgent: { type: 'string', description: 'Agent-readable summary' },
      changeNote: { type: 'string', description: 'Description of changes' },
      authoredBy: { type: 'string', description: 'Author type', enum: ['user', 'agent', 'collaboration'] },
    },
    required: ['visionId', 'bodyMarkdown', 'summaryForAgent'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const visionId = args.visionId as string;
      const vision = store.getVision(visionId);
      if (!vision) return fail(`Vision not found: ${visionId}`);

      const version = store.addVersion(visionId, {
        bodyMarkdown: args.bodyMarkdown as string,
        summaryForAgent: args.summaryForAgent as string,
        changeNote: (args.changeNote as string) ?? null,
        authoredBy: (args.authoredBy as VisionAuthoredBy) ?? 'user',
      });
      return ok(version);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const visionListVersionsTool: BuiltinTool = {
  name: 'vision.listVersions',
  description: 'List all version history for a vision, ordered by version number',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Vision ID' },
    },
    required: ['visionId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const versions = store.listVersions(args.visionId as string);
      return ok({ count: versions.length, versions });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const visionCompareVersionsTool: BuiltinTool = {
  name: 'vision.compareVersions',
  description: 'Compare two version snapshots of a vision (line-level diff)',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Vision ID' },
      versionA: { type: 'number', description: 'First version number' },
      versionB: { type: 'number', description: 'Second version number' },
    },
    required: ['visionId', 'versionA', 'versionB'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const visionId = args.visionId as string;
      const vA = store.getVersion(visionId, args.versionA as number);
      const vB = store.getVersion(visionId, args.versionB as number);
      if (!vA) return fail(`Version ${args.versionA} not found for vision ${visionId}`);
      if (!vB) return fail(`Version ${args.versionB} not found for vision ${visionId}`);

      const linesA = (vA.bodyMarkdown as string).split('\n');
      const linesB = (vB.bodyMarkdown as string).split('\n');
      const setA = new Set(linesA);
      const setB = new Set(linesB);

      const added = linesB.filter((l) => !setA.has(l));
      const removed = linesA.filter((l) => !setB.has(l));
      const unchanged = linesA.filter((l) => setB.has(l));

      return ok({
        versionA: args.versionA,
        versionB: args.versionB,
        diff: { added, removed, unchanged },
        summary: `${added.length} added, ${removed.length} removed, ${unchanged.length} unchanged`,
      });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const reminderSetTool: BuiltinTool = {
  name: 'reminder.set',
  description: 'Set a reminder for a vision with a specific trigger',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Vision ID' },
      trigger: { type: 'string', description: 'Reminder trigger', enum: ['before_choice', 'on_create', 'on_review', 'on_help'] },
    },
    required: ['visionId', 'trigger'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const visionId = args.visionId as string;
      const trigger = args.trigger as ReminderTrigger;
      const vision = store.getVision(visionId);
      if (!vision) return fail(`Vision not found: ${visionId}`);

      const status = vision.status as VisionStatus;
      if (status !== 'active') {
        return ok({ shouldRemind: false, reason: 'Vision is not active.' });
      }

      const mode = vision.reminderMode as VisionReminderMode;
      if (mode === 'silent') {
        return ok({ shouldRemind: false, reason: 'Reminder mode is silent.' });
      }

      const rule = REMINDER_RULES.find((r) => r.trigger === trigger);
      if (!rule) {
        return ok({ shouldRemind: false, reason: `No rule defined for trigger "${trigger}".` });
      }

      if (!(rule.allowedModes as readonly string[]).includes(mode)) {
        return ok({
          shouldRemind: false,
          reason: `Trigger "${trigger}" is not active under "${mode}" mode.`,
        });
      }

      // Generate reminder message
      const messages: Record<ReminderTrigger, { title: string; body: string }> = {
        before_choice: {
          title: 'A gentle nudge before you decide',
          body: `Your vision "${vision.title}" might be relevant here. Consider how this choice aligns with your ${vision.scope} aspirations.`,
        },
        on_create: {
          title: 'Starting something new',
          body: `As you create this, remember your vision "${vision.title}". Does this serve your ${vision.scope} direction?`,
        },
        on_review: {
          title: 'Review checkpoint',
          body: `Consider how recent progress aligns with your vision "${vision.title}" for your ${vision.scope}.`,
        },
        on_help: {
          title: 'Guidance from your vision',
          body: `Your vision "${vision.title}" can help guide this moment for your ${vision.scope} aspirations.`,
        },
      };

      const msg = messages[trigger];
      const reminder = {
        shouldRemind: true,
        reason: rule.description,
        message: { trigger, title: msg.title, body: msg.body, tone: 'gentle' },
      };

      store.setReminder(visionId, reminder);
      return ok(reminder);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const directiveCreateTool: BuiltinTool = {
  name: 'directive.create',
  description: 'Create a directive derived from a vision',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Parent vision ID' },
      title: { type: 'string', description: 'Directive title' },
      body: { type: 'string', description: 'Directive body' },
      scope: { type: 'string', description: 'Directive scope', enum: ['year', 'quarter', 'month', 'week'] },
      ownerUserId: { type: 'string', description: 'Owner user ID (defaults to "default")' },
    },
    required: ['visionId', 'title'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const visionId = args.visionId as string;
      const vision = store.getVision(visionId);
      if (!vision) return fail(`Vision not found: ${visionId}`);

      const directive = store.createDirective({
        title: args.title as string,
        body: (args.body as string) ?? null,
        scope: (args.scope as DirectiveScope) ?? null,
        visionId,
        ownerUserId: (args.ownerUserId as string) ?? 'default',
      });
      return ok(directive);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const directiveListTool: BuiltinTool = {
  name: 'directive.list',
  description: 'List directives, optionally filtered by vision or owner',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      visionId: { type: 'string', description: 'Filter by parent vision ID' },
      ownerUserId: { type: 'string', description: 'Filter by owner user ID' },
      status: { type: 'string', description: 'Filter by status', enum: ['draft', 'active', 'paused', 'archived'] },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const filters: { visionId?: string; ownerUserId?: string; status?: string } = {};
      if (args.visionId) filters.visionId = args.visionId as string;
      if (args.ownerUserId) filters.ownerUserId = args.ownerUserId as string;
      if (args.status) filters.status = args.status as string;
      const directives = store.listDirectives(Object.keys(filters).length > 0 ? filters : undefined);
      return ok({ count: directives.length, directives });
    } catch (e) {
      return fail(String(e));
    }
  },
};

// ── Exported toolsets ──────────────────────────────────────

export const VISION_DOMAIN_TOOLSETS: Toolset[] = [
  {
    name: 'vision-management',
    description: 'Vision CRUD and versioning',
    category: CATEGORY,
    tools: [visionCreateTool, visionListTool, visionGetTool, visionUpdateTool],
  },
  {
    name: 'vision-versioning',
    description: 'Vision version snapshots and comparison',
    category: CATEGORY,
    tools: [visionCreateVersionTool, visionListVersionsTool, visionCompareVersionsTool],
  },
  {
    name: 'vision-reminders',
    description: 'Vision-based reminders',
    category: CATEGORY,
    tools: [reminderSetTool],
  },
  {
    name: 'vision-directives',
    description: 'Directives derived from visions',
    category: CATEGORY,
    tools: [directiveCreateTool, directiveListTool],
  },
];
