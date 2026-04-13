// ---------------------------------------------------------------------------
// @orbit/agent-core – Task/Project Domain Tools
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { BuiltinTool, ToolCategory, ToolOutput } from './types.js';
import type { Toolset } from './toolset-registry.js';

// ── Local types (mirrors @orbit/domain without dependency) ──

type TaskStatus =
  | 'captured'
  | 'clarifying'
  | 'ready'
  | 'scheduled'
  | 'focused'
  | 'done'
  | 'blocked'
  | 'dropped';

type EnergyLevel = 'high' | 'medium' | 'low';

type FocusOutcome = 'completed' | 'paused' | 'blocked' | 'abandoned';

type ReviewCycle = 'day' | 'week' | 'month' | 'quarter' | 'year';

// ── Valid transitions (from feature-task/task-lifecycle.ts) ──

const VALID_TRANSITIONS: ReadonlyMap<TaskStatus, readonly TaskStatus[]> = new Map([
  ['captured', ['clarifying', 'ready', 'dropped']],
  ['clarifying', ['ready', 'dropped']],
  ['ready', ['scheduled', 'blocked', 'dropped']],
  ['scheduled', ['focused', 'ready', 'blocked', 'dropped']],
  ['focused', ['done', 'blocked', 'dropped', 'ready']],
  ['done', [] as TaskStatus[]],
  ['blocked', ['ready', 'dropped']],
  ['dropped', ['captured']],
]);

// ── In-memory store ────────────────────────────────────────

export class TaskDomainStore {
  private readonly tasks = new Map<string, Record<string, unknown>>();
  private readonly focusSessions = new Map<string, Record<string, unknown>>();
  private readonly reviews = new Map<string, Record<string, unknown>>();

  // ---- Tasks ----

  getTask(id: string): Record<string, unknown> | undefined {
    return this.tasks.get(id);
  }

  setTask(id: string, task: Record<string, unknown>): void {
    this.tasks.set(id, task);
  }

  listTasks(filters?: { status?: string; projectId?: string }): readonly Record<string, unknown>[] {
    let all = [...this.tasks.values()];
    if (filters?.status) all = all.filter((t) => t.status === filters.status);
    if (filters?.projectId) all = all.filter((t) => t.projectId === filters.projectId);
    return all;
  }

  // ---- Focus sessions ----

  setFocusSession(id: string, session: Record<string, unknown>): void {
    this.focusSessions.set(id, session);
  }

  getFocusSession(id: string): Record<string, unknown> | undefined {
    return this.focusSessions.get(id);
  }

  getActiveFocusSession(): Record<string, unknown> | undefined {
    return [...this.focusSessions.values()].find((s) => s.endedAt === null);
  }

  // ---- Reviews ----

  setReview(id: string, review: Record<string, unknown>): void {
    this.reviews.set(id, review);
  }

  listReviews(): readonly Record<string, unknown>[] {
    return [...this.reviews.values()];
  }
}

// Singleton store
const store = new TaskDomainStore();

// ── Helpers ────────────────────────────────────────────────

function ok(data: unknown): ToolOutput {
  return { success: true, output: JSON.stringify(data) };
}

function fail(error: string): ToolOutput {
  return { success: false, output: JSON.stringify({ error }) };
}

function canTransition(current: TaskStatus, target: TaskStatus): boolean {
  const allowed = VALID_TRANSITIONS.get(current);
  return allowed !== undefined && (allowed as readonly string[]).includes(target);
}

function getValidNextStatuses(current: TaskStatus): readonly TaskStatus[] {
  return VALID_TRANSITIONS.get(current) ?? [];
}

