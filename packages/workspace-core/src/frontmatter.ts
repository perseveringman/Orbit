// ---------------------------------------------------------------------------
// frontmatter.ts — Frontmatter contract for all file-backed objects
// Source: doc 13 §3.4.1, §3.7C
// ---------------------------------------------------------------------------

// Local type aliases to avoid circular dependency on @orbit/domain
type ObjectId = string;
type IsoDateTimeString = string;

// ---------------------------------------------------------------------------
// Core frontmatter interface (sources/ + wiki/)
// ---------------------------------------------------------------------------

export interface OrbitFrontmatter {
  readonly orbit_id: ObjectId;
  readonly orbit_type: string;
  readonly title?: string;
  readonly tags?: readonly string[];
  readonly created_at?: IsoDateTimeString;
  readonly updated_at?: IsoDateTimeString;
  /** Arbitrary extra fields that should be preserved during round-tripping. */
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Wiki compile frontmatter extension (doc 13 §3.7C)
// ---------------------------------------------------------------------------

export type CompileKind =
  | 'entity'
  | 'concept'
  | 'dossier'
  | 'summary'
  | 'comparison'
  | 'brief'
  | 'report';

export interface WikiCompileFrontmatter extends OrbitFrontmatter {
  readonly compiled_from: readonly ObjectId[];
  readonly source_revisions: readonly string[];
  readonly compiler: string;
  readonly generated_at: IsoDateTimeString;
  readonly compile_kind: CompileKind;
  readonly confidence?: number;
}

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

export interface FrontmatterParseResult {
  readonly frontmatter: OrbitFrontmatter | null;
  readonly body: string;
  /** Raw YAML text between the --- delimiters, if present. */
  readonly rawYaml: string | null;
}

// ---------------------------------------------------------------------------
// Frontmatter delimiter
// ---------------------------------------------------------------------------

const FM_OPEN = '---';
const FM_CLOSE_RE = /^---\s*$/m;

// ---------------------------------------------------------------------------
// parseFrontmatter — extract YAML frontmatter from markdown content
// ---------------------------------------------------------------------------

/**
 * Parse YAML-style frontmatter from a markdown string.
 *
 * This is a lightweight parser that does NOT depend on a YAML library.
 * It handles the common subset used by Orbit frontmatter (flat scalars,
 * simple arrays via `[...]` or `- item` syntax).
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith(FM_OPEN)) {
    return { frontmatter: null, body: content, rawYaml: null };
  }

  // Find closing ---
  const afterOpen = trimmed.indexOf('\n');
  if (afterOpen === -1) {
    return { frontmatter: null, body: content, rawYaml: null };
  }

  const rest = trimmed.slice(afterOpen + 1);
  const closeMatch = FM_CLOSE_RE.exec(rest);
  if (!closeMatch) {
    return { frontmatter: null, body: content, rawYaml: null };
  }

  const rawYaml = rest.slice(0, closeMatch.index);
  const body = rest.slice(closeMatch.index + closeMatch[0].length).replace(/^\n/, '');

  const fm = parseYamlLite(rawYaml);
  return {
    frontmatter: fm as OrbitFrontmatter,
    body,
    rawYaml,
  };
}

// ---------------------------------------------------------------------------
// serializeFrontmatter — generate YAML frontmatter block
// ---------------------------------------------------------------------------

export function serializeFrontmatter(fm: OrbitFrontmatter): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    lines.push(serializeYamlValue(key, value));
  }
  lines.push('---');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// updateFrontmatter — non-destructive merge of updates into existing content
// ---------------------------------------------------------------------------

export function updateFrontmatter(
  content: string,
  updates: Partial<OrbitFrontmatter>,
): string {
  const parsed = parseFrontmatter(content);
  const merged: Record<string, unknown> = {
    ...(parsed.frontmatter ?? {}),
    ...updates,
  };
  const newFm = serializeFrontmatter(merged as OrbitFrontmatter);
  return `${newFm}\n${parsed.body}`;
}

// ---------------------------------------------------------------------------
// Lightweight YAML helpers (no external deps)
// ---------------------------------------------------------------------------

function parseYamlLite(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let listValues: string[] | null = null;

  for (const line of lines) {
    const trimLine = line.trim();
    if (trimLine === '' || trimLine.startsWith('#')) continue;

    // Check for list continuation (- item)
    if (trimLine.startsWith('- ') && currentKey && listValues) {
      listValues.push(trimLine.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Flush any pending list
    if (currentKey && listValues) {
      result[currentKey] = listValues;
      currentKey = null;
      listValues = null;
    }

    const colonIdx = trimLine.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimLine.slice(0, colonIdx).trim();
    const rawValue = trimLine.slice(colonIdx + 1).trim();

    if (rawValue === '' || rawValue === '|' || rawValue === '>') {
      // Might be start of a list on subsequent lines
      currentKey = key;
      listValues = [];
      continue;
    }

    // Inline array: [a, b, c]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1);
      result[key] = inner
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter((s) => s.length > 0);
      continue;
    }

    result[key] = parseScalar(rawValue);
  }

  // Flush trailing list
  if (currentKey && listValues) {
    result[currentKey] = listValues;
  }

  return result;
}

function parseScalar(value: string): unknown {
  // Strip surrounding quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  // Number
  const num = Number(value);
  if (!Number.isNaN(num) && value !== '') return num;
  return value;
}

function serializeYamlValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map((v) => JSON.stringify(String(v)));
    return `${key}: [${items.join(', ')}]`;
  }
  if (typeof value === 'string') {
    // Quote if it contains special YAML chars
    if (/[:#\[\]{}&*!|>'"`,]/.test(value) || value.includes('\n')) {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    return `${key}: ${value}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${value}`;
  }
  return `${key}: ${JSON.stringify(value)}`;
}
