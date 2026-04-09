import assert from 'node:assert/strict';
import test from 'node:test';

import { createIosRuntimeAdapter } from '../src/index.ts';

test('platform-ios：默认暴露移动端能力边界', () => {
  const adapter = createIosRuntimeAdapter();

  assert.equal(adapter.platform, 'ios');
  assert.equal(adapter.capabilityHost.has('auth'), true);
  assert.equal(adapter.capabilityHost.has('workspace'), false);
});
