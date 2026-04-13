// ---------------------------------------------------------------------------
// Main process — Tool execution bridge
//
// Initializes agent-core's ToolsetRegistry and executes tools in the main
// process (where Node.js APIs like fs, child_process are available).
// ---------------------------------------------------------------------------

import { ipcMain } from 'electron';
import {
  ToolsetRegistry,
  CORE_TOOLSETS,
  APP_TOOLSETS,
  DOMAIN_TOOLSETS,
} from '@orbit/agent-core';
import type { ToolExecuteRequest, ToolExecuteResponse, ToolListItem } from '../shared/contracts';

let registry: ToolsetRegistry | null = null;

function getRegistry(): ToolsetRegistry {
  if (!registry) {
    registry = new ToolsetRegistry();
    for (const ts of CORE_TOOLSETS) registry.register(ts);
    for (const ts of APP_TOOLSETS) registry.register(ts);
    for (const ts of DOMAIN_TOOLSETS) registry.register(ts);
    console.log(`[ToolBridge] Registered ${registry.getAllTools().length} tools`);
  }
  return registry;
}

export function registerToolBridgeHandlers(): void {
  // Execute a tool
  ipcMain.handle('tool:execute', async (_event, request: ToolExecuteRequest): Promise<ToolExecuteResponse> => {
    const reg = getRegistry();
    const tool = reg.getTool(request.toolName);

    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool "${request.toolName}" not found`,
        durationMs: 0,
      };
    }

    const start = Date.now();
    try {
      const result = await tool.execute(request.args);
      return {
        success: result.success,
        output: result.output,
        error: result.success ? undefined : result.output,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: '',
        error: `Tool execution error: ${message}`,
        durationMs: Date.now() - start,
      };
    }
  });

  // List all tools
  ipcMain.handle('tool:list', async (): Promise<ToolListItem[]> => {
    const reg = getRegistry();
    return reg.getAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
    }));
  });

  console.log('[ToolBridge] IPC handlers registered');
}
