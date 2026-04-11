// ---------------------------------------------------------------------------
// @orbit/agent-core – Safety Chain (M3-lite)
// Chain-of-responsibility pattern for safety checks.
// ---------------------------------------------------------------------------

import { THREAT_PATTERNS } from '../safety-gate.js';
import { SCOPE_LIMITS } from '../types.js';
import type { AgentSurface, ScopeLimit } from '../types.js';

// ---- Context & Verdict ----

export interface SafetyCheckContext {
  readonly capabilityName: string;
  readonly args: Record<string, unknown>;
  readonly riskLevel: string;
  readonly scope: string;
  readonly surface: string;
  readonly sessionId?: string;
}

export type SafetyVerdict =
  | { readonly action: 'allow'; readonly reason: string }
  | { readonly action: 'ask'; readonly reason: string; readonly tier: string }
  | { readonly action: 'deny'; readonly reason: string; readonly threats: readonly string[] };

// ---- Checker interface ----

export interface SafetyChecker {
  readonly name: string;
  readonly description: string;
  check(context: SafetyCheckContext): SafetyVerdict | null;
}

// ---- 1. ContentScanner ----

export class ContentScanner implements SafetyChecker {
  readonly name = 'content-scanner';
  readonly description = 'Scans input content for threat patterns';

  check(context: SafetyCheckContext): SafetyVerdict | null {
    const threats: string[] = [];
    const text = stringifyArgs(context.args);

    for (const { pattern, id } of THREAT_PATTERNS) {
      if (pattern.test(text)) {
        threats.push(id);
      }
    }

    if (threats.length > 0) {
      return {
        action: 'deny',
        reason: `Threat patterns detected: ${threats.join(', ')}`,
        threats,
      };
    }
    return null;
  }
}

// ---- 2. CapabilityPolicyChecker ----

const RISK_TO_TIER: Record<string, string> = {
  r0: 'A0',
  r1: 'A1',
  r2: 'A2',
  r3: 'A3',
};

export class CapabilityPolicyChecker implements SafetyChecker {
  readonly name = 'capability-policy';
  readonly description = 'Checks capability risk level against approval policy';

  check(context: SafetyCheckContext): SafetyVerdict | null {
    const tier = RISK_TO_TIER[context.riskLevel];
    if (!tier) {
      return {
        action: 'deny',
        reason: `Unknown risk level "${context.riskLevel}"`,
        threats: [],
      };
    }

    // r2+ requires human approval
    const riskIdx = parseInt(context.riskLevel.replace(/\D/g, ''), 10);
    if (riskIdx >= 2) {
      return {
        action: 'ask',
        reason: `Risk level "${context.riskLevel}" requires approval (tier ${tier})`,
        tier,
      };
    }
    return null;
  }
}

// ---- 3. SurfaceScopeChecker ----

const SURFACE_MAX_SCOPE: Record<string, ScopeLimit> = {
  project: 'current-project',
  reader: 'current-object',
  research: 'workspace',
  writing: 'current-space',
  journal: 'current-object',
  'task-center': 'workspace',
  'global-chat': 'global',
};

const SCOPE_TO_LIMIT: Record<string, ScopeLimit> = {
  read: 'current-object',
  write: 'current-project',
  admin: 'workspace',
  'current-object': 'current-object',
  'current-space': 'current-space',
  'current-project': 'current-project',
  workspace: 'workspace',
  global: 'global',
};

export class SurfaceScopeChecker implements SafetyChecker {
  readonly name = 'surface-scope';
  readonly description = 'Validates scope permissions for the surface';

  check(context: SafetyCheckContext): SafetyVerdict | null {
    const maxScope = SURFACE_MAX_SCOPE[context.surface];
    if (!maxScope) {
      return {
        action: 'deny',
        reason: `Unknown surface "${context.surface}"`,
        threats: [],
      };
    }

    const scopeLimit = SCOPE_TO_LIMIT[context.scope] ?? context.scope;
    const maxIdx = SCOPE_LIMITS.indexOf(maxScope as ScopeLimit);
    const scopeIdx = SCOPE_LIMITS.indexOf(scopeLimit as ScopeLimit);

    if (scopeIdx === -1) {
      // Unknown scope — pass through (other checkers may catch it)
      return null;
    }

    if (scopeIdx > maxIdx) {
      return {
        action: 'deny',
        reason: `Scope "${context.scope}" exceeds surface "${context.surface}" max scope "${maxScope}"`,
        threats: [],
      };
    }
    return null;
  }
}

