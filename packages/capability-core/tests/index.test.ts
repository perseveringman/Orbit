import { describe, expect, it } from 'vitest';

import { capabilityKey, supportsPermission } from '../src/index';

describe('capability-core', () => {
  it('生成 capability 键并校验权限', () => {
    const manifest = {
      id: 'cap.search',
      name: '全文搜索',
      version: '1.0.0',
      kind: 'search',
      description: '在工作区中执行搜索',
      permissions: [{ resource: 'workspace', access: 'read' }],
      inputs: ['query'],
      outputs: ['results'],
    } as const;

    expect(capabilityKey(manifest)).toBe('cap.search@1.0.0');
    expect(supportsPermission(manifest, 'workspace', 'read')).toBe(true);
  });
});
