import { randomUUID } from 'node:crypto';

import { API_VERSION } from '@orbit/api-types';
import {
  createServerCoreOrchestrator,
  type ServerCoreOrchestrator,
  type ServerUseCasePorts
} from '@orbit/server-core';
import {
  createServerInfraBundle,
  type ServerInfraBundle,
  type ServerInfraDeps
} from '@orbit/server-infra';

export type HostBoundary = 'auth' | 'device' | 'sync' | 'blob' | 'admin' | 'host';

export interface HostEnvelope<T> {
  ok: true;
  version: string;
  boundary: HostBoundary;
  data: T;
  message?: string;
}

export interface ServerHostDescriptor {
  name: string;
  version: string;
  boundaries: readonly Exclude<HostBoundary, 'host'>[];
  zeroKnowledge: true;
  forbiddenCapabilities: readonly string[];
  runtime: 'node';
  http: 'hono';
  realtime: 'in-memory-notification-hub';
  jobs: readonly string[];
}

export function createHostEnvelope<T>(
  boundary: HostBoundary,
  data: T,
  message?: string
): HostEnvelope<T> {
  return {
    ok: true,
    version: API_VERSION,
    boundary,
    data,
    message
  };
}

export function createServerHostDescriptor(): ServerHostDescriptor {
  return {
    name: '@orbit/server',
    version: API_VERSION,
    boundaries: ['auth', 'device', 'sync', 'blob', 'admin'],
    zeroKnowledge: true,
    forbiddenCapabilities: ['agent-inference', 'plaintext-processing'],
    runtime: 'node',
    http: 'hono',
    realtime: 'in-memory-notification-hub',
    jobs: ['gdpr-export', 'gdpr-erasure']
  };
}

function now(): Date {
  return new Date();
}

function nextId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function createDemoInfraDeps(): ServerInfraDeps {
  return {
    objectStorage: {
      async putObject(input) {
        return {
          blobId: input.blobId,
          objectKey: `orbit/${input.blobId}`
        };
      },
      async getDownloadUrl(input) {
        return {
          url: `https://example.invalid/blobs/${input.blobId}?expires=${input.expiresInSeconds}`,
          expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000)
        };
      },
      async deleteObject() {
        return undefined;
      }
    },
    notificationFanout: {
      async fanout(input) {
        return {
          deliveryCount: input.deviceIds.length
        };
      }
    },
    tokenService: {
      async mintDeviceToken(input) {
        return {
          token: `${input.scope}-${input.deviceId}-${nextId('token')}`,
          expiresAt: new Date(Date.now() + input.ttlSeconds * 1000)
        };
      },
      async verifyDeviceToken() {
        return {
          accountId: 'account-demo',
          deviceId: 'device-demo',
          scope: 'sync' as const
        };
      }
    },
    clock: {
      now
    },
    idGenerator: {
      nextId
    }
  };
}

export function createHostInfra(): ServerInfraBundle {
  return createServerInfraBundle(createDemoInfraDeps());
}

function createDemoPorts(infra: ServerInfraBundle): ServerUseCasePorts {
  return {
    accounts: {
      async provisionAccount(input) {
        return {
          accountId: input.externalAccountId,
          createdAt: infra.clock.now()
        };
      },
      async revokeAccount(input) {
        return {
          accountId: input.accountId,
          revokedAt: infra.clock.now()
        };
      }
    },
    devices: {
      async registerDevice(input) {
        return {
          deviceId: input.deviceId,
          registeredAt: infra.clock.now()
        };
      },
      async revokeDevice(input) {
        return {
          deviceId: input.deviceId,
          revokedAt: infra.clock.now()
        };
      }
    },
    sync: {
      async commitMutation(input) {
        return {
          mutationId: input.mutationId,
          acceptedAt: infra.clock.now()
        };
      },
      async pullEvents() {
        return {
          events: [],
          nextCursor: undefined
        };
      }
    },
    blobs: {
      async createReservation(input) {
        const locator = infra.issueBlobLocator({ blobId: input.blobId });
        return {
          blobId: locator.blobId,
          uploadUrl: `https://example.invalid/upload/${locator.blobId}`
        };
      },
      async completeUpload(input) {
        return {
          blobId: input.blobId,
          completedAt: infra.clock.now()
        };
      }
    },
    gdpr: {
      async requestExport() {
        return {
          requestId: nextId('gdpr-export'),
          acceptedAt: infra.clock.now()
        };
      },
      async requestDeletion() {
        return {
          requestId: nextId('gdpr-delete'),
          acceptedAt: infra.clock.now()
        };
      }
    }
  };
}

export function createHostCore(infra: ServerInfraBundle): ServerCoreOrchestrator {
  return createServerCoreOrchestrator(createDemoPorts(infra));
}
