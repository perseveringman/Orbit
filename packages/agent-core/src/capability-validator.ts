// ---------------------------------------------------------------------------
// @orbit/agent-core – Capability Validator (M2)
// ---------------------------------------------------------------------------

import type { ParameterSchema, CapabilityDefinition } from './capability-registry.js';
import { AGENT_DOMAINS, RISK_LEVELS } from './types.js';

// ---- Public types ----

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

// ---- Argument validation ----

export function validateArgs(
  args: Record<string, unknown>,
  schema: ParameterSchema,
): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in args) || args[field] === undefined) {
        errors.push(`Missing required field: "${field}"`);
      }
    }
  }

  // Check types of provided fields
  for (const [key, value] of Object.entries(args)) {
    const propSchema = schema.properties[key];
    if (!propSchema) {
      continue; // allow extra fields
    }

    if (value === null || value === undefined) {
      continue; // null/undefined handled by required check
    }

    const actualType = getBasicType(value);
    if (propSchema.type !== actualType) {
      errors.push(
        `Field "${key}" expected type "${propSchema.type}" but got "${actualType}"`,
      );
    }

    // Enum validation
    if (propSchema.enum && !propSchema.enum.includes(value as string)) {
      errors.push(
        `Field "${key}" must be one of: ${propSchema.enum.join(', ')}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---- Capability definition validation ----

const VALID_SCOPES = ['read', 'write', 'execute', 'admin'] as const;

export function validateCapabilityDefinition(
  def: CapabilityDefinition,
): ValidationResult {
  const errors: string[] = [];

  if (!def.name || def.name.trim().length === 0) {
    errors.push('Capability name must not be empty');
  }

  if (!def.description || def.description.trim().length === 0) {
    errors.push('Capability description must not be empty');
  }

  if (!AGENT_DOMAINS.includes(def.domain as (typeof AGENT_DOMAINS)[number])) {
    errors.push(
      `Invalid domain "${def.domain}". Must be one of: ${AGENT_DOMAINS.join(', ')}`,
    );
  }

  const riskLevels = ['r0', 'r1', 'r2', 'r3'];
  if (!riskLevels.includes(def.riskLevel)) {
    errors.push(
      `Invalid riskLevel "${def.riskLevel}". Must be one of: ${riskLevels.join(', ')}`,
    );
  }

  if (!VALID_SCOPES.includes(def.scope as (typeof VALID_SCOPES)[number])) {
    errors.push(
      `Invalid scope "${def.scope}". Must be one of: ${VALID_SCOPES.join(', ')}`,
    );
  }

  if (!Array.isArray(def.surface) || def.surface.length === 0) {
    errors.push('Capability must declare at least one surface');
  }

  if (!def.parameters || def.parameters.type !== 'object') {
    errors.push('Parameters schema must have type "object"');
  }

  if (!def.returns || !def.returns.type) {
    errors.push('Return schema must have a type');
  }

  if (def.timeout !== undefined && (typeof def.timeout !== 'number' || def.timeout <= 0)) {
    errors.push('Timeout must be a positive number');
  }

  return { valid: errors.length === 0, errors };
}

// ---- Helpers ----

function getBasicType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value; // 'string' | 'number' | 'boolean' | 'object' | ...
}