function ensureTask(id: string): Record<string, unknown> | undefined {
  let task = store.getTask(id);
  if (!task) {
    // Auto-create a captured task stub so tools work without pre-seeding
    const now = new Date().toISOString();
    task = {
      id,
      title: `Task ${id}`,
      body: null,
      status: 'captured' as TaskStatus,
      projectId: null,
      milestoneId: null,
      dueAt: null,
      completionDefinition: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    store.setTask(id, task);
  }
  return task;
}

// ── Scoring (from feature-task/today-planner.ts) ───────────

function computeUrgencyScore(task: Record<string, unknown>): number {
  const dueAt = task.dueAt as string | null;
  if (!dueAt) return 0.3;
  const hoursUntilDue = (new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilDue <= 0) return 1.0;
  if (hoursUntilDue <= 24) return 0.9;
  if (hoursUntilDue <= 72) return 0.7;
  if (hoursUntilDue <= 168) return 0.5;
  return 0.3;
}

function computeImportanceScore(task: Record<string, unknown>): number {
  let score = 0.5;
  if (task.milestoneId) score += 0.2;
  if (task.projectId) score += 0.15;
  if (task.completionDefinition) score += 0.1;
  return Math.min(1, score);
}

function computeContextFitScore(
  task: Record<string, unknown>,
  energyLevel: EnergyLevel,
  recentHistory: readonly Record<string, unknown>[],
): number {
  let score = 0.5;
  const bodyLen = typeof task.body === 'string' ? task.body.length : 0;
  const isComplex = bodyLen > 100 || task.completionDefinition !== null;
  if (energyLevel === 'high' && isComplex) score += 0.3;
  else if (energyLevel === 'low' && !isComplex) score += 0.3;
  else if (energyLevel === 'medium') score += 0.15;

  if (recentHistory.length > 0) {
    const recentProjectIds = new Set(recentHistory.map((t) => t.projectId).filter(Boolean));
    if (task.projectId && recentProjectIds.has(task.projectId)) score += 0.2;
  }
  return Math.min(1, score);
}

// ── Next-thing scoring (from feature-task/next-thing-engine.ts) ──

function scoreEnergyFit(task: Record<string, unknown>, energyLevel: EnergyLevel): number {
  const bodyLen = typeof task.body === 'string' ? task.body.length : 0;
  const isComplex = bodyLen > 100 || task.completionDefinition !== null;
  if (energyLevel === 'high' && isComplex) return 0.9;
  if (energyLevel === 'high' && !isComplex) return 0.6;
  if (energyLevel === 'low' && !isComplex) return 0.9;
  if (energyLevel === 'low' && isComplex) return 0.3;
  return 0.6;
}

function scoreContextSwitch(
  task: Record<string, unknown>,
  recentHistory: readonly Record<string, unknown>[],
): number {
  if (recentHistory.length === 0) return 0.5;
  const lastProject = recentHistory[0]?.projectId;
  if (task.projectId && task.projectId === lastProject) return 0.9;
  if (task.projectId && lastProject && task.projectId !== lastProject) return 0.3;
  return 0.5;
}

// ── Intent parsing (from feature-task/intent-parser.ts) ────

function splitIntoSubtasks(input: string): readonly string[] {
  const trimmed = input.trim();
  const numberedPattern = /^\d+[.)]\s+/;
  const lines = trimmed.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length > 1 && lines.every((l) => numberedPattern.test(l))) {
    return lines.map((l) => l.replace(numberedPattern, '').trim());
  }
  const bulletPattern = /^[-*•]\s+/;
  if (lines.length > 1 && lines.every((l) => bulletPattern.test(l))) {
    return lines.map((l) => l.replace(bulletPattern, '').trim());
  }
  const thenPattern = /\s+(?:and then|then|,\s*then)\s+/i;
  if (thenPattern.test(trimmed)) {
    return trimmed.split(thenPattern).map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [trimmed];
}

// ── Tools ──────────────────────────────────────────────────

const CATEGORY: ToolCategory = 'planning';

