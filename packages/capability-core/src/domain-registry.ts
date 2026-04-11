// ---------------------------------------------------------------------------
// @orbit/capability-core – Eight Domain Registry (Wave 2-C)
// ---------------------------------------------------------------------------

import type { CapabilityDefinition, CapabilityDomain } from './capability-interface.js';

export type { CapabilityDomain };

export interface DomainRegistry {
  register(definition: CapabilityDefinition): void;
  getByDomain(domain: CapabilityDomain): readonly CapabilityDefinition[];
  getById(id: string): CapabilityDefinition | null;
  getAll(): readonly CapabilityDefinition[];
  unregister(id: string): boolean;
  getDomains(): readonly CapabilityDomain[];
}

const ALL_DOMAINS: readonly CapabilityDomain[] = [
  'workspace_query',
  'content_capture',
  'research',
  'writing',
  'planning',
  'graph',
  'integration',
  'sensitive',
] as const;

export function createDomainRegistry(): DomainRegistry {
  const definitions = new Map<string, CapabilityDefinition>();

  const registry: DomainRegistry = {
    register(definition: CapabilityDefinition): void {
      if (definitions.has(definition.id)) {
        throw new Error(`Capability "${definition.id}" is already registered`);
      }
      if (!ALL_DOMAINS.includes(definition.domain)) {
        throw new Error(`Unknown domain "${definition.domain}"`);
      }
      definitions.set(definition.id, definition);
    },

    getByDomain(domain: CapabilityDomain): readonly CapabilityDefinition[] {
      return [...definitions.values()].filter((d) => d.domain === domain);
    },

    getById(id: string): CapabilityDefinition | null {
      return definitions.get(id) ?? null;
    },

    getAll(): readonly CapabilityDefinition[] {
      return [...definitions.values()];
    },

    unregister(id: string): boolean {
      return definitions.delete(id);
    },

    getDomains(): readonly CapabilityDomain[] {
      return ALL_DOMAINS;
    },
  };

  // Pre-populate with example capabilities for each domain
  const examples: readonly CapabilityDefinition[] = [
    {
      id: 'workspace_query.search',
      version: '1.0.0',
      domain: 'workspace_query',
      kind: 'search',
      exposure: 'internal',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      outputSchema: { type: 'array', items: { type: 'object' } },
      risk: 'R0',
      approval: 'A0',
      audit: false,
      egress: 'none',
      description: 'Full-text search across workspace objects',
      displayName: 'Workspace Search',
    },
    {
      id: 'content_capture.web_clip',
      version: '1.0.0',
      domain: 'content_capture',
      kind: 'import',
      exposure: 'external',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { content: { type: 'string' } } },
      risk: 'R2',
      approval: 'A1',
      audit: true,
      egress: 'metadata_only',
      description: 'Capture web page content as a workspace object',
      displayName: 'Web Clipper',
    },
    {
      id: 'research.summarize',
      version: '1.0.0',
      domain: 'research',
      kind: 'agent',
      exposure: 'local',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { summary: { type: 'string' } } },
      risk: 'R1',
      approval: 'A0',
      audit: true,
      egress: 'content_hash',
      description: 'Summarize text content using AI',
      displayName: 'AI Summarizer',
    },
    {
      id: 'writing.draft',
      version: '1.0.0',
      domain: 'writing',
      kind: 'agent',
      exposure: 'local',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { text: { type: 'string' } } },
      risk: 'R1',
      approval: 'A1',
      audit: true,
      egress: 'none',
      description: 'Generate draft content from a prompt',
      displayName: 'Draft Writer',
    },
    {
      id: 'planning.create_task',
      version: '1.0.0',
      domain: 'planning',
      kind: 'agent',
      exposure: 'internal',
      inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { taskId: { type: 'string' } } },
      risk: 'R1',
      approval: 'A1',
      audit: true,
      egress: 'none',
      description: 'Create a new planning task',
      displayName: 'Task Creator',
    },
    {
      id: 'graph.traverse',
      version: '1.0.0',
      domain: 'graph',
      kind: 'search',
      exposure: 'internal',
      inputSchema: { type: 'object', properties: { rootId: { type: 'string' }, depth: { type: 'number' } } },
      outputSchema: { type: 'array', items: { type: 'object' } },
      risk: 'R0',
      approval: 'A0',
      audit: false,
      egress: 'none',
      description: 'Traverse the object graph from a root node',
      displayName: 'Graph Traversal',
    },
    {
      id: 'integration.webhook',
      version: '1.0.0',
      domain: 'integration',
      kind: 'export',
      exposure: 'external',
      inputSchema: { type: 'object', properties: { url: { type: 'string' }, payload: { type: 'object' } } },
      outputSchema: { type: 'object', properties: { statusCode: { type: 'number' } } },
      risk: 'R3',
      approval: 'A2',
      audit: true,
      egress: 'full_content',
      description: 'Send data to an external webhook endpoint',
      displayName: 'Webhook Sender',
    },
    {
      id: 'sensitive.encrypt',
      version: '1.0.0',
      domain: 'sensitive',
      kind: 'agent',
      exposure: 'internal',
      inputSchema: { type: 'object', properties: { data: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { encrypted: { type: 'string' } } },
      risk: 'R3',
      approval: 'A3',
      audit: true,
      egress: 'none',
      description: 'Encrypt sensitive data for storage',
      displayName: 'Data Encryptor',
    },
  ];

  for (const example of examples) {
    definitions.set(example.id, example);
  }

  return registry;
}