// ---- 4. RateLimitChecker ----

export class RateLimitChecker implements SafetyChecker {
  readonly name = 'rate-limit';
  readonly description = 'Prevents excessive tool execution';

  private readonly history: { name: string; timestamp: number }[] = [];
  private readonly maxPerMinute: number;

  constructor(maxPerMinute = 30) {
    this.maxPerMinute = maxPerMinute;
  }

  check(context: SafetyCheckContext): SafetyVerdict | null {
    const now = Date.now();
    const windowStart = now - 60_000;

    // Prune old entries
    while (this.history.length > 0 && this.history[0].timestamp < windowStart) {
      this.history.shift();
    }

    if (this.history.length >= this.maxPerMinute) {
      return {
        action: 'deny',
        reason: `Rate limit exceeded: ${this.history.length} calls in the last minute (max ${this.maxPerMinute})`,
        threats: [],
      };
    }

    this.history.push({ name: context.capabilityName, timestamp: now });
    return null;
  }
}

// ---- 5. ArgumentSanitizer ----

const DANGEROUS_ARG_PATTERNS: readonly { readonly pattern: RegExp; readonly id: string }[] = [
  { pattern: /\.\.[/\\]/, id: 'path-traversal' },
  { pattern: /;\s*\w/, id: 'shell-injection-semicolon' },
  { pattern: /&&/, id: 'shell-injection-and' },
  { pattern: /\|\|/, id: 'shell-injection-or' },
  { pattern: /\|(?!\|)/, id: 'shell-injection-pipe' },
  { pattern: /`[^`]+`/, id: 'shell-injection-backtick' },
  { pattern: /'\s*OR\s+'[^']*'\s*=\s*'/i, id: 'sql-injection-or' },
  { pattern: /;\s*DROP\s+/i, id: 'sql-injection-drop' },
  { pattern: /UNION\s+SELECT/i, id: 'sql-injection-union' },
];

export class ArgumentSanitizer implements SafetyChecker {
  readonly name = 'argument-sanitizer';
  readonly description = 'Sanitizes tool arguments for dangerous patterns';

  check(context: SafetyCheckContext): SafetyVerdict | null {
    const text = stringifyArgs(context.args);
    const threats: string[] = [];

    for (const { pattern, id } of DANGEROUS_ARG_PATTERNS) {
      if (pattern.test(text)) {
        threats.push(id);
      }
    }

    if (threats.length > 0) {
      return {
        action: 'deny',
        reason: `Dangerous argument patterns detected: ${threats.join(', ')}`,
        threats,
      };
    }
    return null;
  }
}

// ---- SafetyChain runner ----

export class SafetyChain {
  private readonly checkers: SafetyChecker[] = [];

  constructor(checkers?: SafetyChecker[]) {
    if (checkers) {
      this.checkers.push(...checkers);
    }
  }

  addChecker(checker: SafetyChecker): void {
    this.checkers.push(checker);
  }

  removeChecker(name: string): boolean {
    const idx = this.checkers.findIndex((c) => c.name === name);
    if (idx === -1) return false;
    this.checkers.splice(idx, 1);
    return true;
  }

  /**
   * Run all checkers in order.
   * First deny wins. First ask wins if no deny. Otherwise allow.
   */
  evaluate(context: SafetyCheckContext): SafetyVerdict {
    let firstAsk: SafetyVerdict | null = null;

    for (const checker of this.checkers) {
      const verdict = checker.check(context);
      if (verdict === null) continue;

      if (verdict.action === 'deny') {
        return verdict;
      }
      if (verdict.action === 'ask' && firstAsk === null) {
        firstAsk = verdict;
      }
    }

    if (firstAsk) return firstAsk;

    return { action: 'allow', reason: 'All safety checks passed' };
  }

  getCheckerNames(): readonly string[] {
    return this.checkers.map((c) => c.name);
  }
}

// ---- Factory ----

export function createDefaultSafetyChain(): SafetyChain {
  return new SafetyChain([
    new ContentScanner(),
    new ArgumentSanitizer(),
    new SurfaceScopeChecker(),
    new CapabilityPolicyChecker(),
    new RateLimitChecker(),
  ]);
}

// ---- Helpers ----

function stringifyArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const value of Object.values(args)) {
    if (typeof value === 'string') {
      parts.push(value);
    } else if (value !== null && value !== undefined) {
      parts.push(JSON.stringify(value));
    }
  }
  return parts.join(' ');
}
