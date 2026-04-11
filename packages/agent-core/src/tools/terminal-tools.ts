// ---------------------------------------------------------------------------
// @orbit/agent-core – Terminal Tools (M8)
// ---------------------------------------------------------------------------

import { exec } from 'node:child_process';
import type { BuiltinTool, ToolOutput } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Execute a shell command and return its output. */
export const shellExecTool: BuiltinTool = {
  name: 'shell_exec',
  description:
    'Execute a shell command and return output. Use for running CLI tools, scripts, build commands, etc.',
  category: 'terminal',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
      timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' },
    },
    required: ['command'],
  },

  async execute(args: Record<string, unknown>): Promise<ToolOutput> {
    const command = args.command;
    if (typeof command !== 'string' || command.trim() === '') {
      return { success: false, output: 'Error: "command" argument is required and must be a non-empty string.' };
    }

    const cwd = typeof args.cwd === 'string' ? args.cwd : undefined;
    const timeout =
      typeof args.timeout === 'number' && args.timeout > 0
        ? args.timeout
        : DEFAULT_TIMEOUT_MS;

    const start = Date.now();

    try {
      const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
        (resolve, reject) => {
          const child = exec(
            command,
            { cwd, timeout, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
              if (error && (error as unknown as { killed?: boolean }).killed) {
                reject(new Error(`Command timed out after ${timeout}ms`));
                return;
              }
              const exitCode =
                error && typeof (error as { code?: unknown }).code === 'number'
                  ? ((error as { code: number }).code)
                  : error
                    ? 1
                    : 0;
              resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode });
            },
          );

          // Safety: ensure child is cleaned up on timeout
          child.on('error', (err) => reject(err));
        },
      );

      const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
      const durationMs = Date.now() - start;

      return {
        success: result.exitCode === 0,
        output: combined || '(no output)',
        metadata: { exitCode: result.exitCode, durationMs },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Error: ${message}`,
        metadata: { durationMs: Date.now() - start },
      };
    }
  },
};
