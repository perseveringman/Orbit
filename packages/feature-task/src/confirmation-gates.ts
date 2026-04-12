import type { IsoDateTimeString } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export type ConfirmationAction =
  | 'upgrade_to_project'
  | 'rewrite_vision'
  | 'modify_directive'
  | 'cross_project_reorder'
  | 'milestone_change'
  | 'delete_permanent'
  | 'external_publish';

export type GateDecision = 'approved' | 'rejected' | 'modified';

export interface ConfirmationGate {
  readonly action: ConfirmationAction;
  readonly description: string;
  readonly affectedObjects: readonly string[];
  readonly suggestedBy: string;
  readonly reasoning: string;
  readonly createdAt: IsoDateTimeString;
}

export interface GateResolution {
  readonly gate: ConfirmationGate;
  readonly decision: GateDecision;
  readonly modifiedPayload: unknown | null;
  readonly resolvedAt: IsoDateTimeString;
}

// ── Constants ──────────────────────────────────────────────

export const CONFIRMATION_REQUIRED_ACTIONS: ReadonlySet<ConfirmationAction> = new Set<ConfirmationAction>([
  'upgrade_to_project',
  'rewrite_vision',
  'modify_directive',
  'cross_project_reorder',
  'milestone_change',
  'delete_permanent',
  'external_publish',
]);

// ── Functions ──────────────────────────────────────────────

export function requiresConfirmation(action: ConfirmationAction): boolean {
  return CONFIRMATION_REQUIRED_ACTIONS.has(action);
}

export function createConfirmationGate(
  action: ConfirmationAction,
  affectedObjects: readonly string[],
  reasoning: string,
): ConfirmationGate {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    action,
    description: `Confirmation required: ${action.replace(/_/g, ' ')}`,
    affectedObjects,
    suggestedBy: 'agent',
    reasoning,
    createdAt: now,
  };
}

export function resolveGate(
  gate: ConfirmationGate,
  decision: GateDecision,
  modifiedPayload?: unknown,
): GateResolution {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    gate,
    decision,
    modifiedPayload: modifiedPayload ?? null,
    resolvedAt: now,
  };
}
