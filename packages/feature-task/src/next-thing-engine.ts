import type { Task } from '@orbit/domain';
import type { EnergyLevel } from './today-planner.js';

// ── Types ──────────────────────────────────────────────────

export interface TaskConstraints {
  readonly availableMinutes: number;
  readonly energyLevel: EnergyLevel;
  readonly currentContext: string | null;
}

export interface NextThingInput {
  readonly candidateTasks: readonly Task[];
  readonly constraints: TaskConstraints;
  readonly recentHistory: readonly Task[];
}

export interface NextThingChoice {
  readonly task: Task;
  readonly reasoning: string;
}

export interface NextThingResult {
  readonly primary: NextThingChoice;
  readonly alternatives: readonly NextThingChoice[];
  readonly reasoning: string;
}

export interface TaskScoreDetail {
  readonly taskId: string;
  readonly urgency: number;
  readonly benefit: number;
  readonly contextSwitchCost: number;
  readonly energyFit: number;
  readonly total: number;
}

// ── Filtering ──────────────────────────────────────────────

export function filterCandidates(
  tasks: readonly Task[],
  constraints: TaskConstraints,
): readonly Task[] {
  return tasks.filter((task) => {
    // Exclude terminal/blocked states
    if (task.status === 'done' || task.status === 'dropped' || task.status === 'blocked') {
      return false;
    }
    return true;
  });
}

// ── Scoring ────────────────────────────────────────────────

function scoreUrgency(task: Task): number {
  if (!task.dueAt) return 0.3;
  const hoursLeft = (new Date(task.dueAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft <= 0) return 1.0;
  if (hoursLeft <= 24) return 0.9;
  if (hoursLeft <= 72) return 0.7;
  if (hoursLeft <= 168) return 0.5;
  return 0.3;
}

function scoreBenefit(task: Task): number {
  let score = 0.4;
  if (task.milestoneId) score += 0.3;
  if (task.projectId) score += 0.2;
  if (task.completionDefinition) score += 0.1;
  return Math.min(1, score);
}

function scoreContextSwitchCost(
  task: Task,
  recentHistory: readonly Task[],
): number {
  if (recentHistory.length === 0) return 0.5;
  const lastProject = recentHistory[0]?.projectId;
  // Same project = low context switch cost → higher score
  if (task.projectId && task.projectId === lastProject) return 0.9;
  // Different project = higher switch cost → lower score
  if (task.projectId && lastProject && task.projectId !== lastProject) return 0.3;
  return 0.5;
}

function scoreEnergyFit(task: Task, energyLevel: EnergyLevel): number {
  const isComplex = (task.body?.length ?? 0) > 100 || task.completionDefinition !== null;
  if (energyLevel === 'high' && isComplex) return 0.9;
  if (energyLevel === 'high' && !isComplex) return 0.6;
  if (energyLevel === 'low' && !isComplex) return 0.9;
  if (energyLevel === 'low' && isComplex) return 0.3;
  return 0.6;
}

function scoreTask(
  task: Task,
  constraints: TaskConstraints,
  recentHistory: readonly Task[],
): TaskScoreDetail {
  const urgency = scoreUrgency(task);
  const benefit = scoreBenefit(task);
  const contextSwitchCost = scoreContextSwitchCost(task, recentHistory);
  const energyFit = scoreEnergyFit(task, constraints.energyLevel);

  const total = urgency * 0.3 + benefit * 0.25 + contextSwitchCost * 0.2 + energyFit * 0.25;

  return { taskId: task.id, urgency, benefit, contextSwitchCost, energyFit, total };
}

// ── Explanation ─────────────────────────────────────────────

export function explainChoice(task: Task, scores: TaskScoreDetail): string {
  const parts: string[] = [];
  parts.push(`'${task.title}'`);

  if (scores.urgency >= 0.7) parts.push('has high urgency');
  if (scores.benefit >= 0.7) parts.push('advances a milestone');
  if (scores.contextSwitchCost >= 0.7) parts.push('continues current context');
  if (scores.energyFit >= 0.7) parts.push('matches current energy level');

  return `${parts.join(', ')} (score: ${scores.total.toFixed(2)}).`;
}

// ── Main computation ───────────────────────────────────────

export function computeNextThing(input: NextThingInput): NextThingResult {
  const { candidateTasks, constraints, recentHistory } = input;
  const eligible = filterCandidates(candidateTasks, constraints);

  if (eligible.length === 0) {
    throw new Error('No eligible tasks found after filtering.');
  }

  const scored = eligible
    .map((task) => ({ task, scores: scoreTask(task, constraints, recentHistory) }))
    .sort((a, b) => b.scores.total - a.scores.total);

  const primary: NextThingChoice = {
    task: scored[0].task,
    reasoning: explainChoice(scored[0].task, scored[0].scores),
  };

  const alternatives: NextThingChoice[] = scored.slice(1, 3).map((s) => ({
    task: s.task,
    reasoning: explainChoice(s.task, s.scores),
  }));

  return {
    primary,
    alternatives,
    reasoning: `Evaluated ${eligible.length} candidates. ${primary.reasoning}`,
  };
}
