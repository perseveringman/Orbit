import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { ServerHostDescriptor } from '../shared/host.js';

export interface NotificationHubDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export interface OrbitNotificationEvent {
  topic: string;
  payload: Record<string, unknown>;
  emittedAt: string;
}

export interface OrbitNotificationHub {
  publish: (topic: string, payload: Record<string, unknown>) => OrbitNotificationEvent;
  snapshot: () => OrbitNotificationEvent[];
  describe: () => {
    mode: string;
    service: string;
    zeroKnowledge: boolean;
  };
}

export const createNotificationHub = ({ host }: NotificationHubDependencies): OrbitNotificationHub => {
  const events: OrbitNotificationEvent[] = [];

  return {
    publish: (topic, payload) => {
      const event: OrbitNotificationEvent = {
        topic,
        payload,
        emittedAt: new Date().toISOString(),
      };

      events.unshift(event);
      events.splice(20);

      return event;
    },
    snapshot: () => [...events],
    describe: () => ({
      mode: host.realtime,
      service: host.name,
      zeroKnowledge: host.zeroKnowledge,
    }),
  };
};
