// ---------------------------------------------------------------------------
// @orbit/capability-core – Sensitive Isolation (Wave 2-C)
// ---------------------------------------------------------------------------

import type { CapabilityDefinition } from './capability-interface.js';
import type { PolicyContext } from './policy-engine.js';

export type IsolationChannel = 'open' | 'guarded' | 'vault';

export interface IsolationPolicy {
  readonly channel: IsolationChannel;
  readonly description: string;
  readonly encryptionRequired: boolean;
  readonly auditRequired: boolean;
  readonly maxDataRetention?: number;
}

export interface IsolationManager {
  getChannel(capability: CapabilityDefinition, context: PolicyContext): IsolationChannel;
  getPolicy(channel: IsolationChannel): IsolationPolicy;
  validateExecution(
    capability: CapabilityDefinition,
    context: PolicyContext,
  ): { allowed: boolean; channel: IsolationChannel; reason?: string };
  getChannelStats(): Readonly<Record<IsolationChannel, number>>;
}

const CHANNEL_POLICIES: Readonly<Record<IsolationChannel, IsolationPolicy>> = {
  open: {
    channel: 'open',
    description: 'No special isolation – standard execution environment',
    encryptionRequired: false,
    auditRequired: false,
  },
  guarded: {
    channel: 'guarded',
    description: 'Elevated isolation – audit trail required, limited data retention',
    encryptionRequired: false,
    auditRequired: true,
    maxDataRetention: 86_400, // 24 hours
  },
  vault: {
    channel: 'vault',
    description: 'Maximum isolation – encryption and audit required, minimal retention',
    encryptionRequired: true,
    auditRequired: true,
    maxDataRetention: 3_600, // 1 hour
  },
};

export function createIsolationManager(): IsolationManager {
  const channelCounts: Record<IsolationChannel, number> = {
    open: 0,
    guarded: 0,
    vault: 0,
  };

  function determineChannel(capability: CapabilityDefinition, context: PolicyContext): IsolationChannel {
    // Sensitive domain always requires vault
    if (capability.domain === 'sensitive') return 'vault';

    // Restricted data requires vault
    if (context.dataLevel === 'restricted') return 'vault';

    // Confidential data or high-risk capabilities require guarded
    if (context.dataLevel === 'confidential') return 'guarded';
    if (capability.risk === 'R2' || capability.risk === 'R3') return 'guarded';

    // External exposure with content egress requires guarded
    if (capability.exposure === 'external' && capability.egress !== 'none') return 'guarded';

    return 'open';
  }

  return {
    getChannel(capability: CapabilityDefinition, context: PolicyContext): IsolationChannel {
      return determineChannel(capability, context);
    },

    getPolicy(channel: IsolationChannel): IsolationPolicy {
      return CHANNEL_POLICIES[channel];
    },

    validateExecution(
      capability: CapabilityDefinition,
      context: PolicyContext,
    ): { allowed: boolean; channel: IsolationChannel; reason?: string } {
      const channel = determineChannel(capability, context);
      channelCounts[channel] += 1;

      // Vault channel with external exposure is not allowed for viewers
      if (channel === 'vault' && context.userRole === 'viewer') {
        return { allowed: false, channel, reason: 'Vault channel requires owner or editor role' };
      }

      return { allowed: true, channel };
    },

    getChannelStats(): Readonly<Record<IsolationChannel, number>> {
      return { ...channelCounts };
    },
  };
}
