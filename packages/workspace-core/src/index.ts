import type { DomainObject, OrbitObjectKind } from '@orbit/domain';

export const WORKSPACE_VIEW_IDS = ['projects', 'tasks', 'today', 'focus', 'review'] as const;

export type WorkspaceViewId = (typeof WORKSPACE_VIEW_IDS)[number];
export type WorkspaceRole = 'owner' | 'editor' | 'reader';

export interface WorkspaceDescriptor {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly defaultView: WorkspaceViewId;
}

export interface WorkspaceMembership {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceRole;
}

export interface WorkspaceSelection {
  readonly kind: OrbitObjectKind;
  readonly id: string;
}

export interface WorkspaceSnapshot {
  readonly workspace: WorkspaceDescriptor;
  readonly members: readonly WorkspaceMembership[];
  readonly objects: readonly DomainObject[];
  readonly selected: WorkspaceSelection | null;
  readonly lastHydratedAt: string;
}

export interface WorkspaceGateway {
  hydrate(workspaceId: string): Promise<WorkspaceSnapshot>;
  saveSelection(workspaceId: string, selection: WorkspaceSelection | null): Promise<void>;
}

export function createWorkspaceSelection(kind: OrbitObjectKind, id: string): WorkspaceSelection {
  return { kind, id };
}

export function makeWorkspaceCacheKey(workspaceId: string, viewId: WorkspaceViewId): string {
  return `workspace:${workspaceId}:view:${viewId}`;
}
