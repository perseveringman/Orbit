// ---------------------------------------------------------------------------
// @orbit/agent-core – M8 Built-in Tool Library Tests
// ---------------------------------------------------------------------------

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  // Tools
  shellExecTool,
  fileReadTool,
  fileWriteTool,
  fileListTool,
  fileSearchTool,
  grepTool,
  webFetchTool,
  webSearchTool,
  askUserTool,
  datetimeTool,
  jsonParseTool,
  textTransformTool,
  calculateTool,
  // Registry
  ToolsetRegistry,
  createDefaultToolsetRegistry,
  CORE_TOOLSETS,
} from '../src/index';

import type { BuiltinTool, Toolset } from '../src/index';

// ---------------------------------------------------------------------------
// Test fixture directory
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(process.cwd(), '__m8_test_fixtures__');

beforeEach(async () => {
  await mkdir(FIXTURE_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// ToolsetRegistry
// ---------------------------------------------------------------------------

describe('ToolsetRegistry', () => {
  it('register and getTool', () => {
    const registry = new ToolsetRegistry();
    const toolset: Toolset = {
      name: 'test',
      description: 'test toolset',
      category: 'utility',
      tools: [datetimeTool, calculateTool],
    };

    registry.register(toolset);
    expect(registry.getTool('datetime')).toBe(datetimeTool);
    expect(registry.getTool('calculate')).toBe(calculateTool);
    expect(registry.getTool('nonexistent')).toBeUndefined();
  });

  it('rejects duplicate toolset name', () => {
    const registry = new ToolsetRegistry();
    const toolset: Toolset = {
      name: 'dup',
      description: 'd',
      category: 'utility',
      tools: [datetimeTool],
    };

    registry.register(toolset);
    expect(() => registry.register(toolset)).toThrow('already registered');
  });

  it('rejects duplicate tool name across toolsets', () => {
    const registry = new ToolsetRegistry();
    registry.register({
      name: 'a',
      description: 'a',
      category: 'utility',
      tools: [datetimeTool],
    });
    expect(() =>
      registry.register({
        name: 'b',
        description: 'b',
        category: 'utility',
        tools: [datetimeTool], // same tool name
      }),
    ).toThrow('already registered');
  });

  it('getByCategory returns filtered tools', () => {
    const registry = createDefaultToolsetRegistry();
    const terminalTools = registry.getByCategory('terminal');
    expect(terminalTools.length).toBeGreaterThan(0);
    for (const t of terminalTools) {
      expect(t.category).toBe('terminal');
    }
  });

  it('getAllTools returns all registered tools', () => {
    const registry = createDefaultToolsetRegistry();
    const all = registry.getAllTools();
    expect(all.length).toBe(registry.size);
    expect(all.length).toBeGreaterThanOrEqual(13); // at least 13 tools across all toolsets
  });

  it('listToolsets returns all toolsets', () => {
    const registry = createDefaultToolsetRegistry();
    const toolsets = registry.listToolsets();
    expect(toolsets.length).toBe(CORE_TOOLSETS.length);
  });

  it('toToolDefinitions converts to ToolDefinition array', () => {
    const registry = createDefaultToolsetRegistry();
    const defs = registry.toToolDefinitions();
    expect(defs.length).toBe(registry.size);
    for (const def of defs) {
      expect(def.name).toBeDefined();
      expect(def.description).toBeDefined();
      expect(def.inputSchema).toBeDefined();
      expect(def.domain).toBe('ops');
    }
  });

  it('size reflects total tool count', () => {
    const registry = new ToolsetRegistry();
    expect(registry.size).toBe(0);
    registry.register({
      name: 'x',
      description: 'x',
      category: 'utility',
      tools: [datetimeTool, calculateTool],
    });
    expect(registry.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// createDefaultToolsetRegistry
// ---------------------------------------------------------------------------

describe('createDefaultToolsetRegistry', () => {
  it('includes all expected tools', () => {
    const registry = createDefaultToolsetRegistry();
    const expectedNames = [
      'shell_exec',
      'file_read',
      'file_write',
      'file_list',
      'file_search',
      'grep',
      'web_fetch',
      'web_search',
      'ask_user',
      'datetime',
      'json_parse',
      'text_transform',
      'calculate',
    ];

    for (const name of expectedNames) {
      expect(registry.getTool(name), `Missing tool: ${name}`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// shellExecTool
// ---------------------------------------------------------------------------

describe('shellExecTool', () => {
  it('executes a simple echo command', async () => {
    const result = await shellExecTool.execute({ command: 'echo "hello world"' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello world');
    expect(result.metadata?.exitCode).toBe(0);
  });

  it('returns error for missing command', async () => {
    const result = await shellExecTool.execute({});
    expect(result.success).toBe(false);
    expect(result.output).toContain('command');
  });

  it('handles command failure', async () => {
    const result = await shellExecTool.execute({ command: 'exit 42' });
    expect(result.success).toBe(false);
  });

  it('handles timeout', async () => {
    const result = await shellExecTool.execute({ command: 'sleep 10', timeout: 200 });
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain('timed out');
  });
});

// ---------------------------------------------------------------------------
// fileReadTool
// ---------------------------------------------------------------------------

describe('fileReadTool', () => {
  it('reads an existing file', async () => {
    const filePath = join(FIXTURE_DIR, 'test-read.txt');
    await writeFile(filePath, 'hello content', 'utf-8');

    const result = await fileReadTool.execute({ path: filePath });
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello content');
  });

  it('handles missing file gracefully', async () => {
    const result = await fileReadTool.execute({ path: join(FIXTURE_DIR, 'no-such-file.txt') });
    expect(result.success).toBe(false);
    expect(result.output).toContain('Error');
  });

  it('requires path argument', async () => {
    const result = await fileReadTool.execute({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fileWriteTool
// ---------------------------------------------------------------------------

describe('fileWriteTool', () => {
  it('writes content to a file', async () => {
    const filePath = join(FIXTURE_DIR, 'test-write.txt');
    const result = await fileWriteTool.execute({ path: filePath, content: 'written!' });
    expect(result.success).toBe(true);

    const read = await fileReadTool.execute({ path: filePath });
    expect(read.output).toBe('written!');
  });

  it('creates parent directories when createDirs is true', async () => {
    const filePath = join(FIXTURE_DIR, 'subdir', 'deep', 'file.txt');
    const result = await fileWriteTool.execute({ path: filePath, content: 'deep', createDirs: true });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fileListTool
// ---------------------------------------------------------------------------

describe('fileListTool', () => {
  it('lists directory contents', async () => {
    await writeFile(join(FIXTURE_DIR, 'a.txt'), 'a');
    await writeFile(join(FIXTURE_DIR, 'b.txt'), 'b');
    await mkdir(join(FIXTURE_DIR, 'subdir'), { recursive: true });

    const result = await fileListTool.execute({ path: FIXTURE_DIR });
    expect(result.success).toBe(true);
    expect(result.output).toContain('a.txt');
    expect(result.output).toContain('b.txt');
    expect(result.output).toContain('subdir/');
  });

  it('handles non-existent directory', async () => {
    const result = await fileListTool.execute({ path: join(FIXTURE_DIR, 'nope') });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fileSearchTool
// ---------------------------------------------------------------------------

describe('fileSearchTool', () => {
  it('finds files matching a pattern', async () => {
    await writeFile(join(FIXTURE_DIR, 'hello.ts'), '');
    await writeFile(join(FIXTURE_DIR, 'world.ts'), '');
    await writeFile(join(FIXTURE_DIR, 'readme.md'), '');

    const result = await fileSearchTool.execute({ pattern: '*.ts', path: FIXTURE_DIR });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello.ts');
    expect(result.output).toContain('world.ts');
    expect(result.output).not.toContain('readme.md');
  });
});

// ---------------------------------------------------------------------------
// grepTool
// ---------------------------------------------------------------------------

describe('grepTool', () => {
  it('searches file contents with regex', async () => {
    await writeFile(join(FIXTURE_DIR, 'code.ts'), 'const x = 1;\nconst y = 2;\nlet z = 3;\n');

    const result = await grepTool.execute({ pattern: 'const', path: FIXTURE_DIR });
    expect(result.success).toBe(true);
    expect(result.output).toContain('const x = 1');
    expect(result.output).toContain('const y = 2');
    expect(result.output).not.toContain('let z = 3');
  });

  it('handles case-insensitive search', async () => {
    await writeFile(join(FIXTURE_DIR, 'mixed.txt'), 'Hello\nhello\nHELLO\n');

    const result = await grepTool.execute({ pattern: 'hello', path: FIXTURE_DIR, ignoreCase: true });
    expect(result.success).toBe(true);
    expect(result.metadata?.matchCount).toBe(3);
  });

  it('returns no matches gracefully', async () => {
    await writeFile(join(FIXTURE_DIR, 'empty.txt'), 'nothing here\n');

    const result = await grepTool.execute({ pattern: 'zzzzz', path: FIXTURE_DIR });
    expect(result.success).toBe(true);
    expect(result.output).toContain('No matches');
  });

  it('handles invalid regex gracefully', async () => {
    const result = await grepTool.execute({ pattern: '[invalid', path: FIXTURE_DIR });
    expect(result.success).toBe(false);
    expect(result.output).toContain('Invalid regular expression');
  });
});

// ---------------------------------------------------------------------------
// webFetchTool (mocked)
// ---------------------------------------------------------------------------

describe('webFetchTool', () => {
  it('returns error for missing URL', async () => {
    const result = await webFetchTool.execute({});
    expect(result.success).toBe(false);
    expect(result.output).toContain('url');
  });

  it('fetches and strips HTML', async () => {
    const mockHtml = '<html><body><p>Hello World</p></body></html>';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(mockHtml),
    }) as unknown as typeof fetch;

    try {
      const result = await webFetchTool.execute({ url: 'https://example.com' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello World');
      expect(result.output).not.toContain('<p>');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles JSON responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve('{"key":"value"}'),
    }) as unknown as typeof fetch;

    try {
      const result = await webFetchTool.execute({ url: 'https://api.example.com/data' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('"key"');
      expect(result.output).toContain('"value"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('truncates long content', async () => {
    const longText = 'x'.repeat(200);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve(longText),
    }) as unknown as typeof fetch;

    try {
      const result = await webFetchTool.execute({ url: 'https://example.com', maxLength: 50 });
      expect(result.success).toBe(true);
      expect(result.output.length).toBeLessThan(200);
      expect(result.output).toContain('truncated');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles HTTP errors', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    }) as unknown as typeof fetch;

    try {
      const result = await webFetchTool.execute({ url: 'https://example.com/missing' });
      expect(result.success).toBe(false);
      expect(result.output).toContain('404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// webSearchTool
// ---------------------------------------------------------------------------

describe('webSearchTool', () => {
  it('returns placeholder when unconfigured', async () => {
    const result = await webSearchTool.execute({ query: 'test query' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('test query');
    expect(result.metadata?.configured).toBe(false);
  });

  it('requires query argument', async () => {
    const result = await webSearchTool.execute({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// askUserTool
// ---------------------------------------------------------------------------

describe('askUserTool', () => {
  it('returns waiting message with question', async () => {
    const result = await askUserTool.execute({ question: 'What is your name?' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('WAITING_FOR_USER');
    expect(result.output).toContain('What is your name?');
    expect(result.metadata?.requiresUserInput).toBe(true);
    expect(result.metadata?.question).toBe('What is your name?');
  });

  it('includes choices when provided', async () => {
    const result = await askUserTool.execute({
      question: 'Pick one',
      choices: ['A', 'B', 'C'],
    });
    expect(result.success).toBe(true);
    expect(result.metadata?.choices).toEqual(['A', 'B', 'C']);
  });

  it('requires question argument', async () => {
    const result = await askUserTool.execute({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// datetimeTool
// ---------------------------------------------------------------------------

describe('datetimeTool', () => {
  it('returns valid ISO date string', async () => {
    const result = await datetimeTool.execute({});
    expect(result.success).toBe(true);
    // Should be a valid ISO string
    const parsed = new Date(result.output);
    expect(parsed.toISOString()).toBe(result.output);
  });

  it('handles timezone parameter', async () => {
    const result = await datetimeTool.execute({ timezone: 'America/New_York' });
    expect(result.success).toBe(true);
    expect(result.metadata?.timezone).toBe('America/New_York');
  });
});

// ---------------------------------------------------------------------------
// jsonParseTool
// ---------------------------------------------------------------------------

describe('jsonParseTool', () => {
  it('parses valid JSON', async () => {
    const result = await jsonParseTool.execute({ input: '{"a":1,"b":[2,3]}' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('"a": 1');
    expect(result.metadata?.valid).toBe(true);
    expect(result.metadata?.type).toBe('object');
  });

  it('handles arrays', async () => {
    const result = await jsonParseTool.execute({ input: '[1,2,3]' });
    expect(result.success).toBe(true);
    expect(result.metadata?.type).toBe('array');
  });

  it('returns error for invalid JSON', async () => {
    const result = await jsonParseTool.execute({ input: '{bad json' });
    expect(result.success).toBe(false);
    expect(result.output).toContain('Invalid JSON');
    expect(result.metadata?.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// textTransformTool
// ---------------------------------------------------------------------------

describe('textTransformTool', () => {
  it('counts words', async () => {
    const result = await textTransformTool.execute({ input: 'hello world foo', operation: 'word_count' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('3');
  });

  it('counts characters', async () => {
    const result = await textTransformTool.execute({ input: 'abc', operation: 'char_count' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('3');
  });

  it('converts to uppercase', async () => {
    const result = await textTransformTool.execute({ input: 'hello', operation: 'uppercase' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('HELLO');
  });

  it('rejects unknown operation', async () => {
    const result = await textTransformTool.execute({ input: 'hello', operation: 'unknown' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateTool
// ---------------------------------------------------------------------------

describe('calculateTool', () => {
  it('evaluates "2 + 3" to "5"', async () => {
    const result = await calculateTool.execute({ expression: '2 + 3' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('5');
  });

  it('evaluates complex expression', async () => {
    const result = await calculateTool.execute({ expression: '(10 + 5) * 2 / 3' });
    expect(result.success).toBe(true);
    expect(Number(result.output)).toBeCloseTo(10);
  });

  it('supports Math functions', async () => {
    const result = await calculateTool.execute({ expression: 'Math.sqrt(16)' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('4');
  });

  it('rejects dangerous expressions', async () => {
    const result = await calculateTool.execute({ expression: 'process.exit(1)' });
    expect(result.success).toBe(false);
  });

  it('handles division by zero', async () => {
    const result = await calculateTool.execute({ expression: '1/0' });
    expect(result.success).toBe(false);
    expect(result.output).toContain('finite');
  });

  it('requires expression argument', async () => {
    const result = await calculateTool.execute({});
    expect(result.success).toBe(false);
  });
});
