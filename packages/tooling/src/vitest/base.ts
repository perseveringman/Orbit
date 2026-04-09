import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export function createOrbitVitestConfig(configUrl: string) {
  const currentDir = dirname(fileURLToPath(configUrl));
  const packagesDir = resolve(currentDir, '..');

  return defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts']
    },
    resolve: {
      alias: {
        '@orbit/platform-contracts': resolve(packagesDir, 'platform-contracts/src/index.ts'),
        '@orbit/platform-electron': resolve(packagesDir, 'platform-electron/src/index.ts'),
        '@orbit/platform-web': resolve(packagesDir, 'platform-web/src/index.ts'),
        '@orbit/platform-ios': resolve(packagesDir, 'platform-ios/src/index.ts'),
        '@orbit/test-kit': resolve(packagesDir, 'test-kit/src/index.ts'),
        '@orbit/tooling': resolve(packagesDir, 'tooling/src/index.ts')
      }
    }
  });
}
