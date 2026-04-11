import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = pathResolve(currentDir, '../..');
const aliases = new Map([
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
  if (!parentURL || !(specifier.startsWith('./') || specifier.startsWith('../'))) {
    return null;
  }

  const ext = extname(specifier);

  // Handle extensionless imports: ./foo → ./foo.ts
  if (!ext) {
    const candidate = fileURLToPath(new URL(`${specifier}.ts`, parentURL));
    if (existsSync(candidate)) {
      return { shortCircuit: true, url: pathToFileURL(candidate).href };
    }
    return null;
  }

  // Handle .js → .ts resolution: ./foo.js → ./foo.ts
  if (ext === '.js') {
    const tsSpecifier = specifier.replace(/\.js$/, '.ts');
    const candidate = fileURLToPath(new URL(tsSpecifier, parentURL));
    if (existsSync(candidate)) {
      return { shortCircuit: true, url: pathToFileURL(candidate).href };
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
