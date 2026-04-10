// ---------------------------------------------------------------------------
// @orbit/agent-core – Safety Gate
// ---------------------------------------------------------------------------

import type {
  AgentSurface,
  ApprovalPolicy,
  RiskLevel,
  ScopeLimit,
  ToolDefinition,
} from './types.js';
import { RISK_LEVELS, SCOPE_LIMITS } from './types.js';

// ---- Public types ----

export interface SafetyCheckResult {
  readonly allowed: boolean;
  readonly tier: ApprovalPolicy;
  readonly reason?: string;
  readonly requiresApproval: boolean;
  readonly threats: readonly string[];
}

// ---- Threat pattern catalogue ----

export const THREAT_PATTERNS: readonly { readonly pattern: RegExp; readonly id: string }[] = [
  { pattern: /ignore\s+(previous|above|all)\s+instructions/i, id: 'prompt-injection-ignore' },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i, id: 'prompt-injection-persona' },
  { pattern: /system\s*:\s*/i, id: 'prompt-injection-system-tag' },
  { pattern: /\bsudo\b/i, id: 'privilege-escalation-sudo' },
  { pattern: /rm\s+-rf\s+\//i, id: 'destructive-command-rm' },
  { pattern: /drop\s+table\b/i, id: 'destructive-command-sql' },
  { pattern: /exec\s*\(/i, id: 'code-execution-exec' },
  { pattern: /eval\s*\(/i, id: 'code-execution-eval' },
  { pattern: /\b(password|secret|token|api[_-]?key)\s*[:=]/i, id: 'credential-leak' },
  { pattern: /<script[\s>]/i, id: 'xss-script-tag' },
  { pattern: /data:text\/html/i, id: 'xss-data-uri' },
  { pattern: /\bfetch\s*\(\s*['"`]https?:/i, id: 'external-request' },
] as const;

// ---- Risk → Approval mapping ----

const RISK_TO_APPROVAL: Record<RiskLevel, ApprovalPolicy> = {
  'R0-read': 'A0-auto',
  'R1-internal-write': 'A1-transparent',
  'R2-external-read': 'A2-confirm',
  'R3-external-write': 'A3-dual-confirm',
};

// ---- Surface scope limits (max scope a surface is allowed) ----

const SURFACE_MAX_SCOPE: Record<AgentSurface, ScopeLimit> = {
  project: 'current-project',
  reader: 'current-object',
  research: 'workspace',
  writing: 'current-space',
  journal: 'current-object',
  'task-center': 'workspace',
  'global-chat': 'global',
};

// ---- SafetyGate ----

export class SafetyGate {
  /**
   * Scan text content for known threat patterns.
   * Returns an array of matched threat IDs.
   */
  scanContext(content: string): readonly string[] {
    const threats: string[] = [];
    for (const { pattern, id } of THREAT_PATTERNS) {
      if (pattern.test(content)) {
        threats.push(id);
      }
    }
    return threats;
  }

  /**
   * Full pre-execution check for a capability call.
   */
  checkCapability(
    definition: ToolDefinition,
    context: { readonly surface: AgentSurface; readonly scopeLimit: ScopeLimit },
  ): SafetyCheckResult {
    const tier = this.getApprovalTier(definition.riskLevel);
    const threats: string[] = [];

    // Scope check: tool scope must not exceed the surface's maximum
    const surfaceMaxIdx = SCOPE_LIMITS.indexOf(SURFACE_MAX_SCOPE[context.surface]);
    const toolScopeIdx = SCOPE_LIMITS.indexOf(definition.scopeLimit);
    if (toolScopeIdx > surfaceMaxIdx) {
      return {
        allowed: false,
        tier,
        reason: `Tool scope "${definition.scopeLimit}" exceeds surface "${context.surface}" max scope "${SURFACE_MAX_SCOPE[context.surface]}"`,
        requiresApproval: false,
        threats,
      };
    }

    // Requested scope vs context scope
    const contextScopeIdx = SCOPE_LIMITS.indexOf(context.scopeLimit);
    if (toolScopeIdx > contextScopeIdx) {
      return {
        allowed: false,
        tier,
        reason: `Tool scope "${definition.scopeLimit}" exceeds allowed context scope "${context.scopeLimit}"`,
        requiresApproval: false,
        threats,
      };
    }

    const needsApproval = this.requiresApproval(definition);

    return {
      allowed: !needsApproval,
      tier,
      requiresApproval: needsApproval,
      threats,
    };
  }

  /**
   * Whether a capability requires explicit human approval before execution.
   */
  requiresApproval(definition: ToolDefinition): boolean {
    const riskIdx = RISK_LEVELS.indexOf(definition.riskLevel);
    // R2 and above require approval
    return riskIdx >= 2;
  }

  /**
   * Map a risk level to its corresponding approval policy tier.
   */
  getApprovalTier(riskLevel: RiskLevel): ApprovalPolicy {
    return RISK_TO_APPROVAL[riskLevel];
  }
}
