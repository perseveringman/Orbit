// ---------------------------------------------------------------------------
// @orbit/agent-core – Domain Agent Configs
// ---------------------------------------------------------------------------

import type { AgentDomain, DomainAgentConfig } from './types.js';

export const DOMAIN_AGENT_CONFIGS: Record<AgentDomain, DomainAgentConfig> = {
  planning: {
    domain: 'planning',
    systemPrompt:
      'You are the Planning agent. Break down user goals into structured, ' +
      'actionable task plans. Identify dependencies, estimate effort, and ' +
      'propose execution order. Never perform actions yourself—only plan.',
    allowedCapabilities: [
      'create-task',
      'update-task',
      'list-tasks',
      'read-object',
      'search-workspace',
    ],
    blockedCapabilities: ['delete-object', 'send-external', 'execute-code'],
    maxIterations: 8,
  },
  reading: {
    domain: 'reading',
    systemPrompt:
      'You are the Reading agent. Retrieve, parse, and summarize content ' +
      'from objects in the workspace. Provide accurate extractions and ' +
      'highlight key information. Do not modify any objects.',
    allowedCapabilities: [
      'read-object',
      'search-workspace',
      'list-objects',
      'extract-text',
    ],
    blockedCapabilities: [
      'create-object',
      'update-object',
      'delete-object',
      'send-external',
    ],
    maxIterations: 5,
  },
  research: {
    domain: 'research',
    systemPrompt:
      'You are the Research agent. Gather information from both workspace ' +
      'objects and external sources. Cross-reference findings, assess ' +
      'source credibility, and produce concise research briefs.',
    allowedCapabilities: [
      'read-object',
      'search-workspace',
      'web-search',
      'web-fetch',
      'summarize',
    ],
    blockedCapabilities: ['delete-object', 'execute-code', 'send-external'],
    maxIterations: 10,
  },
  writing: {
    domain: 'writing',
    systemPrompt:
      'You are the Writing agent. Draft, edit, and refine text content. ' +
      'Follow the user\'s voice and style preferences. Produce clean, ' +
      'well-structured prose.',
    allowedCapabilities: [
      'read-object',
      'create-object',
      'update-object',
      'search-workspace',
    ],
    blockedCapabilities: ['delete-object', 'send-external', 'execute-code'],
    maxIterations: 8,
  },
  review: {
    domain: 'review',
    systemPrompt:
      'You are the Review agent. Evaluate content for correctness, clarity, ' +
      'consistency, and completeness. Provide structured feedback with ' +
      'specific suggestions. Do not rewrite—only review.',
    allowedCapabilities: [
      'read-object',
      'search-workspace',
      'add-annotation',
      'list-annotations',
    ],
    blockedCapabilities: [
      'create-object',
      'update-object',
      'delete-object',
      'send-external',
    ],
    maxIterations: 6,
  },
  graph: {
    domain: 'graph',
    systemPrompt:
      'You are the Graph agent. Navigate and manipulate the object graph. ' +
      'Create links between objects, find related items, detect clusters, ' +
      'and build knowledge maps.',
    allowedCapabilities: [
      'read-object',
      'search-workspace',
      'create-link',
      'remove-link',
      'list-links',
      'traverse-graph',
    ],
    blockedCapabilities: ['delete-object', 'send-external', 'execute-code'],
    maxIterations: 8,
  },
  ops: {
    domain: 'ops',
    systemPrompt:
      'You are the Ops agent. Manage workspace operations including import, ' +
      'export, sync, and maintenance tasks. Handle system-level actions ' +
      'with care and always confirm destructive operations.',
    allowedCapabilities: [
      'read-object',
      'create-object',
      'update-object',
      'delete-object',
      'import-data',
      'export-data',
      'sync-workspace',
    ],
    blockedCapabilities: ['execute-code'],
    maxIterations: 12,
  },
};
