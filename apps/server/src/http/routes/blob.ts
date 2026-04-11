import { Hono } from 'hono';

import type { BlobDescriptorDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import type { AppEnv } from '../../shared/app-env.js';
import { API_ERRORS, throwApiError } from '../middleware/error-handler.js';
import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface BlobRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export const createBlobRoutes = ({ host, core, infra }: BlobRouteDependencies) => {
  const blob = new Hono<AppEnv>();

  blob.get('/health', (c) =>
    c.json(
      createHostEnvelope(
        'blob',
        {
          service: host.name,
          adapter: '@orbit/server-infra',
          transport: host.http,
        },
        'blob 边界只负责对象存储鉴权与路由，不处理文件明文内容。',
      )
    )
  );

  // PUT /:blobId - Upload encrypted blob
  blob.put('/:blobId', async (c) => {
    const blobId = c.req.param('blobId');
    const accountId = c.get('accountId') as string | undefined ?? 'account-demo';
    const deviceId = c.get('deviceId') as string | undefined ?? 'device-demo';

    const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';
    const rawBody = await c.req.arrayBuffer();
    const checksum = c.req.header('X-Checksum') ?? 'no-checksum';

    const reservation = await core.blobs.createReservation({
      accountId,
      deviceId,
      blobId,
      encryptedBlobDescriptor: `encrypted:${blobId}`,
      metadata: {},
    });

    await infra.objectStorage.putObject({
      blobId: reservation.blobId,
      encryptedPayload: new Uint8Array(rawBody),
      contentType,
      checksum,
      sizeBytes: rawBody.byteLength,
      metadata: {},
    });

    const completed = await core.blobs.completeUpload({
      accountId,
      deviceId,
      blobId: reservation.blobId,
      checksum,
      metadata: {},
    });

    const descriptor: BlobDescriptorDto = {
      blobId: completed.blobId,
      mimeType: contentType,
      byteLength: rawBody.byteLength,
      sha256: checksum,
      uploadedAt: completed.completedAt.toISOString(),
    };

    return c.json(createHostEnvelope('blob', descriptor, '密文 blob 上传完成。'), 201);
  });

  // GET /:blobId - Download encrypted blob
  blob.get('/:blobId', async (c) => {
    const blobId = c.req.param('blobId');

    const download = await infra.objectStorage.getDownloadUrl({
      blobId,
      expiresInSeconds: 900,
    });

    return c.json(
      createHostEnvelope(
        'blob',
        {
          blobId,
          downloadUrl: download.url,
          expiresAt: download.expiresAt.toISOString(),
        },
        '密文 blob 下载链接已签发。',
      ),
    );
  });

  // HEAD /:blobId - Check blob exists
  blob.on('HEAD', '/:blobId', async (c) => {
    const blobId = c.req.param('blobId');

    try {
      await infra.objectStorage.getDownloadUrl({
        blobId,
        expiresInSeconds: 60,
      });
      c.header('X-Blob-Exists', 'true');
      c.header('X-Blob-Id', blobId);
      return c.body(null, 200);
    } catch {
      throwApiError(API_ERRORS.NOT_FOUND, `Blob ${blobId} not found`);
    }
  });

  // DELETE /:blobId - Delete blob
  blob.delete('/:blobId', async (c) => {
    const blobId = c.req.param('blobId');

    await infra.objectStorage.deleteObject({ blobId });

    return c.json(
      createHostEnvelope(
        'blob',
        {
          blobId,
          deletedAt: infra.clock.now().toISOString(),
        },
        '密文 blob 已删除。',
      ),
    );
  });

  return blob;
};