export const taskTransitionTool: BuiltinTool = {
  name: 'task.transition',
  description: 'Transition a task to a new status (captured→ready→focused→done etc.)',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID' },
      targetStatus: { type: 'string', description: 'Target status', enum: ['captured', 'clarifying', 'ready', 'scheduled', 'focused', 'done', 'blocked', 'dropped'] },
      trigger: { type: 'string', description: 'Optional trigger description' },
    },
    required: ['taskId', 'targetStatus'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const taskId = args.taskId as string;
      const targetStatus = args.targetStatus as TaskStatus;
      const trigger = (args.trigger as string) ?? undefined;
      const task = ensureTask(taskId);
      if (!task) return fail(`Task not found: ${taskId}`);

      const current = task.status as TaskStatus;
      if (!canTransition(current, targetStatus)) {
        return fail(`Invalid transition: cannot move from '${current}' to '${targetStatus}'`);
      }

      const now = new Date().toISOString();
      const updatedTask = {
        ...task,
        status: targetStatus,
        updatedAt: now,
        completedAt: targetStatus === 'done' ? now : task.completedAt,
      };
      store.setTask(taskId, updatedTask);

      const transition = {
        from: current,
        to: targetStatus,
        trigger: trigger ?? `${current}_to_${targetStatus}`,
        timestamp: now,
        actorType: 'user',
      };

      return ok({ task: updatedTask, transition });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const taskGetValidTransitionsTool: BuiltinTool = {
  name: 'task.getValidTransitions',
  description: 'Get valid next statuses for a task given its current status',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      currentStatus: { type: 'string', description: 'Current task status', enum: ['captured', 'clarifying', 'ready', 'scheduled', 'focused', 'done', 'blocked', 'dropped'] },
    },
    required: ['currentStatus'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const current = args.currentStatus as TaskStatus;
      const validNext = getValidNextStatuses(current);
      return ok({ currentStatus: current, validTransitions: validNext });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const taskParseIntentTool: BuiltinTool = {
  name: 'task.parseIntent',
  description: 'Parse natural language task description into structured intent with suggested title, body, and subtasks',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      rawInput: { type: 'string', description: 'Natural language task description' },
    },
    required: ['rawInput'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const rawInput = args.rawInput as string;
      const trimmed = rawInput.trim();
      if (trimmed.length === 0) {
        return ok({
          suggestedTitle: '',
          suggestedBody: null,
          suggestedProject: null,
          suggestedMilestone: null,
          subtasks: [],
          confidence: 0,
        });
      }

      const subtasks = splitIntoSubtasks(trimmed);
      const hasSubtasks = subtasks.length > 1;
      const lines = trimmed.split('\n');
      const suggestedTitle = lines[0].replace(/^[-*\d.)\]]+\s*/, '').trim();
      const bodyLines = lines.slice(1).filter((l) => l.trim().length > 0);
      const suggestedBody = bodyLines.length > 0 ? bodyLines.join('\n') : null;

      let confidence = 0.5;
      if (suggestedTitle.length > 5) confidence += 0.1;
      if (suggestedTitle.length > 20) confidence += 0.1;
      if (hasSubtasks) confidence += 0.1;
      if (suggestedTitle.length <= 3) confidence = 0.2;
      confidence = Math.min(1, Math.max(0, confidence));

      return ok({
        suggestedTitle,
        suggestedBody,
        suggestedProject: null,
        suggestedMilestone: null,
        subtasks: hasSubtasks ? subtasks : [],
        confidence,
      });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const todayPlanTool: BuiltinTool = {
  name: 'today.plan',
  description: "Generate today's plan by scoring and ranking candidate tasks",
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      energyLevel: { type: 'string', description: 'Current energy level', enum: ['high', 'medium', 'low'] },
      contextHint: { type: 'string', description: 'Optional context hint' },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const energyLevel = (args.energyLevel as EnergyLevel) ?? 'medium';
      const readyTasks = store.listTasks({ status: 'ready' });
      const scheduledTasks = store.listTasks({ status: 'scheduled' });
      const candidates = [...readyTasks, ...scheduledTasks];

      if (candidates.length === 0) {
        return ok({
          primary: null,
          alternatives: [],
          reasoning: 'No ready or scheduled tasks available.',
          scheduledBlocks: [],
        });
      }

      const scored = candidates.map((task) => {
        const urgency = computeUrgencyScore(task);
        const importance = computeImportanceScore(task);
        const contextFit = computeContextFitScore(task, energyLevel, []);
        const total = urgency * 0.4 + importance * 0.35 + contextFit * 0.25;
        return { task, taskId: task.id as string, urgency, importance, contextFit, total };
      }).sort((a, b) => b.total - a.total);

      const primary = scored[0]?.task ?? null;
      const alternatives = scored.slice(1, 3).map((s) => s.task);
      const reasoning = primary
        ? `Selected '${primary.title}' as primary based on urgency, importance, and context fit.`
        : 'No suitable task found.';

      const scheduledBlocks: Array<Record<string, unknown>> = [];
      let currentHour = 9;
      const topTasks = [primary, ...alternatives].filter(Boolean);
      for (const t of topTasks) {
        if (currentHour >= 17) break;
        const endHour = Math.min(currentHour + 2, 17);
        scheduledBlocks.push({ taskId: t!.id, startHour: currentHour, endHour, label: t!.title });
        currentHour = endHour;
      }

      return ok({ primary, alternatives, reasoning, scheduledBlocks, scores: scored.map(({ task: _t, ...rest }) => rest) });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const todayScoreTaskTool: BuiltinTool = {
  name: 'today.scoreTask',
  description: 'Score a single task for prioritization based on urgency, importance, and context fit',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID to score' },
      energyLevel: { type: 'string', description: 'Current energy level', enum: ['high', 'medium', 'low'] },
    },
    required: ['taskId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const taskId = args.taskId as string;
      const energyLevel = (args.energyLevel as EnergyLevel) ?? 'medium';
      const task = ensureTask(taskId);
      if (!task) return fail(`Task not found: ${taskId}`);

      const urgency = computeUrgencyScore(task);
      const importance = computeImportanceScore(task);
      const contextFit = computeContextFitScore(task, energyLevel, []);
      const total = urgency * 0.4 + importance * 0.35 + contextFit * 0.25;

      return ok({ taskId, urgency, importance, contextFit, total });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const focusStartTool: BuiltinTool = {
  name: 'focus.start',
  description: 'Start a focus session on a task, gathering context and materials',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID to focus on' },
      goalDescription: { type: 'string', description: 'Optional goal override' },
    },
    required: ['taskId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const taskId = args.taskId as string;
      const goalDescription = args.goalDescription as string | undefined;
      const task = ensureTask(taskId);
      if (!task) return fail(`Task not found: ${taskId}`);

      const active = store.getActiveFocusSession();
      if (active) return fail(`Already in a focus session for task ${active.taskId}`);

      const now = new Date().toISOString();
      const sessionId = generateId('focus');
      const materials: Array<Record<string, unknown>> = [];

      if (task.projectId) {
        materials.push({ objectType: 'project', objectId: task.projectId, title: `Project ${task.projectId}`, relevance: 'Parent project providing context.' });
      }
      if (task.milestoneId) {
        materials.push({ objectType: 'milestone', objectId: task.milestoneId, title: `Milestone ${task.milestoneId}`, relevance: 'Target milestone.' });
      }

      const session = {
        id: sessionId,
        taskId,
        startedAt: now,
        endedAt: null,
        goalDescription: goalDescription ?? (task.completionDefinition as string) ?? `Complete: ${task.title}`,
        materials,
        outputTarget: null,
        outcome: null,
      };

      store.setFocusSession(sessionId, session);
      return ok(session);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const focusEndTool: BuiltinTool = {
  name: 'focus.end',
  description: 'End the current focus session with an outcome',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      outcome: { type: 'string', description: 'Session outcome', enum: ['completed', 'paused', 'blocked', 'abandoned'] },
    },
    required: ['outcome'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const outcome = args.outcome as FocusOutcome;
      const session = store.getActiveFocusSession();
      if (!session) return fail('No active focus session found.');

      const now = new Date().toISOString();
      const ended = { ...session, endedAt: now, outcome };
      store.setFocusSession(session.id as string, ended);

      return ok(ended);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const focusGetContextTool: BuiltinTool = {
  name: 'focus.getContext',
  description: 'Get focus context for a task including related materials',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID' },
    },
    required: ['taskId'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const taskId = args.taskId as string;
      const task = ensureTask(taskId);
      if (!task) return fail(`Task not found: ${taskId}`);

      const materials: Array<Record<string, unknown>> = [];
      if (task.projectId) {
        materials.push({ objectType: 'project', objectId: task.projectId, title: `Project ${task.projectId}`, relevance: 'Parent project providing context.' });
      }
      if (task.milestoneId) {
        materials.push({ objectType: 'milestone', objectId: task.milestoneId, title: `Milestone ${task.milestoneId}`, relevance: 'Target milestone.' });
      }

      return ok({
        task,
        parentProject: task.projectId ? { id: task.projectId } : null,
        parentMilestone: task.milestoneId ? { id: task.milestoneId } : null,
        materials,
        relatedNotes: [],
        relatedResearch: [],
        reviewHistory: [],
      });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const reviewCreateTool: BuiltinTool = {
  name: 'review.createReview',
  description: 'Create a task review for a given cycle (day, week, month)',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      cycle: { type: 'string', description: 'Review cycle', enum: ['day', 'week', 'month', 'quarter', 'year'] },
      periodStart: { type: 'string', description: 'Period start (ISO date string)' },
      periodEnd: { type: 'string', description: 'Period end (ISO date string)' },
      decisions: { type: 'array', items: { type: 'string' }, description: 'Decisions made' },
      observations: { type: 'array', items: { type: 'string' }, description: 'Observations' },
      nextActions: { type: 'array', items: { type: 'string' }, description: 'Next actions' },
      updatedPriorities: { type: 'array', items: { type: 'string' }, description: 'Updated priorities' },
    },
    required: ['cycle', 'periodStart', 'periodEnd'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const cycle = args.cycle as ReviewCycle;
      const periodStart = args.periodStart as string;
      const periodEnd = args.periodEnd as string;
      const decisions = (args.decisions as string[]) ?? [];
      const observations = (args.observations as string[]) ?? [];
      const nextActions = (args.nextActions as string[]) ?? [];
      const updatedPriorities = (args.updatedPriorities as string[]) ?? [];

      const now = new Date().toISOString();
      const id = generateId('review');

      const body = [
        '## Decisions',
        ...decisions.map((d) => `- ${d}`),
        '',
        '## Observations',
        ...observations.map((o) => `- ${o}`),
        '',
        '## Next Actions',
        ...nextActions.map((a) => `- ${a}`),
        '',
        '## Updated Priorities',
        ...updatedPriorities.map((p) => `- ${p}`),
      ].join('\n');

      const review = {
        id,
        objectType: 'review',
        title: `${cycle.charAt(0).toUpperCase() + cycle.slice(1)} Review`,
        body,
        cycle,
        status: 'draft',
        timeWindow: { start: periodStart, end: periodEnd },
        decisionMode: 'agent_suggested',
        decisions,
        observations,
        nextActions,
        updatedPriorities,
        createdAt: now,
        updatedAt: now,
      };

      store.setReview(id, review);
      return ok(review);
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const nextThingSuggestTool: BuiltinTool = {
  name: 'nextThing.suggest',
  description: 'Suggest the next task to work on based on urgency, benefit, context, and energy fit',
  category: CATEGORY,
  parameters: {
    type: 'object',
    properties: {
      energyLevel: { type: 'string', description: 'Current energy level', enum: ['high', 'medium', 'low'] },
      availableMinutes: { type: 'number', description: 'Available time in minutes' },
      currentContext: { type: 'string', description: 'Current working context (e.g. project name)' },
    },
    required: ['energyLevel'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolOutput> => {
    try {
      const energyLevel = args.energyLevel as EnergyLevel;
      const allTasks = store.listTasks();

      const eligible = allTasks.filter((t) => {
        const status = t.status as string;
        return status !== 'done' && status !== 'dropped' && status !== 'blocked';
      });

      if (eligible.length === 0) return fail('No eligible tasks found after filtering.');

      const scored = eligible.map((task) => {
        const urgency = computeUrgencyScore(task);
        const benefit = computeImportanceScore(task);
        const contextSwitchCost = scoreContextSwitch(task, []);
        const energyFit = scoreEnergyFit(task, energyLevel);
        const total = urgency * 0.3 + benefit * 0.25 + contextSwitchCost * 0.2 + energyFit * 0.25;
        return { task, scores: { taskId: task.id as string, urgency, benefit, contextSwitchCost, energyFit, total } };
      }).sort((a, b) => b.scores.total - a.scores.total);

      const explainChoice = (task: Record<string, unknown>, scores: Record<string, number>): string => {
        const parts: string[] = [`'${task.title}'`];
        if ((scores.urgency ?? 0) >= 0.7) parts.push('has high urgency');
        if ((scores.benefit ?? 0) >= 0.7) parts.push('advances a milestone');
        if ((scores.contextSwitchCost ?? 0) >= 0.7) parts.push('continues current context');
        if ((scores.energyFit ?? 0) >= 0.7) parts.push('matches current energy level');
        return `${parts.join(', ')} (score: ${(scores.total ?? 0).toFixed(2)}).`;
      };

      const primary = {
        task: scored[0].task,
        reasoning: explainChoice(scored[0].task, scored[0].scores as unknown as Record<string, number>),
      };

      const alternatives = scored.slice(1, 3).map((s) => ({
        task: s.task,
        reasoning: explainChoice(s.task, s.scores as unknown as Record<string, number>),
      }));

      return ok({
        primary,
        alternatives,
        reasoning: `Evaluated ${eligible.length} candidates. ${primary.reasoning}`,
      });
    } catch (e) {
      return fail(String(e));
    }
  },
};

// ── Exported toolsets ──────────────────────────────────────

export const TASK_DOMAIN_TOOLSETS: Toolset[] = [
  {
    name: 'task-lifecycle',
    description: 'Task status transitions and intent parsing',
    category: CATEGORY,
    tools: [taskTransitionTool, taskGetValidTransitionsTool, taskParseIntentTool],
  },
  {
    name: 'today-planning',
    description: 'Daily planning and task scoring',
    category: CATEGORY,
    tools: [todayPlanTool, todayScoreTaskTool],
  },
  {
    name: 'focus-mode',
    description: 'Focus session management',
    category: CATEGORY,
    tools: [focusStartTool, focusEndTool, focusGetContextTool],
  },
  {
    name: 'review-system',
    description: 'Task review creation',
    category: CATEGORY,
    tools: [reviewCreateTool],
  },
  {
    name: 'next-thing',
    description: 'Next task suggestion engine',
    category: CATEGORY,
    tools: [nextThingSuggestTool],
  },
];

export { TaskDomainStore as _TaskDomainStore };
