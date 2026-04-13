// ---------------------------------------------------------------------------
// @orbit/agent-core – MCP Installer (URL-based)
// ---------------------------------------------------------------------------

import type { LLMAdapter } from '../llm-adapter.js';
import type { McpInstallInput, McpResolveResult, McpTransport } from './types.js';

/** Timeout (ms) for fetching a remote page. */
const FETCH_TIMEOUT_MS = 15_000;

// ---- McpInstaller ----

/**
 * Resolves an MCP server configuration from a URL.
 *
 * Resolution strategy:
 * 1. Fetch the page content at the given URL.
 * 2. If an {@link LLMAdapter} is available, ask the LLM to extract the
 *    server name, description, and transport details.
 * 3. Fall back to heuristic parsing (looks for common patterns such as
 *    `npx`, `uvx`, `docker run`, or SSE/MCP endpoints).
 */
export class McpInstaller {
  constructor(private readonly llm?: LLMAdapter) {}

  /** Resolve an MCP server configuration from a URL. Never throws. */
  async resolve(url: string): Promise<McpResolveResult> {
    try {
      const pageContent = await this.fetchPage(url);

      // Try LLM-based extraction first
      if (this.llm) {
        const llmResult = await this.extractWithLlm(pageContent, url);
        if (llmResult.success) {
          return llmResult;
        }
      }

      // Fall back to heuristic parsing
      return this.extractWithHeuristics(pageContent, url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, sourceUrl: url };
    }
  }

  // -- Page fetching --

  /** Fetch page content with a timeout. */
  async fetchPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'text/html, application/json, text/plain' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  // -- LLM-based extraction --

  /** Use the LLM to parse page content into an MCP config. */
  private async extractWithLlm(
    pageContent: string,
    sourceUrl: string,
  ): Promise<McpResolveResult> {
    try {
      // Truncate very large pages to stay within context limits
      const truncated = pageContent.slice(0, 12_000);

      const response = await this.llm!.chatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          {
            id: 'sys',
            role: 'system',
            content: LLM_EXTRACTION_PROMPT,
            timestamp: new Date().toISOString(),
          },
          {
            id: 'user',
            role: 'user',
            content: `URL: ${sourceUrl}\n\nPage content:\n${truncated}`,
            timestamp: new Date().toISOString(),
          },
        ],
        temperature: 0,
        maxTokens: 1024,
      });

      const raw = response.choices[0]?.message.content ?? '';
      const config = this.parseLlmResponse(raw, sourceUrl);
      if (config) {
        return { success: true, config, sourceUrl };
      }

      return { success: false, error: 'LLM could not extract config', sourceUrl };
    } catch {
      // LLM extraction failed — fall through to heuristics
      return { success: false, error: 'LLM extraction failed', sourceUrl };
    }
  }

  /** Parse the structured JSON the LLM returns. */
  private parseLlmResponse(raw: string, _sourceUrl: string): McpInstallInput | undefined {
    try {
      // The LLM may wrap its answer in a code fence
      const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      const name = parsed['name'] as string | undefined;
      const description = parsed['description'] as string | undefined;
      const transportType = parsed['transportType'] as string | undefined;

      if (!name || !transportType) {
        return undefined;
      }

      const transport = this.buildTransport(parsed, transportType);
      if (!transport) {
        return undefined;
      }

      return {
        name,
        description: description ?? `MCP server: ${name}`,
        transport,
      };
    } catch {
      return undefined;
    }
  }

  // -- Heuristic extraction --

  /** Extract MCP config from page content using regex heuristics. */
  private extractWithHeuristics(
    pageContent: string,
    sourceUrl: string,
  ): McpResolveResult {
    // Look for stdio commands: npx, uvx, docker run, node, python
    const stdioMatch = pageContent.match(
      /(?:npx|uvx|docker\s+run|node|python3?)\s+[\w@/.:-]+(?:\s+[^\n<"]{0,200})?/,
    );

    if (stdioMatch) {
      const fullCommand = stdioMatch[0].trim();
      const parts = fullCommand.split(/\s+/);
      const command = parts[0];
      const args = parts.slice(1);

      // Derive a name from the first non-flag argument or the command itself
      const nameCandidate = args.find((a) => !a.startsWith('-')) ?? command;
      const name = nameCandidate.replace(/^@/, '').replace(/\//g, '-');

      return {
        success: true,
        config: {
          name,
          description: `MCP server installed from ${sourceUrl}`,
          transport: { type: 'stdio', command, args },
        },
        sourceUrl,
      };
    }

    // Look for SSE or streamable-http endpoints
    const sseMatch = pageContent.match(
      /https?:\/\/[^\s"'<>]+\/(?:sse|mcp|v1\/mcp)[^\s"'<>]*/i,
    );

    if (sseMatch) {
      const url = sseMatch[0];
      const isSse = /\/sse/i.test(url);

      // Derive a name from the hostname
      let name: string;
      try {
        name = new URL(url).hostname.replace(/\./g, '-');
      } catch {
        name = 'mcp-server';
      }

      return {
        success: true,
        config: {
          name,
          description: `MCP server installed from ${sourceUrl}`,
          transport: isSse
            ? { type: 'sse', url }
            : { type: 'streamable-http', url },
        },
        sourceUrl,
      };
    }

    return {
      success: false,
      error: 'Could not detect MCP server configuration from page content',
      sourceUrl,
    };
  }

  // -- Shared helpers --

  /** Build a typed transport from parsed config values. */
  private buildTransport(
    parsed: Record<string, unknown>,
    transportType: string,
  ): McpTransport | undefined {
    switch (transportType) {
      case 'stdio': {
        const command = parsed['command'] as string | undefined;
        if (!command) return undefined;
        const args = parsed['args'] as string[] | undefined;
        const env = parsed['env'] as Record<string, string> | undefined;
        return { type: 'stdio', command, args, env };
      }
      case 'sse': {
        const url = parsed['url'] as string | undefined;
        if (!url) return undefined;
        const headers = parsed['headers'] as Record<string, string> | undefined;
        return { type: 'sse', url, headers };
      }
      case 'streamable-http': {
        const url = parsed['url'] as string | undefined;
        if (!url) return undefined;
        const headers = parsed['headers'] as Record<string, string> | undefined;
        return { type: 'streamable-http', url, headers };
      }
      default:
        return undefined;
    }
  }
}

// ---- LLM prompt ----

const LLM_EXTRACTION_PROMPT = `You are an MCP (Model Context Protocol) server configuration extractor.

Given a web page about an MCP server, extract the following information and return it as JSON:

{
  "name": "server-name",
  "description": "Brief description of what this MCP server does",
  "transportType": "stdio" | "sse" | "streamable-http",
  "command": "command to run (for stdio)",
  "args": ["arg1", "arg2"] (for stdio),
  "env": {"KEY": "value"} (for stdio, optional),
  "url": "endpoint URL (for sse/streamable-http)",
  "headers": {"key": "value"} (for sse/streamable-http, optional)
}

Rules:
- For stdio servers look for npx, uvx, docker run, node, or python commands.
- For network servers look for URLs ending in /sse, /mcp, or /v1/mcp.
- Return ONLY the JSON object, no explanation.
- If you cannot determine the configuration, return {"error": "reason"}.`;

// ---- Factory ----

/** Create a new {@link McpInstaller} instance. */
export function createMcpInstaller(llm?: LLMAdapter): McpInstaller {
  return new McpInstaller(llm);
}
