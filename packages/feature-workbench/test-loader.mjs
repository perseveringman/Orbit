import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = pathResolve(currentDir, '../..');
const aliases = new Map([
  ['@orbit/agent-core', pathResolve(repoRoot, 'packages/agent-core/src/index.ts')],
  ['@orbit/app-viewmodels', pathResolve(repoRoot, 'packages/app-viewmodels/src/index.ts')],
  ['@orbit/editor-dom', pathResolve(repoRoot, 'packages/editor-dom/src/index.ts')],
  ['@orbit/feature-mobile', pathResolve(repoRoot, 'packages/feature-mobile/src/index.ts')],
  ['@orbit/feature-workbench', pathResolve(repoRoot, 'packages/feature-workbench/src/index.ts')],
  ['@orbit/i18n', pathResolve(repoRoot, 'packages/i18n/src/index.ts')],
  ['@orbit/ui-dom', pathResolve(repoRoot, 'packages/ui-dom/src/index.ts')],
  ['@orbit/ui-native', pathResolve(repoRoot, 'packages/ui-native/src/index.ts')],
  ['@orbit/ui-tokens', pathResolve(repoRoot, 'packages/ui-tokens/src/index.ts')]
]);

function tryResolveRelativeTs(specifier, parentURL) {
  if (!parentURL || !(specifier.startsWith('./') || specifier.startsWith('../')) || extname(specifier)) {
    return null;
  }

  for (const ext of ['.ts', '.tsx']) {
    const candidate = fileURLToPath(new URL(`${specifier}${ext}`, parentURL));
    if (existsSync(candidate)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidate).href
      };
    }
  }

  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  const aliased = aliases.get(specifier);
  if (aliased) {
    return {
      shortCircuit: true,
      url: pathToFileURL(aliased).href
    };
  }

  const relativeTs = tryResolveRelativeTs(specifier, context.parentURL);
  if (relativeTs) {
    return relativeTs;
  }

  return defaultResolve(specifier, context, defaultResolve);
}

// Handle .tsx files in the Node test runner (--experimental-strip-types
// only covers .ts).  For test purposes we stub out React component modules
// with a re-export-safe empty namespace.
export async function load(url, context, defaultLoad) {
  if (url.endsWith('.tsx')) {
    // Read the file and extract named exports so the module graph stays valid.
    // We don't execute React components in node:test – just provide stubs.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath: fu } = await import('node:url');
    const src = readFileSync(fu(url), 'utf8');
    // Match "export function Foo" and "export interface Foo"
    const exportNames = [];
    for (const m of src.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)) {
      exportNames.push(m[1]);
    }
    const stubs = exportNames.map((n) => `export function ${n}() {}`).join('\n');
    return {
      shortCircuit: true,
      format: 'module',
      source: stubs || 'export {};'
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
