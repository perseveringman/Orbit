// ---------------------------------------------------------------------------
// @orbit/agent-core – Approval Manager (M3-lite)
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';

// ---- Types ----

export type ApprovalTier = 'A0' | 'A1' | 'A2' | 'A3';

export interface SafetyApprovalRequest {
  readonly id: string;
  readonly capabilityName: string;
  readonly tier: ApprovalTier;
  readonly reason: string;
  readonly args: Record<string, unknown>;
  readonly timestamp: number;
}

export interface ApprovalResponse {
  readonly requestId: string;
  readonly approved: boolean;
  readonly respondedAt: number;
  readonly respondedBy?: string;
}

export type ApprovalCallback = (request: SafetyApprovalRequest) => Promise<ApprovalResponse>;

// ---- Manager ----

export class ApprovalManager {
  private readonly pendingRequests = new Map<string, SafetyApprovalRequest>();
  private callback?: ApprovalCallback;
  private autoApproveMode = false;

  setCallback(cb: ApprovalCallback): void {
    this.callback = cb;
  }

  async requestApproval(
    capabilityName: string,
    tier: ApprovalTier,
    reason: string,
    args: Record<string, unknown>,
  ): Promise<ApprovalResponse> {
    // A0 tier is auto-approved
    if (this.isAutoApproved(tier)) {
      return {
        requestId: generateId('approval'),
        approved: true,
        respondedAt: Date.now(),
        respondedBy: 'system:auto-approve',
      };
    }

    const request: SafetyApprovalRequest = {
      id: generateId('approval'),
      capabilityName,
      tier,
      reason,
      args,
      timestamp: Date.now(),
    };

    this.pendingRequests.set(request.id, request);

    // Auto-approve mode (for testing)
    if (this.autoApproveMode) {
      this.pendingRequests.delete(request.id);
      return {
        requestId: request.id,
        approved: true,
        respondedAt: Date.now(),
        respondedBy: 'system:auto-approve-all',
      };
    }

    if (!this.callback) {
      throw new Error(
        `No approval callback set. Cannot request approval for "${capabilityName}" (tier ${tier}).`,
      );
    }

    const response = await this.callback(request);
    this.pendingRequests.delete(request.id);
    return response;
  }

  isAutoApproved(tier: ApprovalTier): boolean {
    return tier === 'A0';
  }

  getPending(): readonly SafetyApprovalRequest[] {
    return [...this.pendingRequests.values()];
  }

  autoApproveAll(): void {
    this.autoApproveMode = true;
  }
}
