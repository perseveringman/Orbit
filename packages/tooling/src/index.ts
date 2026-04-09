import { resolve } from 'node:path';

export interface ToolingArtifacts {
  eslintConfig: string;
  tsconfigBase: string;
  vitestBase: string;
}

export function createPackageScripts(
  eslintConfigPath = '../tooling/eslint/base.cjs',
  vitestConfigPath = 'vitest.config.ts'
): Record<'build' | 'typecheck' | 'lint' | 'test' | 'clean', string> {
  return {
    build: 'tsc -p tsconfig.json',
    typecheck: 'tsc -p tsconfig.json --noEmit',
    lint: `eslint --config ${eslintConfigPath} "src/**/*.ts" "tests/**/*.ts" "vitest.config.ts"`,
    test: `vitest run --config ${vitestConfigPath}`,
    clean: 'rm -rf dist coverage'
  };
}

export function resolveToolingArtifacts(packageDir: string): ToolingArtifacts {
  const toolingDir = resolve(packageDir, '../tooling');

  return {
    eslintConfig: resolve(toolingDir, 'eslint/base.cjs'),
    tsconfigBase: resolve(toolingDir, 'tsconfig/base.json'),
    vitestBase: resolve(toolingDir, 'src/vitest/base.ts')
  };
}

export { createOrbitVitestConfig } from './vitest/base';
