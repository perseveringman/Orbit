import type { Task, IsoDateTimeString } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export type EnergyLevel = 'high' | 'medium' | 'low';

export interface TodayPlanInput {
  readonly readyTasks: readonly Task[];
  readonly blockedTasks: readonly Task[];
  readonly deadlineTasks: readonly Task[];
  readonly recentFocusHistory: readonly Task[];
  readonly energyLevel?: EnergyLevel;
  readonly contextHint?: string;
}

export interface ScheduledBlock {
  readonly taskId: string;
  readonly startHour: number;
  readonly endHour: number;
  readonly label: string;
}

export interface TodayPlan {
  readonly primary: Task | null;
  readonly alternatives: readonly Task[];
  readonly reasoning: string;
  readonly scheduledBlocks: readonly ScheduledBlock[];
}

export interface TaskScore {
  readonly taskId: string;
  readonly urgencyScore: number;
  readonly importanceScore: number;
  readonly contextFitScore: number;
  readonly totalScore: number;
}

export interface ScoringWeights {
  readonly urgency: number;
  readonly importance: number;
  readonly contextFit: number;
}

// ── Default weights ────────────────────────────────────────

const DEFAULT_WEIGHTS: ScoringWeights = {
  urgency: 0.4,
  importance: 0.35,
  contextFit: 0.25,
};

// ── Scoring ────────────────────────────────────────────────

function computeUrgencyScore(task: Task): number {
  if (!task.dueAt) return 0.3;
  const now = Date.now();
  const due = new Date(task.dueAt).getTime();
  const hoursUntilDue = (due - now) / (1000 * 60 * 60);
  if (hoursUntilDue <= 0) return 1.0;
  if (hoursUntilDue <= 24) return 0.9;
  if (hoursUntilDue <= 72) return 0.7;
  if (hoursUntilDue <= 168) return 0.5;
  return 0.3;
}

function computeImportanceScore(task: Task): number {
  let score = 0.5;
  if (task.milestoneId) score += 0.2;
  if (task.projectId) score += 0.15;
  if (task.completionDefinition) score += 0.1;
  return Math.min(1, score);
}

function computeContextFitScore(
  task: Task,
  energyLevel: EnergyLevel,
  recentHistory: readonly Task[],
): number {
  let score = 0.5;

  // Energy match: complex tasks (with body/subtasks) benefit from high energy
  const isComplex = (task.body?.length ?? 0) > 100 || task.completionDefinition !== null;
  if (energyLevel === 'high' && isComplex) score += 0.3;
  else if (energyLevel === 'low' && !isComplex) score += 0.3;
  else if (energyLevel === 'medium') score += 0.15;

  // Context continuity: same project as recent work
  if (recentHistory.length > 0) {
    const recentProjectIds = new Set(recentHistory.map((t) => t.projectId).filter(Boolean));
    if (task.projectId && recentProjectIds.has(task.projectId)) {
      score += 0.2;
    }
  }

  return Math.min(1, score);
}

export function scoreTasks(
  tasks: readonly Task[],
  weights?: ScoringWeights,
  energyLevel?: EnergyLevel,
  recentHistory?: readonly Task[],
): readonly TaskScore[] {
  const w = weights ?? DEFAULT_WEIGHTS;
  const energy = energyLevel ?? 'medium';
  const history = recentHistory ?? [];

  const scored = tasks.map((task): TaskScore => {
    const urgencyScore = computeUrgencyScore(task);
    const importanceScore = computeImportanceScore(task);
    const contextFitScore = computeContextFitScore(task, energy, history);
    const totalScore =
      urgencyScore * w.urgency +
      importanceScore * w.importance +
      contextFitScore * w.contextFit;

    return { taskId: task.id, urgencyScore, importanceScore, contextFitScore, totalScore };
  });

  return scored.slice().sort((a, b) => b.totalScore - a.totalScore);
}

// ── Plan generation ────────────────────────────────────────

export function generateTodayPlan(input: TodayPlanInput): TodayPlan {
  const { readyTasks, deadlineTasks, recentFocusHistory, energyLevel } = input;

  // Merge deadline tasks into candidate pool (ready + deadline)
  const candidateMap = new Map<string, Task>();
  for (const t of readyTasks) candidateMap.set(t.id, t);
  for (const t of deadlineTasks) candidateMap.set(t.id, t);
  const candidates = Array.from(candidateMap.values());

  if (candidates.length === 0) {
    return {
      primary: null,
      alternatives: [],
      reasoning: 'No ready or deadline tasks available.',
      scheduledBlocks: [],
    };
  }

  const scored = scoreTasks(candidates, undefined, energyLevel, recentFocusHistory);
  const taskById = new Map(candidates.map((t) => [t.id, t]));

  const primary = taskById.get(scored[0].taskId) ?? null;
  const alternatives = scored
    .slice(1, 3)
    .map((s) => taskById.get(s.taskId))
    .filter((t): t is Task => t !== undefined);

  const reasoning = primary
    ? `Selected '${primary.title}' as primary based on urgency, importance, and context fit.`
    : 'No suitable task found.';

  // Generate scheduled blocks for top tasks
  const scheduledBlocks: ScheduledBlock[] = [];
  let currentHour = 9;
  const topTasks = [primary, ...alternatives].filter((t): t is Task => t !== null);
  for (const task of topTasks) {
    if (currentHour >= 17) break;
    const endHour = Math.min(currentHour + 2, 17);
    scheduledBlocks.push({
      taskId: task.id,
      startHour: currentHour,
      endHour,
      label: task.title,
    });
    currentHour = endHour;
  }

  return { primary, alternatives, reasoning, scheduledBlocks };
}
