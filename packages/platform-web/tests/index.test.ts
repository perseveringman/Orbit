import assert from 'node:assert/strict';
import test from 'node:test';

import { createWebRuntimeAdapter } from '../src/index.ts';

test('platform-web：默认暴露浏览器安全能力边界', () => {
  const adapter = createWebRuntimeAdapter();

  assert.equal(adapter.platform, 'web');
  assert.equal(adapter.capabilityHost.has('workspace'), false);
  assert.equal(adapter.capabilityHost.has('notification'), true);
});
