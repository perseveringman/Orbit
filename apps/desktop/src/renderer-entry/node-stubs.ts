// Stubs for Node built-in modules pulled in by @orbit/agent-core barrel
// exports but never actually used in the renderer process.

const noop = (() => {
  throw new Error('Node API not available in renderer');
}) as any;

// node:fs/promises
export const readFile = noop;
export const writeFile = noop;
export const readdir = noop;
export const stat = noop;
export const mkdir = noop;

// node:path
export const resolve = noop;
export const relative = noop;
export const join = noop;
export const dirname = noop;
export const basename = noop;
export const extname = noop;

// node:child_process
export const exec = noop;
export const execSync = noop;
export const spawn = noop;

export default {};
