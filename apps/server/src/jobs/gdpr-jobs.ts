import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { OrbitNotificationHub } from '../realtime/notification-hub.js';
import type { ServerHostDescriptor } from '../shared/host.js';

export interface GdprJobsDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
  notificationHub: OrbitNotificationHub;
}

export interface OrbitGdprJobs {
  supportedJobs: readonly string[];
  scheduleExport: (accountId: string) => Promise<{
    jobId: string;
    accountId: string;
    status: 'accepted';
  }>;
  scheduleErasure: (accountId: string) => Promise<{
    jobId: string;
    accountId: string;
    status: 'accepted';
  }>;
}

const createJobId = (prefix: string) => `${prefix}-${Date.now()}`;

export const createGdprJobs = ({ host, notificationHub }: GdprJobsDependencies): OrbitGdprJobs => {
  const supportedJobs = [...host.jobs] as const;

  return {
    supportedJobs,
    async scheduleExport(accountId) {
      const result = {
        jobId: createJobId('gdpr-export'),
        accountId,
        status: 'accepted' as const,
      };

      notificationHub.publish('gdpr.export.queued', {
        accountId,
        service: host.name,
        runtime: host.runtime,
      });

      return result;
    },
    async scheduleErasure(accountId) {
      const result = {
        jobId: createJobId('gdpr-erasure'),
        accountId,
        status: 'accepted' as const,
      };

      notificationHub.publish('gdpr.erasure.queued', {
        accountId,
        service: host.name,
        runtime: host.runtime,
      });

      return result;
    },
  };
};
