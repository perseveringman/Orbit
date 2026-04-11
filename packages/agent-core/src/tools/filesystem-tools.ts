// ---------------------------------------------------------------------------
// @orbit/agent-core – Filesystem Tools (M8)
// ---------------------------------------------------------------------------

import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import type { BuiltinTool, ToolOutput } from './types.js';

// ---- Helpers ----

function ensureString(val: unknown, name: string): string | ToolOutput {
  if (typeof val !== 'string' || val.trim() === '') {
    return { success: false, output: `Error: "${name}" argument is required and must be a non-empty string.` };
  }
  return val;
}

// ---- file_read ----

export const fileReadTool: BuiltinTool = {
  name: 'file_read',
  description: 'Read the contents of a file.',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
      encoding: { type: 'string', description: 'File encoding (default: utf-8)' },
    },
    required: ['path'],
  },

  async execute(args): Promise<ToolOutput> {
    const pathOrErr = ensureString(args.path, 'path');
    if (typeof pathOrErr !== 'string') return pathOrErr;

    const encoding = (typeof args.encoding === 'string' ? args.encoding : 'utf-8') as BufferEncoding;

    try {
      const content = await readFile(pathOrErr, { encoding });
      return {
        success: true,
        output: content,
        metadata: { path: pathOrErr, length: content.length },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error reading file: ${message}` };
    }
  },
};

// ---- file_write ----

export const fileWriteTool: BuiltinTool = {
  name: 'file_write',
  description: 'Write content to a file. Creates the file if it does not exist.',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'Content to write' },
      createDirs: { type: 'boolean', description: 'Create parent directories if missing (default: false)' },
    },
    required: ['path', 'content'],
  },

  async execute(args): Promise<ToolOutput> {
    const pathOrErr = ensureString(args.path, 'path');
    if (typeof pathOrErr !== 'string') return pathOrErr;

    const content = typeof args.content === 'string' ? args.content : '';
    const createDirs = args.createDirs === true;

    try {
      if (createDirs) {
        const dir = resolve(pathOrErr, '..');
        await mkdir(dir, { recursive: true });
      }
      await writeFile(pathOrErr, content, 'utf-8');
      return {
        success: true,
        output: `File written: ${pathOrErr} (${content.length} bytes)`,
        metadata: { path: pathOrErr, bytesWritten: content.length },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error writing file: ${message}` };
    }
  },
};

// ---- file_list ----

export const fileListTool: BuiltinTool = {
  name: 'file_list',
  description: 'List files and directories in a given directory.',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list (default: ".")' },
      recursive: { type: 'boolean', description: 'List recursively (default: false)' },
    },
    required: [],
  },

  async execute(args): Promise<ToolOutput> {
    const dirPath = typeof args.path === 'string' && args.path.trim() !== '' ? args.path : '.';
    const recursive = args.recursive === true;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const results: string[] = [];

      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);
        const suffix = entry.isDirectory() ? '/' : '';
        results.push(`${entry.name}${suffix}`);

        if (recursive && entry.isDirectory()) {
          try {
            const subEntries = await readdir(entryPath, { withFileTypes: true });
            for (const sub of subEntries) {
              const subSuffix = sub.isDirectory() ? '/' : '';
              results.push(`  ${entry.name}/${sub.name}${subSuffix}`);
            }
          } catch {
            // skip unreadable sub-directories
          }
        }
      }

      return {
        success: true,
        output: results.join('\n'),
        metadata: { path: dirPath, count: results.length },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error listing directory: ${message}` };
    }
  },
};

// ---- file_search ----

export const fileSearchTool: BuiltinTool = {
  name: 'file_search',
  description: 'Search for files matching a name pattern in a directory tree.',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'File name pattern (supports * and ? wildcards)' },
      path: { type: 'string', description: 'Root directory to search (default: ".")' },
      maxResults: { type: 'number', description: 'Maximum results to return (default: 50)' },
    },
    required: ['pattern'],
  },

  async execute(args): Promise<ToolOutput> {
    const patternOrErr = ensureString(args.pattern, 'pattern');
    if (typeof patternOrErr !== 'string') return patternOrErr;

    const rootDir = typeof args.path === 'string' && args.path.trim() !== '' ? args.path : '.';
    const maxResults = typeof args.maxResults === 'number' && args.maxResults > 0 ? args.maxResults : 50;

    const regex = new RegExp(
      '^' +
        patternOrErr
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') +
        '$',
    );

    const matches: string[] = [];

    async function walk(dir: string): Promise<void> {
      if (matches.length >= maxResults) return;
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (matches.length >= maxResults) return;
          const fullPath = join(dir, entry.name);
          if (regex.test(entry.name)) {
            matches.push(relative(rootDir, fullPath));
          }
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath);
          }
        }
      } catch {
        // skip unreadable directories
      }
    }

    try {
      await walk(rootDir);
      return {
        success: true,
        output: matches.length > 0 ? matches.join('\n') : 'No files found.',
        metadata: { pattern: patternOrErr, count: matches.length },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error searching files: ${message}` };
    }
  },
};

// ---- grep ----

export const grepTool: BuiltinTool = {
  name: 'grep',
  description: 'Search file contents for lines matching a regular expression pattern.',
  category: 'filesystem',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression pattern to search for' },
      path: { type: 'string', description: 'File or directory to search in (default: ".")' },
      ignoreCase: { type: 'boolean', description: 'Case insensitive search (default: false)' },
      maxResults: { type: 'number', description: 'Maximum matching lines to return (default: 100)' },
    },
    required: ['pattern'],
  },

  async execute(args): Promise<ToolOutput> {
    const patternOrErr = ensureString(args.pattern, 'pattern');
    if (typeof patternOrErr !== 'string') return patternOrErr;

    const searchPath = typeof args.path === 'string' && args.path.trim() !== '' ? args.path : '.';
    const ignoreCase = args.ignoreCase === true;
    const maxResults = typeof args.maxResults === 'number' && args.maxResults > 0 ? args.maxResults : 100;

    let regex: RegExp;
    try {
      regex = new RegExp(patternOrErr, ignoreCase ? 'i' : '');
    } catch {
      return { success: false, output: `Error: Invalid regular expression: "${patternOrErr}"` };
    }

    const matches: string[] = [];

    async function searchFile(filePath: string): Promise<void> {
      if (matches.length >= maxResults) return;
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) return;
          if (regex.test(lines[i])) {
            matches.push(`${relative('.', filePath)}:${i + 1}: ${lines[i]}`);
          }
        }
      } catch {
        // skip binary / unreadable files
      }
    }

    async function walk(dir: string): Promise<void> {
      if (matches.length >= maxResults) return;
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (matches.length >= maxResults) return;
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await walk(fullPath);
            }
          } else {
            await searchFile(fullPath);
          }
        }
      } catch {
        // skip unreadable directories
      }
    }

    try {
      const info = await stat(searchPath);
      if (info.isDirectory()) {
        await walk(searchPath);
      } else {
        await searchFile(searchPath);
      }

      return {
        success: true,
        output: matches.length > 0 ? matches.join('\n') : 'No matches found.',
        metadata: { pattern: patternOrErr, matchCount: matches.length },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error: ${message}` };
    }
  },
};
