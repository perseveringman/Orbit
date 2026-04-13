// ---------------------------------------------------------------------------
// @orbit/agent-core – Built-in Agent Roles
// ---------------------------------------------------------------------------

import type { AgentRoleDefinition, RoleRegistry } from './types.js';

const NOW = new Date().toISOString();

/** All built-in role definitions. */
export const BUILTIN_ROLES: readonly AgentRoleDefinition[] = [
  // 1 — Planner
  {
    id: 'builtin:planner',
    name: 'planner',
    displayName: '规划助手',
    description: '分解复杂任务，制定执行计划',
    icon: '📋',
    systemPrompt:
      'You are a planning agent. Your job is to break down complex tasks into clear, ' +
      'actionable steps. Always provide structured plans with priorities and dependencies. ' +
      'Use the available planning and task tools to persist plans in the workspace. ' +
      'When skills are available, leverage them for domain-specific planning workflows.',
    model: 'gpt-4o',
    temperature: 0.3,
    maxIterations: 10,
    tools: {
      allowed: [
        'project.create',
        'project.list',
        'project.update',
        'task.create',
        'task.list',
        'task.update',
        'task.complete',
        'milestone.create',
        'milestone.list',
      ],
      blocked: [],
    },
    mcpServers: [],
    skills: ['orbit:planning'],
    specializations: ['plan', 'organize', 'decompose', 'strategy', 'roadmap', 'task'],
    outputFormat: 'markdown',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 2 — Researcher
  {
    id: 'builtin:researcher',
    name: 'researcher',
    displayName: '研究助手',
    description: '搜索、分析和综合信息',
    icon: '🔍',
    systemPrompt:
      'You are a research agent. Search for information, analyze findings, ' +
      'and provide comprehensive summaries with citations. ' +
      'You have access to web and workspace search tools. ' +
      'File writing and shell execution are blocked for safety.',
    model: 'gpt-4o',
    temperature: 0.5,
    maxIterations: 15,
    tools: {
      allowed: ['web_fetch', 'web_search', 'workspace.search', 'grep'],
      blocked: ['file_write', 'shell_exec'],
    },
    mcpServers: [],
    skills: ['orbit:research'],
    specializations: ['search', 'research', 'find', 'analyze', 'investigate', 'look up'],
    outputFormat: 'markdown',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 3 — Reader
  {
    id: 'builtin:reader',
    name: 'reader',
    displayName: '阅读助手',
    description: '阅读和理解长文本、文档，管理订阅源和多媒体内容',
    icon: '📖',
    systemPrompt:
      'You are a reading agent. Help users understand long documents, extract key ' +
      'information, provide summaries, manage RSS/podcast subscriptions, resolve URLs, ' +
      'and render video and podcast content. ' +
      'You may only read files and fetch web content — writing and execution are blocked.',
    model: 'gpt-4o',
    temperature: 0.3,
    maxIterations: 10,
    tools: {
      allowed: ['web_fetch', 'file_read', 'workspace.search'],
      blocked: ['file_write', 'shell_exec'],
    },
    mcpServers: [],
    skills: ['orbit:reading'],
    specializations: [
      'read', 'summarize', 'understand', 'extract', 'comprehend',
      'rss', 'feed', 'podcast', 'video', 'subscribe', 'opml', 'youtube',
    ],
    outputFormat: 'markdown',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 4 — Writer
  {
    id: 'builtin:writer',
    name: 'writer',
    displayName: '写作助手',
    description: '创作、编辑和改进文本内容',
    icon: '✍️',
    systemPrompt:
      'You are a writing agent. Help users create, edit, and improve text content. ' +
      'Maintain consistent tone and style. ' +
      'You can read files for context and write files to save drafts. ' +
      'Shell execution is blocked for safety.',
    model: 'gpt-4o',
    temperature: 0.7,
    maxIterations: 10,
    tools: {
      allowed: ['file_read', 'file_write', 'web_fetch'],
      blocked: ['shell_exec'],
    },
    mcpServers: [],
    skills: ['orbit:writing'],
    specializations: ['write', 'draft', 'edit', 'compose', 'article', 'essay', 'blog'],
    outputFormat: 'markdown',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 5 — Coder
  {
    id: 'builtin:coder',
    name: 'coder',
    displayName: '编程助手',
    description: '编写、调试和优化代码',
    icon: '💻',
    systemPrompt:
      'You are a coding agent. Help users write, debug, and optimize code. ' +
      'Follow best practices and write clean, documented code. ' +
      'You have full terminal and filesystem access. ' +
      'Use available MCP tools and skills when they can accelerate your workflow.',
    model: 'gpt-4o',
    temperature: 0.2,
    maxIterations: 15,
    tools: {
      allowed: ['shell_exec', 'file_read', 'file_write', 'file_list', 'grep', 'file_search'],
      blocked: [],
      autoIncludeCategories: ['terminal', 'filesystem'],
    },
    mcpServers: [],
    skills: [],
    specializations: [
      'code', 'program', 'debug', 'fix', 'implement', 'develop', 'build', 'compile', 'test',
    ],
    outputFormat: 'code',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 6 — Reviewer
  {
    id: 'builtin:reviewer',
    name: 'reviewer',
    displayName: '审查助手',
    description: '审查代码、文档和方案',
    icon: '🔎',
    systemPrompt:
      'You are a review agent. Carefully review code, documents, and plans. ' +
      'Identify issues, suggest improvements, and ensure quality. ' +
      'You have read-only access — writing and execution are blocked.',
    model: 'gpt-4o',
    temperature: 0.3,
    maxIterations: 10,
    tools: {
      allowed: ['file_read', 'file_list', 'grep', 'file_search'],
      blocked: ['file_write', 'shell_exec'],
    },
    mcpServers: [],
    skills: [],
    specializations: ['review', 'check', 'audit', 'inspect', 'evaluate', 'assess'],
    outputFormat: 'markdown',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 7 — Task Manager
  {
    id: 'builtin:task-manager',
    name: 'task-manager',
    displayName: '任务管理助手',
    description: '管理项目、任务和里程碑',
    icon: '📊',
    systemPrompt:
      'You are a task management agent. Help users create, track, and manage projects, ' +
      'tasks, and milestones. Keep plans up to date and surface blockers proactively. ' +
      'Use planning tools to persist all changes to the workspace.',
    model: 'gpt-4o',
    temperature: 0.3,
    maxIterations: 10,
    tools: {
      allowed: [
        'project.create',
        'project.list',
        'project.update',
        'task.create',
        'task.list',
        'task.update',
        'task.complete',
        'task.delete',
        'milestone.create',
        'milestone.list',
        'milestone.update',
      ],
      blocked: [],
      autoIncludeCategories: ['planning'],
    },
    mcpServers: [],
    skills: ['orbit:planning'],
    specializations: [
      'task', 'project', 'milestone', 'manage', 'track', 'status', 'progress', 'kanban',
    ],
    outputFormat: 'markdown',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 8 — Assistant (default fallback)
  {
    id: 'builtin:assistant',
    name: 'assistant',
    displayName: '通用助手',
    description: '通用对话和任务处理',
    icon: '🤖',
    systemPrompt:
      'You are a helpful general-purpose assistant. Help users with any task, ' +
      'using available tools when needed. Be clear and concise. ' +
      'You have broad tool access across all categories.',
    model: 'gpt-4o',
    temperature: 0.5,
    maxIterations: 15,
    tools: {
      allowed: [],
      blocked: [],
      autoIncludeCategories: [
        'terminal',
        'filesystem',
        'web',
        'interaction',
        'utility',
        'planning',
        'workspace',
      ],
    },
    mcpServers: [],
    skills: [],
    specializations: ['help', 'assist', 'general', 'chat'],
    outputFormat: 'text',
    isBuiltin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

/**
 * Load all built-in roles into a RoleRegistry.
 * Existing roles with the same ID are silently skipped.
 */
export function loadBuiltinRoles(registry: RoleRegistry): void {
  for (const role of BUILTIN_ROLES) {
    if (!registry.getRole(role.id)) {
      // Use the registry's internal loader — built-in roles bypass createRole
      // because createRole is meant for user-created roles. We cast to access
      // the implementation method directly.
      (registry as unknown as { _loadBuiltin(role: AgentRoleDefinition): void })._loadBuiltin(role);
    }
  }
}
