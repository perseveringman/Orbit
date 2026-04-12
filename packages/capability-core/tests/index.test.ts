import { describe, expect, it } from 'vitest';

import {
  capabilityKey,
  supportsPermission,
  createDomainRegistry,
  createMcpServer,
  createMcpClient,
  createPolicyEngine,
  createAuditSink,
  createConfirmationManager,
  createIsolationManager,
} from '../src/index';
import type {
  CapabilityDefinition,
  PolicyContext,
  McpResource,
  McpResourceContent,
} from '../src/index';

// ---- Helpers ----

function makeCapability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: 'test.cap',
    version: '1.0.0',
    domain: 'workspace_query',
    kind: 'search',
    exposure: 'internal',
    inputSchema: {},
    outputSchema: {},
    risk: 'R0',
    approval: 'A0',
    audit: false,
    egress: 'none',
    description: 'Test capability',
    displayName: 'Test Cap',
    ...overrides,
  };
}

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    workspaceId: 'ws-1',
    surface: 'desktop',
    dataLevel: 'public',
    userRole: 'owner',
    ...overrides,
  };
}

// ---- Original tests ----

describe('capability-core', () => {
  it('生成 capability 键并校验权限', () => {
    const manifest = {
      id: 'cap.search',
      name: '全文搜索',
      version: '1.0.0',
      kind: 'search',
      description: '在工作区中执行搜索',
      permissions: [{ resource: 'workspace', access: 'read' }],
      inputs: ['query'],
      outputs: ['results'],
    } as const;

    expect(capabilityKey(manifest)).toBe('cap.search@1.0.0');
    expect(supportsPermission(manifest, 'workspace', 'read')).toBe(true);
  });
});

// ---- Domain Registry ----

