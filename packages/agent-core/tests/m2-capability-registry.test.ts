import { describe, expect, it, beforeEach } from 'vitest';

import {
  CapabilityRegistry,
  validateArgs,
  validateCapabilityDefinition,
  createExecutionContext,
} from '../src/index';

import type {
  CapabilityDefinition,
  CapabilityHandler,
  CapabilityFilter,
  ParameterSchema,
} from '../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDef(overrides?: Partial<CapabilityDefinition>): CapabilityDefinition {
  return {
    name: 'test-cap',
    description: 'A test capability',
    domain: 'reading',
    riskLevel: 'r0',
    scope: 'read',
    surface: ['global-chat', 'reader'],
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    returns: { type: 'string', description: 'Search results' },
    ...overrides,
  };
}

const echoHandler: CapabilityHandler = async (args) => ({
  success: true,
  output: JSON.stringify(args),
});

const failHandler: CapabilityHandler = async () => {
  throw new Error('handler exploded');
};

// ---------------------------------------------------------------------------
// CapabilityRegistry – register / deregister / get / has / list
// ---------------------------------------------------------------------------

describe('CapabilityRegistry – CRUD', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  it('register and get a capability', () => {
    const def = makeDef();
    registry.register(def, echoHandler);

    expect(registry.has('test-cap')).toBe(true);
    expect(registry.get('test-cap')).toBe(def);
    expect(registry.getHandler('test-cap')).toBe(echoHandler);
    expect(registry.size).toBe(1);
  });

  it('throws on duplicate registration', () => {
    registry.register(makeDef(), echoHandler);
    expect(() => registry.register(makeDef(), echoHandler)).toThrow(
      'already registered',
    );
  });

  it('deregister returns true and removes', () => {
    registry.register(makeDef(), echoHandler);
    const removed = registry.deregister('test-cap');

    expect(removed).toBe(true);
    expect(registry.has('test-cap')).toBe(false);
    expect(registry.get('test-cap')).toBeUndefined();
    expect(registry.getHandler('test-cap')).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it('deregister returns false for unknown name', () => {
    expect(registry.deregister('nope')).toBe(false);
  });

  it('list returns all definitions', () => {
    registry.register(makeDef({ name: 'a' }), echoHandler);
    registry.register(makeDef({ name: 'b' }), echoHandler);

    const listed = registry.list();
    expect(listed).toHaveLength(2);
    expect(listed.map((d) => d.name)).toContain('a');
    expect(listed.map((d) => d.name)).toContain('b');
  });
});

// ---------------------------------------------------------------------------
// registerAll – bulk registration
// ---------------------------------------------------------------------------

describe('CapabilityRegistry – registerAll', () => {
  it('registers multiple capabilities at once', () => {
    const registry = new CapabilityRegistry();
    registry.registerAll([
      { definition: makeDef({ name: 'bulk-a' }), handler: echoHandler },
      { definition: makeDef({ name: 'bulk-b' }), handler: echoHandler },
      { definition: makeDef({ name: 'bulk-c' }), handler: echoHandler },
    ]);

    expect(registry.size).toBe(3);
    expect(registry.has('bulk-a')).toBe(true);
    expect(registry.has('bulk-b')).toBe(true);
    expect(registry.has('bulk-c')).toBe(true);
  });

  it('throws on duplicate within batch', () => {
    const registry = new CapabilityRegistry();
    expect(() =>
      registry.registerAll([
        { definition: makeDef({ name: 'dup' }), handler: echoHandler },
        { definition: makeDef({ name: 'dup' }), handler: echoHandler },
      ]),
    ).toThrow('already registered');
  });
});

// ---------------------------------------------------------------------------
// query – filtering by domain, riskLevel, surface, tags
// ---------------------------------------------------------------------------

describe('CapabilityRegistry – query', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
    registry.registerAll([
      {
        definition: makeDef({
          name: 'read-obj',
          domain: 'reading',
          riskLevel: 'r0',
          scope: 'read',
          surface: ['reader', 'global-chat'],
          tags: ['core', 'fast'],
        }),
        handler: echoHandler,
      },
      {
        definition: makeDef({
          name: 'write-obj',
          domain: 'writing',
          riskLevel: 'r1',
          scope: 'write',
          surface: ['writing'],
          tags: ['core'],
        }),
        handler: echoHandler,
      },
      {
        definition: makeDef({
          name: 'external-search',
          domain: 'research',
          riskLevel: 'r2',
          scope: 'execute',
          surface: ['research', 'global-chat'],
          tags: ['network'],
        }),
        handler: echoHandler,
      },
    ]);
  });

  it('filters by domain', () => {
    const results = registry.query({ domain: 'reading' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('read-obj');
  });

  it('filters by riskLevel', () => {
    const results = registry.query({ riskLevel: 'r2' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('external-search');
  });

  it('filters by scope', () => {
    const results = registry.query({ scope: 'write' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('write-obj');
  });

  it('filters by surface', () => {
    const results = registry.query({ surface: 'global-chat' });
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name);
    expect(names).toContain('read-obj');
    expect(names).toContain('external-search');
  });

  it('filters by tags (OR match)', () => {
    const results = registry.query({ tags: ['network'] });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('external-search');
  });

  it('filters by tags matching multiple', () => {
    const results = registry.query({ tags: ['core'] });
    expect(results).toHaveLength(2);
  });

  it('combines multiple filters', () => {
    const results = registry.query({ domain: 'reading', surface: 'reader' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('read-obj');
  });

  it('returns empty for no matches', () => {
    const results = registry.query({ domain: 'ops' });
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// toToolDefinitions – conversion to ToolDefinition[]
// ---------------------------------------------------------------------------

describe('CapabilityRegistry – toToolDefinitions', () => {
  it('converts capabilities to ToolDefinition format', () => {
    const registry = new CapabilityRegistry();
    registry.register(
      makeDef({
        name: 'search',
        domain: 'reading',
        riskLevel: 'r0',
        scope: 'read',
      }),
      echoHandler,
    );

    const tools = registry.toToolDefinitions();
    expect(tools).toHaveLength(1);

    const tool = tools[0];
    expect(tool.name).toBe('search');
    expect(tool.domain).toBe('reading');
    expect(tool.description).toBe('A test capability');
    expect(tool.riskLevel).toBe('R0-read');
    expect(tool.approvalPolicy).toBe('A0-auto');
    expect(tool.executionMode).toBe('sync');
    expect(tool.inputSchema).toBeDefined();
  });

  it('maps risk levels correctly', () => {
    const registry = new CapabilityRegistry();
    registry.registerAll([
      { definition: makeDef({ name: 'r0', riskLevel: 'r0' }), handler: echoHandler },
      { definition: makeDef({ name: 'r1', riskLevel: 'r1' }), handler: echoHandler },
      { definition: makeDef({ name: 'r2', riskLevel: 'r2' }), handler: echoHandler },
      { definition: makeDef({ name: 'r3', riskLevel: 'r3' }), handler: echoHandler },
    ]);

    const tools = registry.toToolDefinitions();
    const riskMap = Object.fromEntries(tools.map((t) => [t.name, t.riskLevel]));
    expect(riskMap).toEqual({
      r0: 'R0-read',
      r1: 'R1-internal-write',
      r2: 'R2-external-read',
      r3: 'R3-external-write',
    });
  });

  it('maps scope to approval policy', () => {
    const registry = new CapabilityRegistry();
    registry.registerAll([
      { definition: makeDef({ name: 'rd', scope: 'read' }), handler: echoHandler },
      { definition: makeDef({ name: 'wr', scope: 'write' }), handler: echoHandler },
      { definition: makeDef({ name: 'ex', scope: 'execute' }), handler: echoHandler },
      { definition: makeDef({ name: 'ad', scope: 'admin' }), handler: echoHandler },
    ]);

    const tools = registry.toToolDefinitions();
    const approvalMap = Object.fromEntries(tools.map((t) => [t.name, t.approvalPolicy]));
    expect(approvalMap).toEqual({
      rd: 'A0-auto',
      wr: 'A1-transparent',
      ex: 'A2-confirm',
      ad: 'A3-dual-confirm',
    });
  });

  it('accepts a filter parameter', () => {
    const registry = new CapabilityRegistry();
    registry.registerAll([
      { definition: makeDef({ name: 'a', domain: 'reading' }), handler: echoHandler },
      { definition: makeDef({ name: 'b', domain: 'writing' }), handler: echoHandler },
    ]);

    const tools = registry.toToolDefinitions({ domain: 'writing' });
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// execute – valid args
// ---------------------------------------------------------------------------

describe('CapabilityRegistry – execute', () => {
  it('executes with valid args and returns result', async () => {
    const registry = new CapabilityRegistry();
    registry.register(makeDef(), echoHandler);

    const result = await registry.execute('test-cap', { query: 'hello' });
    expect(result.success).toBe(true);
    expect(result.output).toBe(JSON.stringify({ query: 'hello' }));
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('passes execution context to handler', async () => {
    const registry = new CapabilityRegistry();
    let receivedCtx: unknown;
    const handler: CapabilityHandler = async (_args, ctx) => {
      receivedCtx = ctx;
      return { success: true, output: 'ok' };
    };
    registry.register(makeDef(), handler);

    const ctx = createExecutionContext({
      runId: 'run-1',
      sessionId: 'ses-1',
      surface: 'global-chat',
    });

    await registry.execute('test-cap', { query: 'test' }, ctx);
    expect(receivedCtx).toBe(ctx);
  });

  it('returns error for unknown capability', async () => {
    const registry = new CapabilityRegistry();
    const result = await registry.execute('nope', {});
    expect(result.success).toBe(false);
    expect(result.output).toContain('not found');
  });

  it('catches handler errors', async () => {
    const registry = new CapabilityRegistry();
    registry.register(makeDef(), failHandler);

    const result = await registry.execute('test-cap', { query: 'x' });
    expect(result.success).toBe(false);
    expect(result.output).toContain('handler exploded');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// execute – validation errors
// ---------------------------------------------------------------------------

describe('CapabilityRegistry – execute validation', () => {
  it('rejects missing required args', async () => {
    const registry = new CapabilityRegistry();
    registry.register(makeDef(), echoHandler);

    const result = await registry.execute('test-cap', {});
    expect(result.success).toBe(false);
    expect(result.output).toContain('Missing required field');
    expect(result.output).toContain('query');
  });

  it('rejects wrong arg type', async () => {
    const registry = new CapabilityRegistry();
    registry.register(makeDef(), echoHandler);

    const result = await registry.execute('test-cap', { query: 42 });
    expect(result.success).toBe(false);
    expect(result.output).toContain('expected type "string"');
    expect(result.output).toContain('got "number"');
  });

  it('passes with optional args absent', async () => {
    const registry = new CapabilityRegistry();
    const def = makeDef({
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      },
    });
    registry.register(def, echoHandler);

    const result = await registry.execute('test-cap', { query: 'hello' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateArgs
// ---------------------------------------------------------------------------

describe('validateArgs', () => {
  const schema: ParameterSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'User name' },
      age: { type: 'number', description: 'User age' },
      active: { type: 'boolean', description: 'Is active' },
      tags: { type: 'array', description: 'Tags' },
      role: { type: 'string', description: 'Role', enum: ['admin', 'user'] },
    },
    required: ['name'],
  };

  it('valid args pass', () => {
    const result = validateArgs({ name: 'Alice', age: 30 }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('missing required field fails', () => {
    const result = validateArgs({ age: 30 }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('name');
  });

  it('wrong type fails', () => {
    const result = validateArgs({ name: 123 }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('expected type "string"');
  });

  it('array type is checked', () => {
    const result = validateArgs({ name: 'a', tags: 'not-array' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('expected type "array"');
  });

  it('enum validation works', () => {
    const result = validateArgs({ name: 'a', role: 'superadmin' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must be one of');
  });

  it('extra fields are allowed', () => {
    const result = validateArgs({ name: 'a', extra: true }, schema);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateCapabilityDefinition
// ---------------------------------------------------------------------------

describe('validateCapabilityDefinition', () => {
  it('valid definition passes', () => {
    const result = validateCapabilityDefinition(makeDef());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty name', () => {
    const result = validateCapabilityDefinition(makeDef({ name: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('rejects empty description', () => {
    const result = validateCapabilityDefinition(makeDef({ description: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('description'))).toBe(true);
  });

  it('rejects invalid domain', () => {
    const result = validateCapabilityDefinition(makeDef({ domain: 'invalid' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('domain'))).toBe(true);
  });

  it('rejects invalid riskLevel', () => {
    const result = validateCapabilityDefinition(makeDef({ riskLevel: 'r9' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('riskLevel'))).toBe(true);
  });

  it('rejects invalid scope', () => {
    const result = validateCapabilityDefinition(makeDef({ scope: 'destroy' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('scope'))).toBe(true);
  });

  it('rejects empty surface array', () => {
    const result = validateCapabilityDefinition(makeDef({ surface: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('surface'))).toBe(true);
  });

  it('rejects invalid timeout', () => {
    const result = validateCapabilityDefinition(makeDef({ timeout: -100 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Timeout'))).toBe(true);
  });

  it('accepts valid optional fields', () => {
    const result = validateCapabilityDefinition(
      makeDef({
        tags: ['fast'],
        timeout: 5000,
        retryable: true,
        examples: [{ description: 'ex', input: { query: 'test' }, output: 'result' }],
      }),
    );
    expect(result.valid).toBe(true);
  });
});
