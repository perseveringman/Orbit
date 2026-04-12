import type { Vision, VisionVersion } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export type VisionVisibility = 'local_only' | 'cloud_summary' | 'cloud_full';

export type AgentAccessLevel = 'none' | 'summary_only' | 'full';

export type SyncPolicy = 'never' | 'summary_only' | 'full';

export interface PrivacyPolicy {
  readonly defaultVisibility: VisionVisibility;
  readonly syncPolicy: SyncPolicy;
  readonly agentAccessLevel: AgentAccessLevel;
}

export interface UserPrivacyPreference {
  readonly visibility?: VisionVisibility;
  readonly syncPolicy?: SyncPolicy;
  readonly agentAccessLevel?: AgentAccessLevel;
}

export interface FilteredVisionData {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly status: string;
  readonly bodyMarkdown: string | null;
  readonly summaryForAgent: string | null;
}

// ── Defaults ───────────────────────────────────────────────

const DEFAULT_POLICY: PrivacyPolicy = {
  defaultVisibility: 'local_only',
  syncPolicy: 'summary_only',
  agentAccessLevel: 'summary_only',
};

// ── Functions ──────────────────────────────────────────────

export function getEffectivePrivacy(
  _vision: Vision,
  userPreference: UserPrivacyPreference | null,
): PrivacyPolicy {
  if (!userPreference) return DEFAULT_POLICY;

  return {
    defaultVisibility: userPreference.visibility ?? DEFAULT_POLICY.defaultVisibility,
    syncPolicy: userPreference.syncPolicy ?? DEFAULT_POLICY.syncPolicy,
    agentAccessLevel: userPreference.agentAccessLevel ?? DEFAULT_POLICY.agentAccessLevel,
  };
}

export function filterForSync(
  vision: Vision,
  version: VisionVersion | null,
  policy: PrivacyPolicy,
): FilteredVisionData {
  if (policy.syncPolicy === 'never') {
    return {
      id: vision.id,
      title: vision.title,
      scope: vision.scope,
      status: vision.status,
      bodyMarkdown: null,
      summaryForAgent: null,
    };
  }

  if (policy.syncPolicy === 'summary_only') {
    return {
      id: vision.id,
      title: vision.title,
      scope: vision.scope,
      status: vision.status,
      bodyMarkdown: null,
      summaryForAgent: version?.summaryForAgent ?? null,
    };
  }

  // full
  return {
    id: vision.id,
    title: vision.title,
    scope: vision.scope,
    status: vision.status,
    bodyMarkdown: version?.bodyMarkdown ?? null,
    summaryForAgent: version?.summaryForAgent ?? null,
  };
}

export function filterForAgent(
  vision: Vision,
  version: VisionVersion | null,
  policy: PrivacyPolicy,
): FilteredVisionData {
  if (policy.agentAccessLevel === 'none') {
    return {
      id: vision.id,
      title: vision.title,
      scope: vision.scope,
      status: vision.status,
      bodyMarkdown: null,
      summaryForAgent: null,
    };
  }

  if (policy.agentAccessLevel === 'summary_only') {
    return {
      id: vision.id,
      title: vision.title,
      scope: vision.scope,
      status: vision.status,
      bodyMarkdown: null,
      summaryForAgent: version?.summaryForAgent ?? null,
    };
  }

  // full
  return {
    id: vision.id,
    title: vision.title,
    scope: vision.scope,
    status: vision.status,
    bodyMarkdown: version?.bodyMarkdown ?? null,
    summaryForAgent: version?.summaryForAgent ?? null,
  };
}

export { DEFAULT_POLICY };
