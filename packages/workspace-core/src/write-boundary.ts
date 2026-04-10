// ---------------------------------------------------------------------------
// write-boundary.ts — AI write boundary guard
// Source: doc 13 §3.7
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WriteTarget = 'sources' | 'wiki' | 'orbit_system';
export type WritePermission = 'read_only' | 'ai_writable' | 'system_only';
export type ActorKind = 'human' | 'ai' | 'system';

export interface WritePermissionCheck {
  readonly target: WriteTarget;
  readonly actor: ActorKind;
  readonly permission: WritePermission;
  readonly allowed: boolean;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// AI write rules (doc 13 §3.7A / §3.7B)
// ---------------------------------------------------------------------------

export const AI_WRITE_RULES = {
  sources: {
    permission: 'read_only' as WritePermission,
    description:
      'User-owned portable original assets. AI CANNOT modify source body text, ' +
      'user frontmatter primary fields, or write unconfirmed external fetch results as user truth.',
  },
  wiki: {
    permission: 'ai_writable' as WritePermission,
    description:
      'AI compile layer. AI CAN create, update, and archive: entity pages, concept pages, ' +
      'dossiers, comparisons, syntheses, briefs, reports. All writes must include compile provenance frontmatter.',
  },
  orbit_system: {
    permission: 'system_only' as WritePermission,
    description:
      'Orbit internal system layer. Only system operations (DB migrations, index rebuilds, ' +
      'sync state, cache management) may write here.',
  },
} as const;

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

const PERMISSION_MATRIX: Record<WriteTarget, Record<ActorKind, boolean>> = {
  sources: { human: true, ai: false, system: false },
  wiki: { human: true, ai: true, system: true },
  orbit_system: { human: false, ai: false, system: true },
};

const DENIAL_REASONS: Record<WriteTarget, Record<ActorKind, string>> = {
  sources: {
    human: '',
    ai: 'AI cannot modify user source files (sources/ is AI read-only)',
    system: 'System processes should not write to sources/',
  },
  wiki: {
    human: '',
    ai: '',
    system: '',
  },
  orbit_system: {
    human: 'Human actors should not write directly to .orbit/ system files',
    ai: 'AI cannot write directly to .orbit/ system internals',
    system: '',
  },
};

// ---------------------------------------------------------------------------
// Permission check
// ---------------------------------------------------------------------------

export function checkWritePermission(
  target: WriteTarget,
  actor: ActorKind,
): WritePermissionCheck {
  const allowed = PERMISSION_MATRIX[target][actor];
  const reason = allowed
    ? `${actor} is permitted to write to ${target}`
    : DENIAL_REASONS[target][actor];

  return {
    target,
    actor,
    permission: AI_WRITE_RULES[target].permission,
    allowed,
    reason,
  };
}

/**
 * Infer the WriteTarget from a relative file path within the workspace.
 */
export function inferWriteTarget(relativePath: string): WriteTarget {
  if (relativePath.startsWith('sources/') || relativePath === 'sources') {
    return 'sources';
  }
  if (relativePath.startsWith('wiki/') || relativePath === 'wiki') {
    return 'wiki';
  }
  if (relativePath.startsWith('.orbit/') || relativePath === '.orbit') {
    return 'orbit_system';
  }
  // Default to sources for unknown paths (safest default = most restrictive)
  return 'sources';
}
