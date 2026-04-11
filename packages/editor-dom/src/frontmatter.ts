export interface OrbitFrontmatter {
  readonly orbit_id?: string;
  readonly orbit_type?: string;
  readonly [key: string]: unknown;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(text: string): { frontmatter: OrbitFrontmatter; body: string } {
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: text };
  }

  const raw = match[1];
  const frontmatter: Record<string, unknown> = {};

  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (value !== '' && !Number.isNaN(Number(value))) value = Number(value);
    if (key) frontmatter[key] = value;
  }

  const body = text.slice(match[0].length);
  return { frontmatter: frontmatter as OrbitFrontmatter, body };
}

export function serializeFrontmatter(frontmatter: OrbitFrontmatter, body: string): string {
  const keys = Object.keys(frontmatter).filter((k) => frontmatter[k] !== undefined);
  if (keys.length === 0) return body;

  const lines = keys.map((k) => `${k}: ${String(frontmatter[k])}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}
