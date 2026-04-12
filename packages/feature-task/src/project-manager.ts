import type {
  Project,
  ProjectStatus,
  ProjectAlignment,
  Milestone,
  MilestoneStatus,
  Task,
  IsoDateTimeString,
  DecisionMode,
} from '@orbit/domain';

// ── Interfaces ─────────────────────────────────────────────

export interface CreateProjectInput {
  readonly id: string;
  readonly title: string;
  readonly ownerUserId: string;
  readonly status?: ProjectStatus;
  readonly alignment?: ProjectAlignment | null;
  readonly visionId?: string | null;
  readonly themeId?: string | null;
  readonly goalId?: string | null;
  readonly decisionMode?: DecisionMode | null;
}

export interface UpdateProjectInput {
  readonly title?: string;
  readonly status?: ProjectStatus;
  readonly alignment?: ProjectAlignment | null;
  readonly visionId?: string | null;
  readonly themeId?: string | null;
  readonly goalId?: string | null;
  readonly decisionMode?: DecisionMode | null;
}

export interface ProjectManager {
  readonly createProject: (input: CreateProjectInput) => Project;
  readonly updateProject: (project: Project, updates: UpdateProjectInput) => Project;
  readonly archiveProject: (project: Project) => Project;
  readonly listProjects: (projects: readonly Project[], status?: ProjectStatus) => readonly Project[];
  readonly getProjectProgress: (milestones: readonly Milestone[], tasks: readonly Task[]) => ProjectProgress;
}

export interface CreateMilestoneInput {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly dueAt?: IsoDateTimeString | null;
}

export interface MilestoneManager {
  readonly createMilestone: (input: CreateMilestoneInput) => Milestone;
  readonly updateMilestone: (milestone: Milestone, updates: Partial<Pick<Milestone, 'title' | 'description' | 'dueAt' | 'completionDefinition'>>) => Milestone;
  readonly completeMilestone: (milestone: Milestone) => Milestone;
  readonly dropMilestone: (milestone: Milestone) => Milestone;
  readonly listByProject: (milestones: readonly Milestone[], projectId: string) => readonly Milestone[];
  readonly reorder: (milestones: readonly Milestone[], orderedIds: readonly string[]) => readonly Milestone[];
}

export interface ProjectProgress {
  readonly totalMilestones: number;
  readonly completedMilestones: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly percentComplete: number;
}

export interface ProjectHierarchyNode {
  readonly project: Project;
  readonly milestones: readonly MilestoneNode[];
  readonly unassignedTasks: readonly Task[];
}

export interface MilestoneNode {
  readonly milestone: Milestone;
  readonly tasks: readonly Task[];
}

// ── Factory functions ──────────────────────────────────────

export function createProject(input: CreateProjectInput): Project {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    objectType: 'project',
    id: input.id,
    title: input.title,
    status: input.status ?? 'active',
    alignment: input.alignment ?? null,
    visionId: input.visionId ?? null,
    themeId: input.themeId ?? null,
    goalId: input.goalId ?? null,
    decisionMode: input.decisionMode ?? null,
    lastReviewedAt: null,
    ownerUserId: input.ownerUserId,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProject(project: Project, updates: UpdateProjectInput): Project {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    ...project,
    ...updates,
    updatedAt: now,
  };
}

export function archiveProject(project: Project): Project {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    ...project,
    status: 'archived' as ProjectStatus,
    updatedAt: now,
  };
}

export function listProjects(
  projects: readonly Project[],
  status?: ProjectStatus,
): readonly Project[] {
  if (status === undefined) return projects;
  return projects.filter((p) => p.status === status);
}

export function createMilestone(input: CreateMilestoneInput): Milestone {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    objectType: 'milestone',
    id: input.id,
    projectId: input.projectId,
    title: input.title,
    description: input.description ?? null,
    status: 'planned',
    dueAt: input.dueAt ?? null,
    completionDefinition: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateMilestone(
  milestone: Milestone,
  updates: Partial<Pick<Milestone, 'title' | 'description' | 'dueAt' | 'completionDefinition'>>,
): Milestone {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    ...milestone,
    ...updates,
    updatedAt: now,
  };
}

export function completeMilestone(milestone: Milestone): Milestone {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    ...milestone,
    status: 'done' as MilestoneStatus,
    updatedAt: now,
  };
}

export function dropMilestone(milestone: Milestone): Milestone {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    ...milestone,
    status: 'dropped' as MilestoneStatus,
    updatedAt: now,
  };
}

export function listMilestonesByProject(
  milestones: readonly Milestone[],
  projectId: string,
): readonly Milestone[] {
  return milestones
    .filter((m) => m.projectId === projectId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function reorderMilestones(
  milestones: readonly Milestone[],
  orderedIds: readonly string[],
): readonly Milestone[] {
  const now = new Date().toISOString() as IsoDateTimeString;
  const byId = new Map(milestones.map((m) => [m.id, m]));
  return orderedIds
    .map((id, index) => {
      const m = byId.get(id);
      if (!m) return null;
      return { ...m, sortOrder: index, updatedAt: now } as Milestone;
    })
    .filter((m): m is Milestone => m !== null);
}

// ── Progress calculation ───────────────────────────────────

export function calculateProjectProgress(
  milestones: readonly Milestone[],
  tasks: readonly Task[],
): ProjectProgress {
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.status === 'done').length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const percentComplete = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    totalMilestones,
    completedMilestones,
    totalTasks,
    completedTasks,
    percentComplete,
  };
}

// ── Hierarchy ──────────────────────────────────────────────

export function getProjectHierarchy(
  project: Project,
  milestones: readonly Milestone[],
  tasks: readonly Task[],
): ProjectHierarchyNode {
  const projectMilestones = milestones
    .filter((m) => m.projectId === project.id)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const milestoneIds = new Set(projectMilestones.map((m) => m.id));

  const milestoneNodes: readonly MilestoneNode[] = projectMilestones.map((milestone) => ({
    milestone,
    tasks: tasks.filter((t) => t.milestoneId === milestone.id),
  }));

  const unassignedTasks = tasks.filter(
    (t) => t.projectId === project.id && (t.milestoneId === null || !milestoneIds.has(t.milestoneId)),
  );

  return { project, milestones: milestoneNodes, unassignedTasks };
}
