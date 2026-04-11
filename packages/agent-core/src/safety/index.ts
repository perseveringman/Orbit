// ---------------------------------------------------------------------------
// @orbit/agent-core – Safety subsystem barrel export (M3-lite)
// ---------------------------------------------------------------------------

export {
  type SafetyCheckContext,
  type SafetyVerdict,
  type SafetyChecker,
  ContentScanner,
  CapabilityPolicyChecker,
  SurfaceScopeChecker,
  RateLimitChecker,
  ArgumentSanitizer,
  SafetyChain,
  createDefaultSafetyChain,
} from './safety-chain.js';

export {
  type ApprovalTier,
  type SafetyApprovalRequest,
  type ApprovalResponse,
  type ApprovalCallback,
  ApprovalManager,
} from './approval-manager.js';

export {
  type AuditEntry,
  type AuditQueryFilter,
  type AuditStats,
  AuditLog,
} from './audit-log.js';
