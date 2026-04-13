// ---------------------------------------------------------------------------
// @orbit/agent-core – Skill Resolver (M12)
//
// Resolves skill definitions from remote URLs, optionally using an LLM to
// intelligently extract structured skill metadata from page content.
// ---------------------------------------------------------------------------

import type { LLMAdapter } from '../llm-adapter.js';
import type { SkillInstallInput, SkillResolveResult } from './types.js';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGE_LENGTH = 50_000;

// ---- Skill Resolver ----

export class SkillResolver {
  private readonly llm?: LLMAdapter;

  constructor(llm?: LLMAdapter) {
    this.llm = llm;
  }

  /** Resolve a skill definition from the given URL. Never throws. */
  async resolve(url: string): Promise<SkillResolveResult> {
    try {
      const pageContent = await this.fetchPage(url);
      const skill = this.llm
        ? await this.extractWithLLM(pageContent, url)
        : this.extractWithHeuristics(pageContent);

      if (!skill) {
        return { success: false, error: 'Could not extract skill definition from page content.', sourceUrl: url };
      }

      return { success: true, skill, sourceUrl: url };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, sourceUrl: url };
    }
  }

  /** Fetch the textual content of a URL with timeout and size limits. */
  async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OrbitSkillResolver/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const raw = await response.text();
    return raw.length > MAX_PAGE_LENGTH ? raw.slice(0, MAX_PAGE_LENGTH) : raw;
  }

  // ---- LLM-based extraction ----

  /** Use the LLM to extract structured skill metadata from page content. */
  private async extractWithLLM(pageContent: string, sourceUrl: string): Promise<SkillInstallInput | null> {
    const prompt = [
      'Extract a skill definition from the following page content.',
      'Return a JSON object with these fields:',
      '  name (string, required)',
      '  description (string, required)',
      '  version (string, optional)',
      '  instructions (string, required — the full system prompt for the skill)',
      '  tools (string[], optional — tool names the skill needs)',
      '  tags (string[], optional)',
      '',
      'If the content does not describe a usable skill, return exactly: null',
      '',
      `Source URL: ${sourceUrl}`,
      '',
      '--- PAGE CONTENT ---',
      pageContent.slice(0, 20_000),
    ].join('\n');

    try {
      const response = await this.llm!.chatCompletion({
        model: 'default',
        messages: [
          { id: 'sys', role: 'system', content: 'You extract structured data from web pages. Respond with valid JSON only.', timestamp: new Date().toISOString() },
          { id: 'usr', role: 'user', content: prompt, timestamp: new Date().toISOString() },
        ],
        temperature: 0,
        maxTokens: 2000,
      });

      const text = response.choices[0]?.message.content?.trim();
      if (!text || text === 'null') return null;

      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.name !== 'string' || typeof parsed.instructions !== 'string') {
        return null;
      }

      return {
        name: parsed.name as string,
        description: (parsed.description as string) ?? '',
        version: parsed.version as string | undefined,
        instructions: parsed.instructions as string,
        tools: Array.isArray(parsed.tools) ? (parsed.tools as string[]) : undefined,
        tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]) : undefined,
      };
    } catch {
      // Fall back to heuristics if LLM fails
      return this.extractWithHeuristics(pageContent);
    }
  }

  // ---- Heuristic extraction ----

  /** Basic regex-based extraction when no LLM is available. */
  private extractWithHeuristics(content: string): SkillInstallInput | null {
    const name = this.extractField(content, /^#\s+(.+)$/m)
      ?? this.extractField(content, /name:\s*(.+)/i);

    const description = this.extractField(content, /description:\s*(.+)/i)
      ?? this.extractField(content, /^##\s+(.+)$/m);

    if (!name) return null;

    const instructions = this.extractField(content, /instructions:\s*(.+)/i)
      ?? this.extractField(content, /prompt:\s*(.+)/i)
      ?? `Use the ${name} skill as described in its documentation.`;

    const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/i);
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean)
      : undefined;

    const toolsMatch = content.match(/tools:\s*\[([^\]]+)\]/i);
    const tools = toolsMatch
      ? toolsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean)
      : undefined;

    return {
      name,
      description: description ?? '',
      instructions,
      tools,
      tags,
    };
  }

  /** Extract the first capture group of a regex from content. */
  private extractField(content: string, pattern: RegExp): string | null {
    const match = content.match(pattern);
    return match?.[1]?.trim() ?? null;
  }
}

// ---- Factory ----

/** Create a SkillResolver, optionally backed by an LLM for intelligent parsing. */
export function createSkillResolver(llm?: LLMAdapter): SkillResolver {
  return new SkillResolver(llm);
}
