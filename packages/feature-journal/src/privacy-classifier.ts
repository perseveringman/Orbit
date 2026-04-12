import type { PrivacyLevel, AgentAccess } from '@orbit/domain';

// ── Keyword lists ──────────────────────────────────────────

export const PrivacyKeywords = {
  sensitive: [
    'password',
    'secret',
    'private',
    'confidential',
    'personal',
    'salary',
    'medical',
    'health',
    'diagnosis',
    'therapy',
    'ssn',
    'social security',
    'credit card',
    'bank account',
    'financial',
  ] as readonly string[],
  sealed: [
    'sealed',
    'top secret',
    'classified',
    'restricted access',
    'eyes only',
    'attorney-client',
    'legally privileged',
    'nda',
    'non-disclosure',
  ] as readonly string[],
} as const;

// ── Classifier ─────────────────────────────────────────────

export function classifyPrivacy(content: string): PrivacyLevel {
  const lower = content.toLowerCase();

  for (const keyword of PrivacyKeywords.sealed) {
    if (lower.includes(keyword)) {
      return 'sealed';
    }
  }

  for (const keyword of PrivacyKeywords.sensitive) {
    if (lower.includes(keyword)) {
      return 'sensitive';
    }
  }

  return 'normal';
}

// ── Agent access derivation ────────────────────────────────

export function deriveAgentAccess(privacyLevel: PrivacyLevel): AgentAccess {
  switch (privacyLevel) {
    case 'sealed':
      return 'deny';
    case 'sensitive':
      return 'summary_only';
    case 'normal':
      return 'full_local_only';
  }
}

// ── Privacy override ───────────────────────────────────────

export interface PrivacyOverride {
  readonly level: PrivacyLevel;
  readonly reason: string;
  readonly overriddenBy: string;
  readonly overriddenAt: string;
}

export function applyPrivacyOverride(
  autoClassified: PrivacyLevel,
  override: PrivacyOverride | null,
): PrivacyLevel {
  if (override === null) {
    return autoClassified;
  }
  return override.level;
}

// ── Access check ───────────────────────────────────────────

export function canAgentAccess(
  privacyLevel: PrivacyLevel,
  agentAccess: AgentAccess,
  requestType: 'read' | 'summarize' | 'full',
): boolean {
  if (privacyLevel === 'sealed') {
    return false;
  }

  switch (agentAccess) {
    case 'deny':
      return false;
    case 'summary_only':
      return requestType === 'summarize';
    case 'full_local_only':
      return true;
  }
}
