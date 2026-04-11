// ---------------------------------------------------------------------------
// @orbit/capability-core – Confirmation Model (Wave 2-C)
// ---------------------------------------------------------------------------

import type { CapabilityDefinition } from './capability-interface.js';
import type { PolicyContext } from './policy-engine.js';

export type ConfirmationLevel = 'silent' | 'session_auth' | 'per_call' | 'dual_stage';

export interface ConfirmationPolicy {
  readonly level: ConfirmationLevel;
  readonly description: string;
  readonly requiresUserPresence: boolean;
  readonly sessionDuration?: number;
}

export interface ConfirmationRequest {
  readonly id: string;
  readonly capabilityId: string;
  readonly level: ConfirmationLevel;
  readonly description: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly status: 'pending' | 'approved' | 'denied' | 'expired';
}

export interface ConfirmationManager {
  getPolicy(capability: CapabilityDefinition): ConfirmationPolicy;
  requestConfirmation(capability: CapabilityDefinition, context: PolicyContext): ConfirmationRequest;
  approve(requestId: string): boolean;
  deny(requestId: string): boolean;
  isSessionAuthorized(sessionId: string, capabilityId: string): boolean;
  authorizeSession(sessionId: string, capabilityId: string, durationSeconds: number): void;
  getPending(): readonly ConfirmationRequest[];
}

let confirmCounter = 0;

function generateConfirmId(): string {
  confirmCounter += 1;
  return `confirm-${Date.now()}-${confirmCounter}`;
}

export function createConfirmationManager(): ConfirmationManager {
  const requests = new Map<string, ConfirmationRequest>();
  // sessionId:capabilityId -> expiry timestamp
  const sessionAuths = new Map<string, number>();

  function riskToLevel(capability: CapabilityDefinition): ConfirmationLevel {
    switch (capability.approval) {
      case 'A0':
        return 'silent';
      case 'A1':
        return 'session_auth';
      case 'A2':
        return 'per_call';
      case 'A3':
        return 'dual_stage';
      default:
        return 'per_call';
    }
  }

  return {
    getPolicy(capability: CapabilityDefinition): ConfirmationPolicy {
      const level = riskToLevel(capability);
      const policies: Record<ConfirmationLevel, ConfirmationPolicy> = {
        silent: {
          level: 'silent',
          description: 'No confirmation required – auto-approved',
          requiresUserPresence: false,
        },
        session_auth: {
          level: 'session_auth',
          description: 'One-time confirmation per session',
          requiresUserPresence: true,
          sessionDuration: 3600,
        },
        per_call: {
          level: 'per_call',
          description: 'Confirmation required for each invocation',
          requiresUserPresence: true,
        },
        dual_stage: {
          level: 'dual_stage',
          description: 'Two-stage confirmation with a cooldown period',
          requiresUserPresence: true,
        },
      };
      return policies[level];
    },

    requestConfirmation(capability: CapabilityDefinition, _context: PolicyContext): ConfirmationRequest {
      const level = riskToLevel(capability);
      const now = new Date();
      const expiresAt =
        level === 'dual_stage'
          ? new Date(now.getTime() + 300_000).toISOString() // 5 min expiry
          : undefined;

      const request: ConfirmationRequest = {
        id: generateConfirmId(),
        capabilityId: capability.id,
        level,
        description: `Confirm invocation of "${capability.displayName}"`,
        createdAt: now.toISOString(),
        expiresAt,
        status: level === 'silent' ? 'approved' : 'pending',
      };
      requests.set(request.id, request);
      return request;
    },

    approve(requestId: string): boolean {
      const request = requests.get(requestId);
      if (!request || request.status !== 'pending') return false;
      requests.set(requestId, { ...request, status: 'approved' });
      return true;
    },

    deny(requestId: string): boolean {
      const request = requests.get(requestId);
      if (!request || request.status !== 'pending') return false;
      requests.set(requestId, { ...request, status: 'denied' });
      return true;
    },

    isSessionAuthorized(sessionId: string, capabilityId: string): boolean {
      const key = `${sessionId}:${capabilityId}`;
      const expiry = sessionAuths.get(key);
      if (expiry === undefined) return false;
      if (Date.now() > expiry) {
        sessionAuths.delete(key);
        return false;
      }
      return true;
    },

    authorizeSession(sessionId: string, capabilityId: string, durationSeconds: number): void {
      const key = `${sessionId}:${capabilityId}`;
      sessionAuths.set(key, Date.now() + durationSeconds * 1000);
    },

    getPending(): readonly ConfirmationRequest[] {
      return [...requests.values()].filter((r) => r.status === 'pending');
    },
  };
}
