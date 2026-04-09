import { describe, expect, it } from 'vitest';

import { createDesktopShellDescriptor } from './contracts';

describe('createDesktopShellDescriptor', () => {
  it('返回桌面宿主的三层边界', () => {
    const descriptor = createDesktopShellDescriptor();

    expect(descriptor.packageName).toBe('@orbit/desktop');
    expect(descriptor.layers.map((layer) => layer.id)).toEqual([
      'main',
      'preload',
      'renderer-entry'
    ]);
    expect(descriptor.rendererMountId).toBe('root');
  });
});
