import assert from 'node:assert/strict';
import test from 'node:test';

import { createPackageScripts, resolveToolingArtifacts } from '../src/index.ts';

test('tooling：可以输出统一的包脚本模板', () => {
  const scripts = createPackageScripts();

  assert.deepEqual(Object.keys(scripts).sort(), ['build', 'clean', 'lint', 'test', 'typecheck']);
});

test('tooling：可以解析共享配置工件路径', () => {
  const artifacts = resolveToolingArtifacts('/repo/packages/platform-web');

  assert.equal(artifacts.eslintConfig.endsWith('tooling/eslint/base.cjs'), true);
  assert.equal(artifacts.tsconfigBase.endsWith('tooling/tsconfig/base.json'), true);
  assert.equal(artifacts.vitestBase.endsWith('tooling/src/vitest/base.ts'), true);
});
