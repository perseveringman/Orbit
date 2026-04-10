import type { IsoDateTimeString, IsoDateString, DecisionMode } from './common.js';

// ── Project ────────────────────────────────────────────────

export type ProjectStatus =
  | 'active'
  | 'paused'
  | 'done'
  | 'archived';

export type ProjectAlignment =
  | 'aligned_to_vision'
  | 'maintenance'
  | 'opportunistic';

export interface Project {
  readonly objectType: 'project';
  readonly id: string;
  readonly title: string;
  readonly status: ProjectStatus;
  readonly alignment: ProjectAlignment | null;
  readonly visionId: string | null;
  readonly themeId: string | null;
  readonly goalId: string | null;
  readonly decisionMode: DecisionMode | null;
  readonly lastReviewedAt: IsoDateTimeString | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Milestone ──────────────────────────────────────────────

export type MilestoneStatus =
  | 'planned'
  | 'active'
  | 'done'
  | 'dropped';

export interface Milestone {
  readonly objectType: 'milestone';
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: MilestoneStatus;
  readonly dueAt: IsoDateTimeString | null;
  readonly completionDefinition: string | null;
  readonly sortOrder: number;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Task ───────────────────────────────────────────────────

export type TaskStatus =
  | 'captured'
  | 'clarifying'
  | 'ready'
  | 'scheduled'
  | 'focused'
  | 'done'
  | 'blocked'
  | 'dropped';

export interface Task {
  readonly objectType: 'task';
  readonly id: string;
  readonly projectId: string | null;
  readonly milestoneId: string | null;
  readonly parentId: string | null;
  readonly title: string;
  readonly body: string | null;
  readonly status: TaskStatus;
  readonly completionDefinition: string | null;
  readonly todayOn: IsoDateString | null;
  readonly focusRank: number | null;
  readonly dueAt: IsoDateTimeString | null;
  readonly completedAt: IsoDateTimeString | null;
  readonly lastReviewedAt: IsoDateTimeString | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── Directive ──────────────────────────────────────────────

export type DirectiveStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived';

export type DirectiveScope =
  | 'month'
  | 'quarter'
  | 'phase';

export interface Directive {
  readonly objectType: 'directive';
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly status: DirectiveStatus;
  readonly scope: DirectiveScope | null;
  readonly visionId: string | null;
  readonly decisionMode: DecisionMode;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
