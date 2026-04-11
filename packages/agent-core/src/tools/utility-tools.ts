// ---------------------------------------------------------------------------
// @orbit/agent-core – Utility Tools (M8)
// ---------------------------------------------------------------------------

import type { BuiltinTool, ToolOutput } from './types.js';

// ---- datetime ----

export const datetimeTool: BuiltinTool = {
  name: 'datetime',
  description: 'Get the current date and time in ISO 8601 format.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      timezone: { type: 'string', description: 'IANA timezone (default: UTC)' },
    },
    required: [],
  },

  async execute(args): Promise<ToolOutput> {
    const now = new Date();
    const tz = typeof args.timezone === 'string' && args.timezone.trim() !== '' ? args.timezone : 'UTC';

    try {
      const formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
      return {
        success: true,
        output: now.toISOString(),
        metadata: { iso: now.toISOString(), formatted, timezone: tz },
      };
    } catch {
      // Fallback for invalid timezone
      return {
        success: true,
        output: now.toISOString(),
        metadata: { iso: now.toISOString(), timezone: 'UTC' },
      };
    }
  },
};

// ---- json_parse ----

export const jsonParseTool: BuiltinTool = {
  name: 'json_parse',
  description: 'Parse and validate a JSON string. Returns the pretty-printed result or an error.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The JSON string to parse' },
    },
    required: ['input'],
  },

  async execute(args): Promise<ToolOutput> {
    const input = args.input;
    if (typeof input !== 'string') {
      return { success: false, output: 'Error: "input" argument must be a string.' };
    }

    try {
      const parsed = JSON.parse(input) as unknown;
      const pretty = JSON.stringify(parsed, null, 2);
      return {
        success: true,
        output: pretty,
        metadata: { valid: true, type: Array.isArray(parsed) ? 'array' : typeof parsed },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Invalid JSON: ${message}`,
        metadata: { valid: false },
      };
    }
  },
};

// ---- text_transform ----

export const textTransformTool: BuiltinTool = {
  name: 'text_transform',
  description: 'Transform text: count words, count characters, convert case, or reverse.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The text to transform' },
      operation: {
        type: 'string',
        description: 'Operation: "word_count", "char_count", "uppercase", "lowercase", "reverse", "trim"',
      },
    },
    required: ['input', 'operation'],
  },

  async execute(args): Promise<ToolOutput> {
    const input = args.input;
    if (typeof input !== 'string') {
      return { success: false, output: 'Error: "input" argument must be a string.' };
    }

    const operation = typeof args.operation === 'string' ? args.operation : '';

    switch (operation) {
      case 'word_count': {
        const words = input.trim().split(/\s+/).filter(Boolean);
        return { success: true, output: String(words.length), metadata: { wordCount: words.length } };
      }
      case 'char_count':
        return { success: true, output: String(input.length), metadata: { charCount: input.length } };
      case 'uppercase':
        return { success: true, output: input.toUpperCase() };
      case 'lowercase':
        return { success: true, output: input.toLowerCase() };
      case 'reverse':
        return { success: true, output: [...input].reverse().join('') };
      case 'trim':
        return { success: true, output: input.trim() };
      default:
        return {
          success: false,
          output: `Error: Unknown operation "${operation}". Supported: word_count, char_count, uppercase, lowercase, reverse, trim.`,
        };
    }
  },
};

// ---- calculate ----

/**
 * Safely evaluate a mathematical expression using the Function constructor
 * with a restricted scope. Only allows numbers, arithmetic operators,
 * parentheses, and Math functions.
 */
function safeEvaluate(expression: string): number {
  // Whitelist: digits, decimal points, operators, parens, whitespace, Math references
  const sanitized = expression.trim();
  if (!/^[\d\s+\-*/().,%^a-zA-Z_]+$/.test(sanitized)) {
    throw new Error('Expression contains disallowed characters.');
  }

  // Block dangerous patterns
  const blocked = /\b(eval|Function|import|require|process|global|window|this|constructor|prototype|__proto__)\b/i;
  if (blocked.test(sanitized)) {
    throw new Error('Expression contains blocked keywords.');
  }

  // Provide only Math as the accessible scope
  const fn = new Function('Math', `"use strict"; return (${sanitized});`) as (m: typeof Math) => unknown;
  const result = fn(Math);

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number.');
  }
  return result;
}

export const calculateTool: BuiltinTool = {
  name: 'calculate',
  description: 'Evaluate a mathematical expression. Supports +, -, *, /, %, parentheses, and Math functions.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'The math expression to evaluate (e.g., "2 + 3 * 4")' },
    },
    required: ['expression'],
  },

  async execute(args): Promise<ToolOutput> {
    const expression = args.expression;
    if (typeof expression !== 'string' || expression.trim() === '') {
      return { success: false, output: 'Error: "expression" argument is required and must be a non-empty string.' };
    }

    try {
      const result = safeEvaluate(expression);
      return {
        success: true,
        output: String(result),
        metadata: { expression, result },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error evaluating expression: ${message}` };
    }
  },
};
