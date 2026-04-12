import { describe, it, expect } from 'vitest';
import type { Task, Project, Milestone, TaskStatus } from '@orbit/domain';

// ── Module imports ─────────────────────────────────────────

import {
  // task-lifecycle
  TASK_STATUS_ORDER,
  VALID_TRANSITIONS,
  canTransition,
  transitionTask,
  getValidNextStatuses,

  // project-manager
  createProject,
  createMilestone,
  updateProject,
  archiveProject,
  listProjects,
  updateMilestone,
  completeMilestone,
  dropMilestone,
  listMilestonesByProject,
  reorderMilestones,
  calculateProjectProgress,
  getProjectHierarchy,

  // intent-parser
  parseUserIntent,
  shouldAutoClassify,
  splitIntoSubtasks,
  suggestProject,

  // today-planner
  generateTodayPlan,
  scoreTasks,

  // focus-mode
  buildFocusContext,
  getFocusMaterials,
  startFocusSession,
  endFocusSession,

  // review-system
  DAY_REVIEW_TEMPLATE,
  WEEK_REVIEW_TEMPLATE,
  PROJECT_REVIEW_TEMPLATE,
  buildReviewPrompt,
  createReview,
  isDueForReview,

  // next-thing-engine
  filterCandidates,
  computeNextThing,
  explainChoice,

  // support-links
  createSupportLink,
  getSupportLinks,
  getTasksForMaterial,
  summarizeSupportLinks,

  // confirmation-gates
  CONFIRMATION_REQUIRED_ACTIONS,
  requiresConfirmation,
  createConfirmationGate,
  resolveGate,

  // event-state-tracker
  recordTaskEvent,
  rebuildTaskStatus,
  getTaskHistory,
  getStatusDuration,
} from '../src/index.js';

// ── Test helpers ───────────────────────────────────────────

const NOW = '2025-07-17T10:00:00Z';

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    objectType: 'task',
    id: overrides.id,
    projectId: overrides.projectId ?? null,
    milestoneId: overrides.milestoneId ?? null,
    parentId: overrides.parentId ?? null,
    title: overrides.title ?? `Task ${overrides.id}`,
    body: overrides.body ?? null,
    status: overrides.status ?? 'ready',
    completionDefinition: overrides.completionDefinition ?? null,
    todayOn: overrides.todayOn ?? null,
    focusRank: overrides.focusRank ?? null,
    dueAt: overrides.dueAt ?? null,
    completedAt: overrides.completedAt ?? null,
    lastReviewedAt: overrides.lastReviewedAt ?? null,
    ownerUserId: overrides.ownerUserId ?? 'user-1',
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  };
}

function makeProject(overrides: Partial<Project> & { id: string }): Project {
  return {
    objectType: 'project',
    id: overrides.id,
    title: overrides.title ?? `Project ${overrides.id}`,
    status: overrides.status ?? 'active',
    alignment: overrides.alignment ?? null,
    visionId: overrides.visionId ?? null,
    themeId: overrides.themeId ?? null,
    goalId: overrides.goalId ?? null,
    decisionMode: overrides.decisionMode ?? null,
    lastReviewedAt: overrides.lastReviewedAt ?? null,
    ownerUserId: overrides.ownerUserId ?? 'user-1',
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  };
}

function makeMilestone(overrides: Partial<Milestone> & { id: string; projectId: string }): Milestone {
  return {
    objectType: 'milestone',
    id: overrides.id,
    projectId: overrides.projectId,
    title: overrides.title ?? `Milestone ${overrides.id}`,
    description: overrides.description ?? null,
    status: overrides.status ?? 'active',
    dueAt: overrides.dueAt ?? null,
    completionDefinition: overrides.completionDefinition ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  };
}

// ════════════════════════════════════════════════════════════
// 1. Task Lifecycle
// ════════════════════════════════════════════════════════════

