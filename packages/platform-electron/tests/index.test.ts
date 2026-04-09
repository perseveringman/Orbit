import assert from 'node:assert/strict';
import test from 'node:test';

import { createElectronRuntimeAdapter } from '../src/index.ts';

test('platform-electron：默认暴露桌面平台能力边界', () => {
  const adapter = createElectronRuntimeAdapter();

  assert.equal(adapter.platform, 'electron');
  assert.equal(adapter.capabilityHost.has('workspace'), true);
  assert.equal(adapter.capabilityHost.has('secure-store'), true);
});
