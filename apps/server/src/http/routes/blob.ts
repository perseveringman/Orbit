import { Hono } from 'hono';

import type { BlobDescriptorDto } from '@orbit/api-types';
import type { ServerCoreOrchestrator } from '@orbit/server-core';
import type { ServerInfraBundle } from '@orbit/server-infra';

import { createHostEnvelope, type ServerHostDescriptor } from '../../shared/host.js';

export interface BlobRouteDependencies {
  host: ServerHostDescriptor;
  core: ServerCoreOrchestrator;
  infra: ServerInfraBundle;
}

export const createBlobRoutes = ({ host, infra }: BlobRouteDependencies) => {
  const blob = new Hono();

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

  blob.post('/presign', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch(() => ({}) as Record<string, unknown>);
    const blobKey = typeof body.blobKey === 'string' ? body.blobKey : 'pending-blob-key';
    const descriptor: BlobDescriptorDto = {
      blobId: blobKey,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'application/octet-stream',
      byteLength: typeof body.byteLength === 'number' ? body.byteLength : 0,
      sha256: typeof body.sha256 === 'string' ? body.sha256 : 'pending-sha256',
      uploadedAt: null
    };

    return c.json(
      createHostEnvelope(
        'blob',
        {
          descriptor,
          method: 'PUT',
          expiresInSeconds: 900,
          handledBy: '@orbit/server-infra',
        },
        '对象存储预签名请求已接受，后续应接入具体 bucket 适配器。',
      ),
      202,
    );
  });

  blob.get('/:blobId', (c) =>
    c.json(
      createHostEnvelope(
        'blob',
        {
          blobId: c.req.param('blobId'),
          mode: 'download-ticket',
          issuedAt: infra.clock.now().toISOString()
        },
        '下载票据路由已预留，后续由 infra 适配具体对象存储。',
      )
    )
  );

  return blob;
};
