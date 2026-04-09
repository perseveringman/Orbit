import assert from 'node:assert/strict';
import test from 'node:test';

import { createCapabilityHost, createInMemorySecureStore } from '../src/index.ts';

test('platform-contracts：可以根据能力集合创建能力宿主', () => {
  const host = createCapabilityHost(['workspace', 'notification']);

  assert.equal(host.has('workspace'), true);
  assert.equal(host.has('sync'), false);
});

test('platform-contracts：可以提供最小内存安全存储实现', async () => {
  const store = createInMemorySecureStore();

  await store.set('token', 'secret');
  await store.remove('token');

  assert.equal(await store.get('token'), null);
});
