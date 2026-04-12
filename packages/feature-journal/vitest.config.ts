import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packagesDir = resolve(currentDir, '..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@orbit/domain': resolve(packagesDir, 'domain/src/index.ts'),
      '@orbit/feature-journal': resolve(packagesDir, 'feature-journal/src/index.ts'),
    },
  },
});
