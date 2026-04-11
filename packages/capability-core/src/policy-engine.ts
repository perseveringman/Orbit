// ---------------------------------------------------------------------------
// @orbit/capability-core – Policy Engine (Wave 2-C)
// ---------------------------------------------------------------------------

import type { ApprovalLevel, CapabilityDefinition } from './capability-interface.js';

export interface PolicyContext {
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly surface: string;
  readonly dataLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  readonly userRole: 'owner' | 'editor' | 'viewer';
}

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly requiredApproval?: ApprovalLevel;
  readonly egressAllowed?: boolean;
}

export interface PolicyRule {
  readonly id: string;
  readonly description: string;
  readonly evaluate: (capability: CapabilityDefinition, context: PolicyContext) => PolicyDecision | null;
}

export interface PolicyEngine {
  addRule(rule: PolicyRule): void;
  removeRule(ruleId: string): boolean;
  evaluate(capability: CapabilityDefinition, context: PolicyContext): PolicyDecision;
  getRules(): readonly PolicyRule[];
}

// ---- Default rules ----

const viewerDeniedRule: PolicyRule = {
  id: 'scope-check',
  description: 'Viewers cannot invoke write/execute capabilities',
  evaluate(capability, context) {
    if (context.userRole === 'viewer' && capability.risk !== 'R0') {
      return { allowed: false, reason: 'Viewers can only invoke read-only (R0) capabilities' };
    }
    return null;
  },
};

const workspaceBoundaryRule: PolicyRule = {
  id: 'workspace-boundary',
  description: 'External exposure requires owner or editor role',
  evaluate(capability, context) {
    if (capability.exposure === 'external' && context.userRole === 'viewer') {
      return { allowed: false, reason: 'External capabilities require owner or editor role' };
    }
    return null;
  },
};

const dataLevelRule: PolicyRule = {
  id: 'data-level-check',
  description: 'Restricted data requires R0 risk and no egress',
  evaluate(capability, context) {
    if (context.dataLevel === 'restricted') {
      if (capability.risk !== 'R0' || capability.egress !== 'none') {
        return {
          allowed: false,
          reason: 'Restricted data requires read-only risk with no egress',
          egressAllowed: false,
        };
      }
    }
    if (context.dataLevel === 'confidential' && capability.egress === 'full_content') {
      return {
        allowed: false,
        reason: 'Confidential data does not allow full content egress',
        egressAllowed: false,
      };
    }
    return null;
  },
};

const egressRule: PolicyRule = {
  id: 'egress-check',
  description: 'Full content egress requires A2+ approval',
  evaluate(capability, _context) {
    if (capability.egress === 'full_content') {
      const minApproval: ApprovalLevel = 'A2';
      if (capability.approval < minApproval) {
        return {
          allowed: false,
          reason: 'Full content egress requires at least A2 approval',
          requiredApproval: minApproval,
          egressAllowed: false,
        };
      }
    }
    return null;
  },
};

export function createPolicyEngine(): PolicyEngine {
  const rules = new Map<string, PolicyRule>();

  // Load default rules
  for (const rule of [viewerDeniedRule, workspaceBoundaryRule, dataLevelRule, egressRule]) {
    rules.set(rule.id, rule);
  }

  return {
    addRule(rule: PolicyRule): void {
      rules.set(rule.id, rule);
    },

    removeRule(ruleId: string): boolean {
      return rules.delete(ruleId);
    },

    evaluate(capability: CapabilityDefinition, context: PolicyContext): PolicyDecision {
      for (const rule of rules.values()) {
        const decision = rule.evaluate(capability, context);
        if (decision !== null && !decision.allowed) {
          return decision;
        }
      }
      return { allowed: true, egressAllowed: capability.egress !== 'none' };
    },

    getRules(): readonly PolicyRule[] {
      return [...rules.values()];
    },
  };
}
