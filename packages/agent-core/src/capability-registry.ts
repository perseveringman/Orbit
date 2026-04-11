// ---------------------------------------------------------------------------
// @orbit/agent-core – Capability Registry (M2)
// ---------------------------------------------------------------------------

import type { ExecutionContext } from './execution-context.js';
import type { ToolDefinition } from './types.js';
import { validateArgs } from './capability-validator.js';

// ---- Schema types ----

export interface PropertySchema {
  readonly type: string;
  readonly description: string;
  readonly enum?: readonly string[];
  readonly default?: unknown;
}

export interface ParameterSchema {
  readonly type: 'object';
  readonly properties: Record<string, PropertySchema>;
  readonly required?: readonly string[];
}

export interface ReturnSchema {
  readonly type: string;
  readonly description: string;
}

export interface CapabilityExample {
  readonly description: string;
  readonly input: Record<string, unknown>;
  readonly output: string;
}

// ---- Capability definition ----

export interface CapabilityDefinition {
  readonly name: string;
  readonly description: string;
  readonly domain: string;
  readonly riskLevel: string;
  readonly scope: string;
  readonly surface: readonly string[];
  readonly parameters: ParameterSchema;
  readonly returns: ReturnSchema;
  readonly examples?: readonly CapabilityExample[];
  readonly tags?: readonly string[];
  readonly timeout?: number;
  readonly retryable?: boolean;
}

// ---- Handler & result ----

export interface CapabilityHandler {
  (args: Record<string, unknown>, context?: ExecutionContext): Promise<CapabilityResult>;
}

export interface CapabilityResult {
  readonly success: boolean;
  readonly output: string;
  readonly metadata?: Record<string, unknown>;
  readonly durationMs?: number;
}

// ---- Filter ----

export interface CapabilityFilter {
  readonly domain?: string;
  readonly riskLevel?: string;
  readonly scope?: string;
  readonly surface?: string;
  readonly tags?: readonly string[];
}

// ---- Risk / scope mappings for ToolDefinition conversion ----

const RISK_TO_TOOL_RISK: Record<string, ToolDefinition['riskLevel']> = {
  r0: 'R0-read',
  r1: 'R1-internal-write',
  r2: 'R2-external-read',
  r3: 'R3-external-write',
};

const SCOPE_TO_APPROVAL: Record<string, ToolDefinition['approvalPolicy']> = {
  read: 'A0-auto',
  write: 'A1-transparent',
  execute: 'A2-confirm',
  admin: 'A3-dual-confirm',
};

// ---- CapabilityRegistry ----

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDefinition>();
  private readonly handlers = new Map<string, CapabilityHandler>();

  /**
   * Register a capability with its definition and handler.
   */
  register(definition: CapabilityDefinition, handler: CapabilityHandler): void {
    if (this.capabilities.has(definition.name)) {
      throw new Error(`Capability "${definition.name}" is already registered`);
    }
    this.capabilities.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
  }

  /**
   * Bulk register capabilities.
   */
  registerAll(
    entries: readonly { definition: CapabilityDefinition; handler: CapabilityHandler }[],
  ): void {
    for (const entry of entries) {
      this.register(entry.definition, entry.handler);
    }
  }

  /**
   * Deregister a capability by name.
   */
  deregister(name: string): boolean {
    const existed = this.capabilities.delete(name);
    this.handlers.delete(name);
    return existed;
  }

  /**
   * Get a capability definition by name.
   */
  get(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  /**
   * Get a capability handler by name.
   */
  getHandler(name: string): CapabilityHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Check if a capability is registered.
   */
  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  /**
   * Query capabilities by filter criteria.
   */
  query(filter: CapabilityFilter): readonly CapabilityDefinition[] {
    let results = [...this.capabilities.values()];

    if (filter.domain !== undefined) {
      const d = filter.domain;
      results = results.filter((c) => c.domain === d);
    }

    if (filter.riskLevel !== undefined) {
      const r = filter.riskLevel;
      results = results.filter((c) => c.riskLevel === r);
    }

    if (filter.scope !== undefined) {
      const s = filter.scope;
      results = results.filter((c) => c.scope === s);
    }

    if (filter.surface !== undefined) {
      const surf = filter.surface;
      results = results.filter((c) => c.surface.includes(surf));
    }

    if (filter.tags !== undefined && filter.tags.length > 0) {
      const filterTags = filter.tags;
      results = results.filter(
        (c) => c.tags !== undefined && filterTags.some((t) => c.tags!.includes(t)),
      );
    }

    return results;
  }

  /**
   * Convert capabilities to ToolDefinition[] for LLM consumption.
   * Bridges the new declarative system with the existing tool format.
   */
  toToolDefinitions(filter?: CapabilityFilter): readonly ToolDefinition[] {
    const caps = filter ? this.query(filter) : [...this.capabilities.values()];

    return caps.map((cap) => ({
      name: cap.name,
      domain: cap.domain as ToolDefinition['domain'],
      description: cap.description,
      inputSchema: {
        type: 'object',
        properties: cap.parameters.properties,
        ...(cap.parameters.required ? { required: cap.parameters.required } : {}),
      },
      riskLevel: RISK_TO_TOOL_RISK[cap.riskLevel] ?? 'R0-read',
      approvalPolicy: SCOPE_TO_APPROVAL[cap.scope] ?? 'A0-auto',
      executionMode: 'sync' as const,
      scopeLimit: 'current-object' as const,
      dataBoundary: 'local-only' as const,
    }));
  }

  /**
   * Execute a capability with input validation.
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<CapabilityResult> {
    const definition = this.capabilities.get(name);
    if (!definition) {
      return {
        success: false,
        output: `Capability "${name}" not found`,
      };
    }

    const handler = this.handlers.get(name);
    if (!handler) {
      return {
        success: false,
        output: `Handler for capability "${name}" not found`,
      };
    }

    // Validate arguments
    const validation = validateArgs(args, definition.parameters);
    if (!validation.valid) {
      return {
        success: false,
        output: `Validation failed: ${validation.errors.join('; ')}`,
      };
    }

    const start = Date.now();
    try {
      const result = await handler(args, context);
      return {
        ...result,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Execution error: ${message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * List all registered capability definitions.
   */
  list(): readonly CapabilityDefinition[] {
    return [...this.capabilities.values()];
  }

  /**
   * Get number of registered capabilities.
   */
  get size(): number {
    return this.capabilities.size;
  }
}
