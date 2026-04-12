import type { Task, Project, Milestone, IsoDateTimeString } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export type FocusOutcome = 'completed' | 'paused' | 'blocked' | 'abandoned';

export interface FocusMaterial {
  readonly objectType: string;
  readonly objectId: string;
  readonly title: string;
  readonly relevance: string;
}

export interface FocusSession {
  readonly taskId: string;
  readonly startedAt: IsoDateTimeString;
  readonly endedAt: IsoDateTimeString | null;
  readonly goalDescription: string;
  readonly materials: readonly FocusMaterial[];
  readonly outputTarget: string | null;
  readonly outcome: FocusOutcome | null;
}

export interface FocusContext {
  readonly task: Task;
  readonly parentMilestone: Milestone | null;
  readonly parentProject: Project | null;
  readonly relatedNotes: readonly string[];
  readonly relatedResearch: readonly string[];
  readonly reviewHistory: readonly string[];
}

export interface RelatedObject {
  readonly objectType: string;
  readonly objectId: string;
  readonly title: string;
}

// ── Functions ──────────────────────────────────────────────

export function buildFocusContext(
  task: Task,
  project?: Project | null,
  milestone?: Milestone | null,
  relatedObjects?: readonly RelatedObject[],
): FocusContext {
  const notes: string[] = [];
  const research: string[] = [];

  if (relatedObjects) {
    for (const obj of relatedObjects) {
      if (obj.objectType === 'note') notes.push(obj.objectId);
      else if (obj.objectType === 'research_space' || obj.objectType === 'research_question') {
        research.push(obj.objectId);
      }
    }
  }

  return {
    task,
    parentMilestone: milestone ?? null,
    parentProject: project ?? null,
    relatedNotes: notes,
    relatedResearch: research,
    reviewHistory: [],
  };
}

export function getFocusMaterials(context: FocusContext): readonly FocusMaterial[] {
  const materials: FocusMaterial[] = [];

  if (context.parentProject) {
    materials.push({
      objectType: 'project',
      objectId: context.parentProject.id,
      title: context.parentProject.title,
      relevance: 'Parent project providing overall context.',
    });
  }

  if (context.parentMilestone) {
    materials.push({
      objectType: 'milestone',
      objectId: context.parentMilestone.id,
      title: context.parentMilestone.title,
      relevance: 'Target milestone for this task.',
    });
  }

  for (const noteId of context.relatedNotes) {
    materials.push({
      objectType: 'note',
      objectId: noteId,
      title: `Note ${noteId}`,
      relevance: 'Related reference note.',
    });
  }

  for (const researchId of context.relatedResearch) {
    materials.push({
      objectType: 'research',
      objectId: researchId,
      title: `Research ${researchId}`,
      relevance: 'Related research material.',
    });
  }

  return materials;
}

export function startFocusSession(
  task: Task,
  context: FocusContext,
): FocusSession {
  const now = new Date().toISOString() as IsoDateTimeString;
  const materials = getFocusMaterials(context);

  return {
    taskId: task.id,
    startedAt: now,
    endedAt: null,
    goalDescription: task.completionDefinition ?? `Complete: ${task.title}`,
    materials,
    outputTarget: null,
    outcome: null,
  };
}

export function endFocusSession(
  session: FocusSession,
  outcome: FocusOutcome,
): FocusSession {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    ...session,
    endedAt: now,
    outcome,
  };
}
