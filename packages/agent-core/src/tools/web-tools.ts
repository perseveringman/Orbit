// ---------------------------------------------------------------------------
// @orbit/agent-core – Web Tools (M8)
// ---------------------------------------------------------------------------

import type { BuiltinTool, ToolOutput } from './types.js';

const DEFAULT_MAX_LENGTH = 5000;

/** Strip HTML tags and collapse whitespace to extract readable text. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- web_fetch ----

export const webFetchTool: BuiltinTool = {
  name: 'web_fetch',
  description:
    'Fetch a URL and return its content. Supports HTML (converted to simplified text), JSON, and plain text.',
  category: 'web',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      maxLength: { type: 'number', description: 'Max content length (default: 5000)' },
    },
    required: ['url'],
  },

  async execute(args): Promise<ToolOutput> {
    const url = args.url;
    if (typeof url !== 'string' || url.trim() === '') {
      return { success: false, output: 'Error: "url" argument is required and must be a non-empty string.' };
    }

    const maxLength =
      typeof args.maxLength === 'number' && args.maxLength > 0
        ? args.maxLength
        : DEFAULT_MAX_LENGTH;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'OrbitAgent/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        return {
          success: false,
          output: `HTTP ${response.status} ${response.statusText}`,
          metadata: { statusCode: response.status },
        };
      }

      const contentType = response.headers.get('content-type') ?? '';
      const raw = await response.text();

      let content: string;
      if (contentType.includes('application/json')) {
        try {
          content = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          content = raw;
        }
      } else if (contentType.includes('text/html')) {
        content = stripHtml(raw);
      } else {
        content = raw;
      }

      const truncated = content.length > maxLength;
      const output = truncated ? content.slice(0, maxLength) + '\n... (truncated)' : content;

      return {
        success: true,
        output,
        metadata: {
          url,
          contentType,
          originalLength: content.length,
          truncated,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error fetching URL: ${message}` };
    }
  },
};

// ---- web_search (placeholder) ----

export const webSearchTool: BuiltinTool = {
  name: 'web_search',
  description:
    'Search the web for information. Requires an API key to be configured. Returns a placeholder response when unconfigured.',
  category: 'web',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Maximum results (default: 5)' },
    },
    required: ['query'],
  },

  async execute(args): Promise<ToolOutput> {
    const query = args.query;
    if (typeof query !== 'string' || query.trim() === '') {
      return { success: false, output: 'Error: "query" argument is required and must be a non-empty string.' };
    }

    // Placeholder – a real implementation would use a search API
    return {
      success: true,
      output: `[web_search] No search provider configured. Query was: "${query}"`,
      metadata: { query, configured: false },
    };
  },
};
