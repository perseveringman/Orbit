import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlatformFixture } from '../src/index.ts';

test('test-kit：可以生成可复用的平台测试夹具', async () => {
  const fixture = createPlatformFixture({
    capabilities: ['auth']
  });

  await fixture.ports.notification.notify({
    title: '测试通知',
    body: '来自夹具'
  });

  assert.equal(fixture.capabilityHost.has('auth'), true);
  assert.equal(fixture.events.notifications.length, 1);
});