describe('task-lifecycle', () => {
  it('TASK_STATUS_ORDER contains all 8 statuses', () => {
    expect(TASK_STATUS_ORDER).toHaveLength(8);
    expect(TASK_STATUS_ORDER).toContain('captured');
    expect(TASK_STATUS_ORDER).toContain('done');
    expect(TASK_STATUS_ORDER).toContain('dropped');
  });

  it('canTransition allows valid transitions', () => {
    expect(canTransition('captured', 'clarifying')).toBe(true);
    expect(canTransition('captured', 'ready')).toBe(true);
    expect(canTransition('ready', 'scheduled')).toBe(true);
    expect(canTransition('focused', 'done')).toBe(true);
    expect(canTransition('blocked', 'ready')).toBe(true);
    expect(canTransition('dropped', 'captured')).toBe(true);
  });

  it('canTransition rejects invalid transitions', () => {
    expect(canTransition('captured', 'done')).toBe(false);
    expect(canTransition('done', 'ready')).toBe(false);
    expect(canTransition('ready', 'done')).toBe(false);
  });

  it('getValidNextStatuses returns expected statuses', () => {
    const nextFromCaptured = getValidNextStatuses('captured');
    expect(nextFromCaptured).toContain('clarifying');
    expect(nextFromCaptured).toContain('ready');
    expect(nextFromCaptured).toContain('dropped');

    const nextFromDone = getValidNextStatuses('done');
    expect(nextFromDone).toHaveLength(0);
  });

  it('transitionTask produces updated task and transition', () => {
    const task = makeTask({ id: 't1', status: 'captured' });
    const result = transitionTask(task, 'clarifying', 'user initiated');
    expect(result.task.status).toBe('clarifying');
    expect(result.transition.from).toBe('captured');
    expect(result.transition.to).toBe('clarifying');
    expect(result.transition.trigger).toBe('user initiated');
  });

  it('transitionTask sets completedAt when transitioning to done', () => {
    const task = makeTask({ id: 't2', status: 'focused' });
    const result = transitionTask(task, 'done');
    expect(result.task.completedAt).not.toBeNull();
  });

  it('transitionTask throws on invalid transition', () => {
    const task = makeTask({ id: 't3', status: 'done' });
    expect(() => transitionTask(task, 'ready')).toThrow('Invalid transition');
  });
});

// ════════════════════════════════════════════════════════════
// 2. Project + Milestone Management
// ════════════════════════════════════════════════════════════

