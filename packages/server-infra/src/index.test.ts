import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createServerInfraBundle } from './index.ts';

describe('server-infra', () => {
  it('组合基础设施能力并声明只处理密文、元数据与通知', () => {
    const now = new Date('2026-02-01T08:00:00.000Z');

    const bundle = createServerInfraBundle({
      objectStorage: {
        putObject: async (input) => ({ blobId: input.blobId, objectKey: `objects/${input.blobId}` }),
        getDownloadUrl: async () => ({ url: 'https://example.invalid/blob', expiresAt: now }),
        deleteObject: async () => undefined,
      },
      notificationFanout: {
        fanout: async (input) => ({ deliveryCount: input.deviceIds.length }),
      },
      tokenService: {
        mintDeviceToken: async (input) => ({ token: `${input.scope}:${input.deviceId}`, expiresAt: now }),
        verifyDeviceToken: async () => ({ accountId: 'acc_001', deviceId: 'dev_001', scope: 'sync' }),
      },
      clock: {
        now: () => now,
      },
      idGenerator: {
        nextId: (prefix) => `${prefix}_001`,
      },
    });

    assert.equal(bundle.dataPolicy.plaintextHandling, 'forbidden');
    assert.match(bundle.dataPolicy.description, /不处理用户明文/);
    assert.deepEqual(bundle.issueSyncCursor({ accountId: 'acc_001', version: 42 }), {
      cursor: 'acc_001:42:sync_001',
      issuedAt: now,
    });
    assert.deepEqual(bundle.issueBlobLocator({}), {
      blobId: 'blob_001',
      uploadedAt: now,
    });
  });
});
