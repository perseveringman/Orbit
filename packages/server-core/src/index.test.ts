import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertServerCiphertextBoundary,
  createServerCoreOrchestrator,
} from './index.ts';

describe('server-core', () => {
  it('在编排层声明并执行密文边界', async () => {
    const createdAt = new Date('2026-02-01T08:00:00.000Z');
    let provisionAccountCallCount = 0;

    const orchestrator = createServerCoreOrchestrator({
      accounts: {
        provisionAccount: async () => {
          provisionAccountCallCount += 1;
          return { accountId: 'acc_001', createdAt };
        },
        revokeAccount: async (input) => ({ accountId: input.accountId, revokedAt: createdAt }),
      },
      devices: {
        registerDevice: async (input) => ({ deviceId: input.deviceId, registeredAt: createdAt }),
        revokeDevice: async (input) => ({ deviceId: input.deviceId, revokedAt: createdAt }),
      },
      sync: {
        commitMutation: async (input) => ({ mutationId: input.mutationId, acceptedAt: createdAt }),
        pullEvents: async () => ({ events: [], nextCursor: 'cursor_001' }),
      },
      blobs: {
        createReservation: async (input) => ({ blobId: input.blobId, uploadUrl: 'https://example.invalid/upload' }),
        completeUpload: async (input) => ({ blobId: input.blobId, completedAt: createdAt }),
      },
      gdpr: {
        requestExport: async (input) => ({ requestId: `export:${input.accountId}`, acceptedAt: createdAt }),
        requestDeletion: async (input) => ({ requestId: `deletion:${input.accountId}`, acceptedAt: createdAt }),
      },
    });

    assert.match(orchestrator.describeBoundary(), /不处理用户明文/);
    assert.deepEqual(orchestrator.listCapabilities(), ['accounts', 'devices', 'sync', 'blobs', 'gdpr']);

    const result = await orchestrator.accounts.provisionAccount({
      externalAccountId: 'user_ext_001',
      initialDeviceId: 'dev_001',
      encryptedAccountEnvelope: 'ciphertext-account',
      metadata: { region: 'cn' },
    });

    assert.deepEqual(result, { accountId: 'acc_001', createdAt });
    assert.equal(provisionAccountCallCount, 1);

    assert.throws(
      () =>
        assertServerCiphertextBoundary({
          ciphertext: 'ciphertext',
          metadata: { scope: 'blob' },
          plaintext: '明文内容',
        }),
      /服务端不处理用户明文/,
    );

    assert.throws(
      () =>
        assertServerCiphertextBoundary({
          ciphertext: '   ',
          metadata: { scope: 'sync' },
        }),
      /服务端只接受密文载荷/,
    );
  });
});