describe('DomainRegistry', () => {
  it('has 9 pre-populated domains', () => {
    const registry = createDomainRegistry();
    expect(registry.getDomains()).toHaveLength(9);
  });

  it('pre-populated capabilities cover all domains', () => {
    const registry = createDomainRegistry();
    for (const domain of registry.getDomains()) {
      expect(registry.getByDomain(domain).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('registers and retrieves by id', () => {
    const registry = createDomainRegistry();
    const cap = makeCapability({ id: 'custom.cap', domain: 'research' });
    registry.register(cap);
    expect(registry.getById('custom.cap')).toEqual(cap);
  });

  it('throws on duplicate registration', () => {
    const registry = createDomainRegistry();
    const cap = makeCapability({ id: 'workspace_query.search', domain: 'workspace_query' });
    expect(() => registry.register(cap)).toThrow('already registered');
  });

  it('unregisters capabilities', () => {
    const registry = createDomainRegistry();
    const before = registry.getAll().length;
    expect(registry.unregister('workspace_query.search')).toBe(true);
    expect(registry.getAll().length).toBe(before - 1);
    expect(registry.getById('workspace_query.search')).toBeNull();
  });

  it('returns null for unknown id', () => {
    const registry = createDomainRegistry();
    expect(registry.getById('nope')).toBeNull();
  });
});

// ---- MCP Server ----

describe('McpServer', () => {
  it('registers and lists resources', () => {
    const server = createMcpServer();
    const resource: McpResource = {
      uri: 'orbit://ws/doc-1',
      name: 'Doc 1',
      type: 'document',
      mimeType: 'text/plain',
    };
    const content: McpResourceContent = {
      uri: resource.uri,
      mimeType: 'text/plain',
      text: 'Hello',
    };
    server.registerResource(resource, () => content);
    expect(server.listResources()).toHaveLength(1);
    expect(server.readResource(resource.uri)).toEqual(content);
  });

  it('returns null for unknown resource', () => {
    const server = createMcpServer();
    expect(server.readResource('orbit://nope')).toBeNull();
  });

  it('registers and executes tools', async () => {
    const server = createMcpServer();
    server.registerTool(
      { name: 'search', description: 'Search', inputSchema: {}, capabilityId: 'cap.search' },
      async () => ({ success: true, content: 'found it' }),
    );
    expect(server.listTools()).toHaveLength(1);
    const result = await server.executeTool('search', { q: 'test' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('found it');
  });

  it('returns error for unknown tool', async () => {
    const server = createMcpServer();
    const result = await server.executeTool('nope', {});
    expect(result.success).toBe(false);
    expect(result.isError).toBe(true);
  });

  it('catches tool handler errors', async () => {
    const server = createMcpServer();
    server.registerTool(
      { name: 'fail', description: 'Fail', inputSchema: {}, capabilityId: 'cap.fail' },
      async () => { throw new Error('boom'); },
    );
    const result = await server.executeTool('fail', {});
    expect(result.success).toBe(false);
    expect(result.content).toContain('boom');
  });

  it('registers and resolves prompts with template substitution', () => {
    const server = createMcpServer();
    server.registerPrompt({
      name: 'greet',
      description: 'Greeting',
      arguments: [{ name: 'name', description: 'User name', required: true }],
      template: 'Hello, {{name}}!',
    });
    expect(server.listPrompts()).toHaveLength(1);
    expect(server.getPrompt('greet', { name: 'Orbit' })).toBe('Hello, Orbit!');
  });

  it('returns null for unknown prompt', () => {
    const server = createMcpServer();
    expect(server.getPrompt('nope', {})).toBeNull();
  });
});

// ---- MCP Client ----

describe('McpClient', () => {
  it('connects and disconnects', async () => {
    const client = createMcpClient({ serverUrl: 'http://localhost:3000', name: 'test', version: '1.0.0' });
    expect(client.isConnected()).toBe(false);
    await client.connect();
    expect(client.isConnected()).toBe(true);
    client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('throws when calling methods while disconnected', async () => {
    const client = createMcpClient({ serverUrl: 'http://localhost:3000', name: 'test', version: '1.0.0' });
    await expect(client.listResources()).rejects.toThrow('Not connected');
    await expect(client.listTools()).rejects.toThrow('Not connected');
    await expect(client.listPrompts()).rejects.toThrow('Not connected');
  });

  it('lists empty resources when connected', async () => {
    const client = createMcpClient({ serverUrl: 'http://localhost:3000', name: 'test', version: '1.0.0' });
    await client.connect();
    const resources = await client.listResources();
    expect(resources).toHaveLength(0);
  });

  it('preserves config', () => {
    const config = { serverUrl: 'http://example.com', name: 'ext', version: '2.0.0', timeout: 5000 };
    const client = createMcpClient(config);
    expect(client.config).toEqual(config);
  });
});

// ---- Policy Engine ----

describe('PolicyEngine', () => {
  it('allows read-only capability for any role', () => {
    const engine = createPolicyEngine();
    const cap = makeCapability({ risk: 'R0', egress: 'none' });
    const decision = engine.evaluate(cap, makeContext({ userRole: 'viewer' }));
    expect(decision.allowed).toBe(true);
  });

  it('denies viewer for non-R0 capability', () => {
    const engine = createPolicyEngine();
    const cap = makeCapability({ risk: 'R1' });
    const decision = engine.evaluate(cap, makeContext({ userRole: 'viewer' }));
    expect(decision.allowed).toBe(false);
  });

  it('denies viewer for external exposure', () => {
    const engine = createPolicyEngine();
    const cap = makeCapability({ risk: 'R0', exposure: 'external' });
    const decision = engine.evaluate(cap, makeContext({ userRole: 'viewer' }));
    expect(decision.allowed).toBe(false);
  });

  it('denies restricted data with egress', () => {
    const engine = createPolicyEngine();
    const cap = makeCapability({ risk: 'R1', egress: 'metadata_only' });
    const decision = engine.evaluate(cap, makeContext({ dataLevel: 'restricted' }));
    expect(decision.allowed).toBe(false);
  });

  it('denies confidential data with full content egress', () => {
    const engine = createPolicyEngine();
    const cap = makeCapability({ risk: 'R0', egress: 'full_content', approval: 'A2' });
    const decision = engine.evaluate(cap, makeContext({ dataLevel: 'confidential' }));
    expect(decision.allowed).toBe(false);
    expect(decision.egressAllowed).toBe(false);
  });

  it('allows owner with standard capability', () => {
    const engine = createPolicyEngine();
    const cap = makeCapability({ risk: 'R1', approval: 'A1' });
    const decision = engine.evaluate(cap, makeContext({ userRole: 'owner' }));
    expect(decision.allowed).toBe(true);
  });

  it('adds and removes custom rules', () => {
    const engine = createPolicyEngine();
    const defaultCount = engine.getRules().length;
    engine.addRule({ id: 'custom', description: 'Custom rule', evaluate: () => null });
    expect(engine.getRules().length).toBe(defaultCount + 1);
    expect(engine.removeRule('custom')).toBe(true);
    expect(engine.getRules().length).toBe(defaultCount);
  });

  it('custom deny rule takes effect', () => {
    const engine = createPolicyEngine();
    engine.addRule({
      id: 'block-all',
      description: 'Block everything',
      evaluate: () => ({ allowed: false, reason: 'blocked' }),
    });
    const decision = engine.evaluate(makeCapability(), makeContext());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('blocked');
  });
});

// ---- Audit Sink ----

describe('AuditSink', () => {
  it('records and counts entries', () => {
    const sink = createAuditSink();
    const entry = sink.record({
      capabilityId: 'test.cap',
      domain: 'workspace_query',
      action: 'invoked',
    });
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(sink.count()).toBe(1);
  });

  it('queries by capability', () => {
    const sink = createAuditSink();
    sink.record({ capabilityId: 'a', domain: 'workspace_query', action: 'invoked' });
    sink.record({ capabilityId: 'b', domain: 'research', action: 'completed' });
    expect(sink.getByCapability('a')).toHaveLength(1);
    expect(sink.getByCapability('b')).toHaveLength(1);
  });

  it('queries by session', () => {
    const sink = createAuditSink();
    sink.record({ capabilityId: 'a', domain: 'workspace_query', action: 'invoked', sessionId: 's1' });
    sink.record({ capabilityId: 'b', domain: 'research', action: 'invoked', sessionId: 's2' });
    expect(sink.getBySession('s1')).toHaveLength(1);
  });

  it('filters with AuditFilter', () => {
    const sink = createAuditSink();
    sink.record({ capabilityId: 'a', domain: 'workspace_query', action: 'invoked' });
    sink.record({ capabilityId: 'a', domain: 'workspace_query', action: 'completed' });
    sink.record({ capabilityId: 'b', domain: 'research', action: 'denied' });

    expect(sink.query({ action: 'invoked' })).toHaveLength(1);
    expect(sink.query({ domain: 'workspace_query' })).toHaveLength(2);
    expect(sink.query({ capabilityId: 'b' })).toHaveLength(1);
  });

  it('getRecent returns last N', () => {
    const sink = createAuditSink();
    for (let i = 0; i < 5; i++) {
      sink.record({ capabilityId: `cap-${i}`, domain: 'graph', action: 'invoked' });
    }
    expect(sink.getRecent(3)).toHaveLength(3);
    expect(sink.getRecent(3)[2].capabilityId).toBe('cap-4');
  });

  it('clears entries', () => {
    const sink = createAuditSink();
    sink.record({ capabilityId: 'a', domain: 'workspace_query', action: 'invoked' });
    sink.clear();
    expect(sink.count()).toBe(0);
  });
});

// ---- Confirmation Manager ----

describe('ConfirmationManager', () => {
  it('silent policy for A0 approval', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A0' });
    const policy = manager.getPolicy(cap);
    expect(policy.level).toBe('silent');
    expect(policy.requiresUserPresence).toBe(false);
  });

  it('session_auth policy for A1 approval', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A1' });
    const policy = manager.getPolicy(cap);
    expect(policy.level).toBe('session_auth');
    expect(policy.sessionDuration).toBe(3600);
  });

  it('per_call policy for A2 approval', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A2' });
    expect(manager.getPolicy(cap).level).toBe('per_call');
  });

  it('dual_stage policy for A3 approval', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A3' });
    expect(manager.getPolicy(cap).level).toBe('dual_stage');
  });

  it('silent requests are auto-approved', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A0' });
    const request = manager.requestConfirmation(cap, makeContext());
    expect(request.status).toBe('approved');
  });

  it('pending requests can be approved', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A2' });
    const request = manager.requestConfirmation(cap, makeContext());
    expect(request.status).toBe('pending');
    expect(manager.getPending()).toHaveLength(1);
    expect(manager.approve(request.id)).toBe(true);
    expect(manager.getPending()).toHaveLength(0);
  });

  it('pending requests can be denied', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A2' });
    const request = manager.requestConfirmation(cap, makeContext());
    expect(manager.deny(request.id)).toBe(true);
    expect(manager.getPending()).toHaveLength(0);
  });

  it('cannot approve already-approved request', () => {
    const manager = createConfirmationManager();
    const cap = makeCapability({ approval: 'A2' });
    const request = manager.requestConfirmation(cap, makeContext());
    manager.approve(request.id);
    expect(manager.approve(request.id)).toBe(false);
  });

  it('session authorization works', () => {
    const manager = createConfirmationManager();
    expect(manager.isSessionAuthorized('s1', 'cap.a')).toBe(false);
    manager.authorizeSession('s1', 'cap.a', 3600);
    expect(manager.isSessionAuthorized('s1', 'cap.a')).toBe(true);
    expect(manager.isSessionAuthorized('s1', 'cap.b')).toBe(false);
  });
});

// ---- Isolation Manager ----

describe('IsolationManager', () => {
  it('sensitive domain -> vault', () => {
    const manager = createIsolationManager();
    const cap = makeCapability({ domain: 'sensitive' });
    expect(manager.getChannel(cap, makeContext())).toBe('vault');
  });

  it('restricted data -> vault', () => {
    const manager = createIsolationManager();
    const cap = makeCapability();
    expect(manager.getChannel(cap, makeContext({ dataLevel: 'restricted' }))).toBe('vault');
  });

  it('confidential data -> guarded', () => {
    const manager = createIsolationManager();
    const cap = makeCapability();
    expect(manager.getChannel(cap, makeContext({ dataLevel: 'confidential' }))).toBe('guarded');
  });

  it('high risk -> guarded', () => {
    const manager = createIsolationManager();
    const cap = makeCapability({ risk: 'R3' });
    expect(manager.getChannel(cap, makeContext())).toBe('guarded');
  });

  it('external + egress -> guarded', () => {
    const manager = createIsolationManager();
    const cap = makeCapability({ exposure: 'external', egress: 'metadata_only' });
    expect(manager.getChannel(cap, makeContext())).toBe('guarded');
  });

  it('standard capability -> open', () => {
    const manager = createIsolationManager();
    const cap = makeCapability();
    expect(manager.getChannel(cap, makeContext())).toBe('open');
  });

  it('vault channel denies viewer', () => {
    const manager = createIsolationManager();
    const cap = makeCapability({ domain: 'sensitive' });
    const result = manager.validateExecution(cap, makeContext({ userRole: 'viewer' }));
    expect(result.allowed).toBe(false);
    expect(result.channel).toBe('vault');
  });

  it('vault channel allows owner', () => {
    const manager = createIsolationManager();
    const cap = makeCapability({ domain: 'sensitive' });
    const result = manager.validateExecution(cap, makeContext({ userRole: 'owner' }));
    expect(result.allowed).toBe(true);
    expect(result.channel).toBe('vault');
  });

  it('tracks channel stats', () => {
    const manager = createIsolationManager();
    manager.validateExecution(makeCapability(), makeContext());
    manager.validateExecution(makeCapability({ domain: 'sensitive' }), makeContext());
    const stats = manager.getChannelStats();
    expect(stats.open).toBe(1);
    expect(stats.vault).toBe(1);
  });

  it('getPolicy returns correct policy for each channel', () => {
    const manager = createIsolationManager();
    const open = manager.getPolicy('open');
    expect(open.encryptionRequired).toBe(false);
    expect(open.auditRequired).toBe(false);

    const guarded = manager.getPolicy('guarded');
    expect(guarded.auditRequired).toBe(true);
    expect(guarded.maxDataRetention).toBe(86_400);

    const vault = manager.getPolicy('vault');
    expect(vault.encryptionRequired).toBe(true);
    expect(vault.maxDataRetention).toBe(3_600);
  });
});