describe('project-manager', () => {
  it('createProject creates a valid project', () => {
    const p = createProject({ id: 'p1', title: 'My Project', ownerUserId: 'user-1' });
    expect(p.objectType).toBe('project');
    expect(p.id).toBe('p1');
    expect(p.title).toBe('My Project');
    expect(p.status).toBe('active');
  });

  it('updateProject modifies fields', () => {
    const p = createProject({ id: 'p1', title: 'Old', ownerUserId: 'user-1' });
    const updated = updateProject(p, { title: 'New' });
    expect(updated.title).toBe('New');
    expect(updated.id).toBe('p1');
  });

  it('archiveProject sets status to archived', () => {
    const p = createProject({ id: 'p1', title: 'My Project', ownerUserId: 'user-1' });
    const archived = archiveProject(p);
    expect(archived.status).toBe('archived');
  });

  it('listProjects filters by status', () => {
    const projects = [
      makeProject({ id: 'p1', status: 'active' }),
      makeProject({ id: 'p2', status: 'archived' }),
      makeProject({ id: 'p3', status: 'active' }),
    ];
    expect(listProjects(projects, 'active')).toHaveLength(2);
    expect(listProjects(projects, 'archived')).toHaveLength(1);
    expect(listProjects(projects)).toHaveLength(3);
  });

  it('createMilestone creates a valid milestone', () => {
    const m = createMilestone({ id: 'm1', projectId: 'p1', title: 'Alpha' });
    expect(m.objectType).toBe('milestone');
    expect(m.status).toBe('planned');
    expect(m.projectId).toBe('p1');
  });

  it('completeMilestone and dropMilestone work', () => {
    const m = createMilestone({ id: 'm1', projectId: 'p1', title: 'Alpha' });
    expect(completeMilestone(m).status).toBe('done');
    expect(dropMilestone(m).status).toBe('dropped');
  });

  it('listMilestonesByProject filters and sorts', () => {
    const milestones = [
      makeMilestone({ id: 'm1', projectId: 'p1', sortOrder: 2 }),
      makeMilestone({ id: 'm2', projectId: 'p2', sortOrder: 0 }),
      makeMilestone({ id: 'm3', projectId: 'p1', sortOrder: 1 }),
    ];
    const result = listMilestonesByProject(milestones, 'p1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('m3');
    expect(result[1].id).toBe('m1');
  });

  it('reorderMilestones assigns new sort orders', () => {
    const milestones = [
      makeMilestone({ id: 'm1', projectId: 'p1', sortOrder: 0 }),
      makeMilestone({ id: 'm2', projectId: 'p1', sortOrder: 1 }),
    ];
    const reordered = reorderMilestones(milestones, ['m2', 'm1']);
    expect(reordered[0].id).toBe('m2');
    expect(reordered[0].sortOrder).toBe(0);
    expect(reordered[1].id).toBe('m1');
    expect(reordered[1].sortOrder).toBe(1);
  });

  it('calculateProjectProgress computes correct percentages', () => {
    const milestones = [
      makeMilestone({ id: 'm1', projectId: 'p1', status: 'done' }),
      makeMilestone({ id: 'm2', projectId: 'p1', status: 'active' }),
    ];
    const tasks = [
      makeTask({ id: 't1', status: 'done' }),
      makeTask({ id: 't2', status: 'done' }),
      makeTask({ id: 't3', status: 'ready' }),
      makeTask({ id: 't4', status: 'ready' }),
    ];
    const progress = calculateProjectProgress(milestones, tasks);
    expect(progress.totalMilestones).toBe(2);
    expect(progress.completedMilestones).toBe(1);
    expect(progress.totalTasks).toBe(4);
    expect(progress.completedTasks).toBe(2);
    expect(progress.percentComplete).toBe(50);
  });

  it('calculateProjectProgress handles zero tasks', () => {
    const progress = calculateProjectProgress([], []);
    expect(progress.percentComplete).toBe(0);
  });

  it('getProjectHierarchy builds tree', () => {
    const project = makeProject({ id: 'p1' });
    const milestones = [
      makeMilestone({ id: 'm1', projectId: 'p1', sortOrder: 0 }),
      makeMilestone({ id: 'm2', projectId: 'p1', sortOrder: 1 }),
    ];
    const tasks = [
      makeTask({ id: 't1', projectId: 'p1', milestoneId: 'm1' }),
      makeTask({ id: 't2', projectId: 'p1', milestoneId: null }),
    ];
    const hierarchy = getProjectHierarchy(project, milestones, tasks);
    expect(hierarchy.project.id).toBe('p1');
    expect(hierarchy.milestones).toHaveLength(2);
    expect(hierarchy.milestones[0].tasks).toHaveLength(1);
    expect(hierarchy.unassignedTasks).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════
// 3. Intent Parser
// ════════════════════════════════════════════════════════════

describe('intent-parser', () => {
  it('parseUserIntent extracts title from raw input', () => {
    const intent = parseUserIntent('Build the login page');
    expect(intent.suggestedTitle).toBe('Build the login page');
    expect(intent.confidence).toBeGreaterThan(0);
  });

  it('parseUserIntent returns low confidence for empty input', () => {
    const intent = parseUserIntent('');
    expect(intent.suggestedTitle).toBe('');
    expect(intent.confidence).toBe(0);
  });

  it('parseUserIntent detects subtasks from numbered list', () => {
    const intent = parseUserIntent('1. Design UI\n2. Implement backend\n3. Write tests');
    expect(intent.subtasks).toHaveLength(3);
    expect(intent.subtasks[0]).toBe('Design UI');
  });

  it('shouldAutoClassify returns true for high confidence', () => {
    const highConf = parseUserIntent('Build the authentication system for the Orbit app', {
      existingProjects: [makeProject({ id: 'p-orbit', title: 'Orbit App' })],
      existingMilestones: [],
      existingTasks: [],
    });
    expect(shouldAutoClassify(highConf)).toBe(true);
  });

  it('shouldAutoClassify returns false for low confidence', () => {
    const lowConf = parseUserIntent('hi');
    expect(shouldAutoClassify(lowConf)).toBe(false);
  });

  it('splitIntoSubtasks handles bullet lists', () => {
    const result = splitIntoSubtasks('- Task A\n- Task B\n- Task C');
    expect(result).toEqual(['Task A', 'Task B', 'Task C']);
  });

  it('splitIntoSubtasks handles "and then" patterns', () => {
    const result = splitIntoSubtasks('first do X and then do Y');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('first do X');
    expect(result[1]).toBe('do Y');
  });

  it('splitIntoSubtasks returns single item for plain text', () => {
    const result = splitIntoSubtasks('Just a single task');
    expect(result).toEqual(['Just a single task']);
  });

  it('suggestProject matches by keyword overlap', () => {
    const projects = [
      makeProject({ id: 'p1', title: 'Orbit App' }),
      makeProject({ id: 'p2', title: 'Marketing Website' }),
    ];
    const intent = parseUserIntent('Fix Orbit crash');
    const match = suggestProject(intent, projects);
    expect(match).toBe('p1');
  });

  it('suggestProject returns null when no match', () => {
    const projects = [makeProject({ id: 'p1', title: 'Orbit App' })];
    const intent = parseUserIntent('xyz zzz');
    expect(suggestProject(intent, projects)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════
// 4. Today Planner
// ════════════════════════════════════════════════════════════

describe('today-planner', () => {
  it('generateTodayPlan selects primary task', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Urgent', dueAt: '2025-07-17T12:00:00Z' }),
      makeTask({ id: 't2', title: 'Normal' }),
      makeTask({ id: 't3', title: 'Later' }),
    ];
    const plan = generateTodayPlan({
      readyTasks: tasks,
      blockedTasks: [],
      deadlineTasks: [tasks[0]],
      recentFocusHistory: [],
    });
    expect(plan.primary).not.toBeNull();
    expect(plan.alternatives.length).toBeLessThanOrEqual(2);
    expect(plan.scheduledBlocks.length).toBeGreaterThan(0);
  });

  it('generateTodayPlan handles empty input', () => {
    const plan = generateTodayPlan({
      readyTasks: [],
      blockedTasks: [],
      deadlineTasks: [],
      recentFocusHistory: [],
    });
    expect(plan.primary).toBeNull();
    expect(plan.alternatives).toHaveLength(0);
  });

  it('scoreTasks returns sorted scores', () => {
    const tasks = [
      makeTask({ id: 't1', dueAt: '2025-07-17T12:00:00Z', milestoneId: 'm1' }),
      makeTask({ id: 't2' }),
    ];
    const scores = scoreTasks(tasks);
    expect(scores.length).toBe(2);
    expect(scores[0].totalScore).toBeGreaterThanOrEqual(scores[1].totalScore);
  });

  it('scoreTasks respects energy level', () => {
    const complexTask = makeTask({ id: 't1', body: 'x'.repeat(200), completionDefinition: 'done when ...' });
    const simpleTask = makeTask({ id: 't2' });
    const highEnergy = scoreTasks([complexTask, simpleTask], undefined, 'high');
    expect(highEnergy[0].taskId).toBe('t1');

    const lowEnergy = scoreTasks([complexTask, simpleTask], undefined, 'low');
    expect(lowEnergy[0].taskId).toBe('t2');
  });
});

// ════════════════════════════════════════════════════════════
// 5. Focus Mode
// ════════════════════════════════════════════════════════════

describe('focus-mode', () => {
  it('buildFocusContext assembles context', () => {
    const task = makeTask({ id: 't1', projectId: 'p1', milestoneId: 'm1' });
    const project = makeProject({ id: 'p1' });
    const milestone = makeMilestone({ id: 'm1', projectId: 'p1' });
    const ctx = buildFocusContext(task, project, milestone, [
      { objectType: 'note', objectId: 'n1', title: 'Note 1' },
      { objectType: 'research_space', objectId: 'r1', title: 'Research 1' },
    ]);
    expect(ctx.task.id).toBe('t1');
    expect(ctx.parentProject?.id).toBe('p1');
    expect(ctx.parentMilestone?.id).toBe('m1');
    expect(ctx.relatedNotes).toContain('n1');
    expect(ctx.relatedResearch).toContain('r1');
  });

  it('getFocusMaterials returns materials from context', () => {
    const task = makeTask({ id: 't1', projectId: 'p1' });
    const project = makeProject({ id: 'p1' });
    const ctx = buildFocusContext(task, project, null, [
      { objectType: 'note', objectId: 'n1', title: 'Note' },
    ]);
    const materials = getFocusMaterials(ctx);
    expect(materials.length).toBeGreaterThanOrEqual(2);
    expect(materials.some((m) => m.objectType === 'project')).toBe(true);
    expect(materials.some((m) => m.objectType === 'note')).toBe(true);
  });

  it('startFocusSession creates an active session', () => {
    const task = makeTask({ id: 't1', completionDefinition: 'Ship it' });
    const ctx = buildFocusContext(task);
    const session = startFocusSession(task, ctx);
    expect(session.taskId).toBe('t1');
    expect(session.startedAt).toBeTruthy();
    expect(session.endedAt).toBeNull();
    expect(session.goalDescription).toBe('Ship it');
    expect(session.outcome).toBeNull();
  });

  it('endFocusSession marks session complete', () => {
    const task = makeTask({ id: 't1' });
    const ctx = buildFocusContext(task);
    const session = startFocusSession(task, ctx);
    const ended = endFocusSession(session, 'completed');
    expect(ended.endedAt).not.toBeNull();
    expect(ended.outcome).toBe('completed');
  });
});

// ════════════════════════════════════════════════════════════
// 6. Review System
// ════════════════════════════════════════════════════════════

describe('review-system', () => {
  it('templates have correct cycles', () => {
    expect(DAY_REVIEW_TEMPLATE.cycle).toBe('day');
    expect(WEEK_REVIEW_TEMPLATE.cycle).toBe('week');
    expect(PROJECT_REVIEW_TEMPLATE.cycle).toBe('month');
  });

  it('templates have required sections and prompt questions', () => {
    expect(DAY_REVIEW_TEMPLATE.requiredSections.length).toBeGreaterThan(0);
    expect(DAY_REVIEW_TEMPLATE.promptQuestions.length).toBeGreaterThan(0);
    expect(WEEK_REVIEW_TEMPLATE.requiredSections.length).toBeGreaterThan(0);
    expect(PROJECT_REVIEW_TEMPLATE.requiredSections.length).toBeGreaterThan(0);
  });

  it('buildReviewPrompt generates markdown', () => {
    const input = {
      cycle: 'day' as const,
      completedTasks: [makeTask({ id: 't1', status: 'done' })],
      blockedTasks: [],
      insights: ['Productive morning'],
      period: { start: '2025-07-17T00:00:00Z', end: '2025-07-17T23:59:59Z' },
    };
    const prompt = buildReviewPrompt(DAY_REVIEW_TEMPLATE, input);
    expect(prompt).toContain('Day Review');
    expect(prompt).toContain('Completed tasks: 1');
    expect(prompt).toContain('Productive morning');
  });

  it('createReview produces a Review object', () => {
    const input = {
      cycle: 'week' as const,
      completedTasks: [makeTask({ id: 't1', status: 'done' })],
      blockedTasks: [],
      insights: [],
      period: { start: '2025-07-14T00:00:00Z', end: '2025-07-17T23:59:59Z' },
    };
    const output = {
      decisions: ['Ship feature X'],
      observations: ['Team velocity up'],
      nextActions: ['Plan sprint'],
      updatedPriorities: ['Focus on performance'],
    };
    const review = createReview('week', input, output);
    expect(review.objectType).toBe('review');
    expect(review.cycle).toBe('week');
    expect(review.decisions).toContain('Ship feature X');
    expect(review.body).toContain('Ship feature X');
  });

  it('isDueForReview returns true when never reviewed', () => {
    expect(isDueForReview(null, 'day')).toBe(true);
  });

  it('isDueForReview returns true when overdue', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDueForReview(twoDaysAgo, 'day')).toBe(true);
  });

  it('isDueForReview returns false when just reviewed', () => {
    const justNow = new Date().toISOString();
    expect(isDueForReview(justNow, 'day')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
// 7. Next Thing Engine
// ════════════════════════════════════════════════════════════

describe('next-thing-engine', () => {
  it('filterCandidates excludes done/blocked/dropped', () => {
    const tasks = [
      makeTask({ id: 't1', status: 'ready' }),
      makeTask({ id: 't2', status: 'done' }),
      makeTask({ id: 't3', status: 'blocked' }),
      makeTask({ id: 't4', status: 'dropped' }),
      makeTask({ id: 't5', status: 'scheduled' }),
    ];
    const filtered = filterCandidates(tasks, {
      availableMinutes: 120,
      energyLevel: 'medium',
      currentContext: null,
    });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id)).toContain('t1');
    expect(filtered.map((t) => t.id)).toContain('t5');
  });

  it('computeNextThing selects primary and alternatives', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Important', milestoneId: 'm1', dueAt: '2025-07-18T10:00:00Z' }),
      makeTask({ id: 't2', title: 'Normal', status: 'ready' }),
      makeTask({ id: 't3', title: 'Also ready', status: 'scheduled' }),
    ];
    const result = computeNextThing({
      candidateTasks: tasks,
      constraints: { availableMinutes: 120, energyLevel: 'high', currentContext: null },
      recentHistory: [],
    });
    expect(result.primary).toBeDefined();
    expect(result.primary.task).toBeDefined();
    expect(result.alternatives.length).toBeLessThanOrEqual(2);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('computeNextThing throws for empty candidates', () => {
    expect(() =>
      computeNextThing({
        candidateTasks: [makeTask({ id: 't1', status: 'done' })],
        constraints: { availableMinutes: 60, energyLevel: 'low', currentContext: null },
        recentHistory: [],
      }),
    ).toThrow('No eligible tasks');
  });

  it('explainChoice produces human-readable text', () => {
    const task = makeTask({ id: 't1', title: 'Deploy' });
    const scores = { taskId: 't1', urgency: 0.9, benefit: 0.8, contextSwitchCost: 0.5, energyFit: 0.6, total: 0.75 };
    const explanation = explainChoice(task, scores);
    expect(explanation).toContain('Deploy');
    expect(explanation).toContain('0.75');
  });
});

// ════════════════════════════════════════════════════════════
// 8. Support Links
// ════════════════════════════════════════════════════════════

describe('support-links', () => {
  it('createSupportLink creates a link', () => {
    const link = createSupportLink('t1', 'article', 'a1', 'reading_material', 'Very relevant');
    expect(link.taskOrProjectId).toBe('t1');
    expect(link.materialObjectType).toBe('article');
    expect(link.materialObjectId).toBe('a1');
    expect(link.kind).toBe('reading_material');
    expect(link.relevanceNote).toBe('Very relevant');
    expect(link.addedAt).toBeTruthy();
  });

  it('createSupportLink defaults note to null', () => {
    const link = createSupportLink('t1', 'article', 'a1', 'research_reference');
    expect(link.relevanceNote).toBeNull();
  });

  it('getSupportLinks filters by task', () => {
    const links = [
      createSupportLink('t1', 'article', 'a1', 'reading_material'),
      createSupportLink('t2', 'note', 'n1', 'writing_output'),
      createSupportLink('t1', 'book', 'b1', 'research_reference'),
    ];
    const result = getSupportLinks(links, 't1');
    expect(result).toHaveLength(2);
  });

  it('getTasksForMaterial performs reverse lookup', () => {
    const links = [
      createSupportLink('t1', 'article', 'a1', 'reading_material'),
      createSupportLink('t2', 'article', 'a1', 'reading_material'),
      createSupportLink('t3', 'book', 'b1', 'research_reference'),
    ];
    const result = getTasksForMaterial(links, 'a1');
    expect(result).toHaveLength(2);
  });

  it('summarizeSupportLinks counts by kind', () => {
    const links = [
      createSupportLink('t1', 'article', 'a1', 'reading_material'),
      createSupportLink('t1', 'article', 'a2', 'reading_material'),
      createSupportLink('t1', 'note', 'n1', 'writing_output'),
      createSupportLink('t1', 'thread', 'th1', 'discussion_thread'),
    ];
    const summary = summarizeSupportLinks(links);
    expect(summary.reading_material).toBe(2);
    expect(summary.research_reference).toBe(0);
    expect(summary.writing_output).toBe(1);
    expect(summary.discussion_thread).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════
// 9. Confirmation Gates
// ════════════════════════════════════════════════════════════

describe('confirmation-gates', () => {
  it('CONFIRMATION_REQUIRED_ACTIONS contains all 7 actions', () => {
    expect(CONFIRMATION_REQUIRED_ACTIONS.size).toBe(7);
    expect(CONFIRMATION_REQUIRED_ACTIONS.has('upgrade_to_project')).toBe(true);
    expect(CONFIRMATION_REQUIRED_ACTIONS.has('delete_permanent')).toBe(true);
    expect(CONFIRMATION_REQUIRED_ACTIONS.has('external_publish')).toBe(true);
  });

  it('requiresConfirmation returns true for all listed actions', () => {
    expect(requiresConfirmation('upgrade_to_project')).toBe(true);
    expect(requiresConfirmation('rewrite_vision')).toBe(true);
    expect(requiresConfirmation('modify_directive')).toBe(true);
    expect(requiresConfirmation('cross_project_reorder')).toBe(true);
    expect(requiresConfirmation('milestone_change')).toBe(true);
    expect(requiresConfirmation('delete_permanent')).toBe(true);
    expect(requiresConfirmation('external_publish')).toBe(true);
  });

  it('createConfirmationGate produces a gate object', () => {
    const gate = createConfirmationGate('delete_permanent', ['t1', 't2'], 'Destructive action');
    expect(gate.action).toBe('delete_permanent');
    expect(gate.affectedObjects).toEqual(['t1', 't2']);
    expect(gate.reasoning).toBe('Destructive action');
    expect(gate.suggestedBy).toBe('agent');
  });

  it('resolveGate with approved decision', () => {
    const gate = createConfirmationGate('rewrite_vision', ['v1'], 'Major change');
    const resolution = resolveGate(gate, 'approved');
    expect(resolution.decision).toBe('approved');
    expect(resolution.modifiedPayload).toBeNull();
    expect(resolution.resolvedAt).toBeTruthy();
  });

  it('resolveGate with modified decision includes payload', () => {
    const gate = createConfirmationGate('modify_directive', ['d1'], 'Updated scope');
    const resolution = resolveGate(gate, 'modified', { newScope: 'quarter' });
    expect(resolution.decision).toBe('modified');
    expect(resolution.modifiedPayload).toEqual({ newScope: 'quarter' });
  });
});

// ════════════════════════════════════════════════════════════
// 10. Event State Tracker
// ════════════════════════════════════════════════════════════

describe('event-state-tracker', () => {
  it('recordTaskEvent creates an event', () => {
    const event = recordTaskEvent('t1', 'status_changed', {
      previousStatus: 'captured',
      newStatus: 'ready',
    });
    expect(event.taskId).toBe('t1');
    expect(event.eventType).toBe('status_changed');
    expect(event.previousStatus).toBe('captured');
    expect(event.newStatus).toBe('ready');
    expect(event.id).toBeTruthy();
  });

  it('recordTaskEvent defaults to user actor', () => {
    const event = recordTaskEvent('t1', 'commented');
    expect(event.actorType).toBe('user');
    expect(event.previousStatus).toBeNull();
  });

  it('rebuildTaskStatus derives status from events', () => {
    const events = [
      recordTaskEvent('t1', 'status_changed', { previousStatus: null, newStatus: 'captured' }),
      recordTaskEvent('t1', 'status_changed', { previousStatus: 'captured', newStatus: 'ready' }),
      recordTaskEvent('t1', 'commented'),
      recordTaskEvent('t1', 'status_changed', { previousStatus: 'ready', newStatus: 'scheduled' }),
    ];
    expect(rebuildTaskStatus(events)).toBe('scheduled');
  });

  it('rebuildTaskStatus returns captured when no status events', () => {
    const events = [recordTaskEvent('t1', 'commented')];
    expect(rebuildTaskStatus(events)).toBe('captured');
  });

  it('getTaskHistory filters by taskId and sorts', () => {
    const events = [
      recordTaskEvent('t1', 'status_changed', { newStatus: 'ready' }),
      recordTaskEvent('t2', 'commented'),
      recordTaskEvent('t1', 'commented'),
    ];
    const history = getTaskHistory(events, 't1');
    expect(history).toHaveLength(2);
    expect(history.every((e) => e.taskId === 't1')).toBe(true);
  });

  it('getStatusDuration calculates time in status', () => {
    const baseTime = new Date('2025-07-17T10:00:00Z').getTime();
    const events = [
      {
        id: 'e1', taskId: 't1', eventType: 'status_changed' as const,
        previousStatus: null, newStatus: 'ready' as TaskStatus,
        timestamp: new Date(baseTime).toISOString(),
        actorType: 'user' as const, metadata: null,
      },
      {
        id: 'e2', taskId: 't1', eventType: 'status_changed' as const,
        previousStatus: 'ready' as TaskStatus, newStatus: 'scheduled' as TaskStatus,
        timestamp: new Date(baseTime + 3600000).toISOString(),
        actorType: 'user' as const, metadata: null,
      },
    ];
    const duration = getStatusDuration(events, 'ready');
    // Should be approximately 1 hour (3600000 ms)
    expect(duration).toBeGreaterThanOrEqual(3600000 - 100);
    expect(duration).toBeLessThanOrEqual(3600000 + 100);
  });
});
