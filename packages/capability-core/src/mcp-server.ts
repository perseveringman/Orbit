// ---------------------------------------------------------------------------
// @orbit/capability-core – Local MCP Server Types (Wave 2-C)
// ---------------------------------------------------------------------------

export type McpResourceType = 'object' | 'document' | 'blob' | 'graph_node' | 'search_result';

export interface McpResource {
  readonly uri: string;
  readonly name: string;
  readonly type: McpResourceType;
  readonly mimeType?: string;
  readonly description?: string;
}

export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly capabilityId: string;
}

export interface McpPrompt {
  readonly name: string;
  readonly description: string;
  readonly arguments: readonly McpPromptArgument[];
  readonly template: string;
}

export interface McpPromptArgument {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface McpResourceContent {
  readonly uri: string;
  readonly mimeType: string;
  readonly text?: string;
  readonly blob?: string;
}

export interface McpToolResult {
  readonly success: boolean;
  readonly content: string;
  readonly isError?: boolean;
}

export type ResourceReader = (uri: string) => McpResourceContent | null;
export type ToolHandler = (args: Record<string, unknown>) => Promise<McpToolResult>;

export interface McpServer {
  listResources(): readonly McpResource[];
  readResource(uri: string): McpResourceContent | null;
  listTools(): readonly McpTool[];
  executeTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  listPrompts(): readonly McpPrompt[];
  getPrompt(name: string, args: Record<string, string>): string | null;
  registerResource(resource: McpResource, reader: ResourceReader): void;
  registerTool(tool: McpTool, handler: ToolHandler): void;
  registerPrompt(prompt: McpPrompt): void;
}

export function createMcpServer(): McpServer {
  const resources = new Map<string, { resource: McpResource; reader: ResourceReader }>();
  const tools = new Map<string, { tool: McpTool; handler: ToolHandler }>();
  const prompts = new Map<string, McpPrompt>();

  return {
    listResources(): readonly McpResource[] {
      return [...resources.values()].map((r) => r.resource);
    },

    readResource(uri: string): McpResourceContent | null {
      const entry = resources.get(uri);
      if (!entry) return null;
      return entry.reader(uri);
    },

    listTools(): readonly McpTool[] {
      return [...tools.values()].map((t) => t.tool);
    },

    async executeTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
      const entry = tools.get(name);
      if (!entry) {
        return { success: false, content: `Tool "${name}" not found`, isError: true };
      }
      try {
        return await entry.handler(args);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, content: `Tool execution error: ${message}`, isError: true };
      }
    },

    listPrompts(): readonly McpPrompt[] {
      return [...prompts.values()];
    },

    getPrompt(name: string, args: Record<string, string>): string | null {
      const prompt = prompts.get(name);
      if (!prompt) return null;
      let result = prompt.template;
      for (const [key, value] of Object.entries(args)) {
        result = result.replaceAll(`{{${key}}}`, value);
      }
      return result;
    },

    registerResource(resource: McpResource, reader: ResourceReader): void {
      resources.set(resource.uri, { resource, reader });
    },

    registerTool(tool: McpTool, handler: ToolHandler): void {
      tools.set(tool.name, { tool, handler });
    },

    registerPrompt(prompt: McpPrompt): void {
      prompts.set(prompt.name, prompt);
    },
  };
}
