// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Profiles (M7)
// ---------------------------------------------------------------------------

import type { AgentConfig } from '../orchestration/agent-executor.js';

// ---- Types ----

export interface AgentProfile {
  readonly name: string;
  readonly domain: string;
  readonly displayName: string;
  readonly description: string;
  readonly icon: string;
  readonly systemPrompt: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxIterations: number;
  readonly allowedTools: readonly string[];
  readonly blockedTools: readonly string[];
  readonly specializations: readonly string[];
  readonly outputFormat?: 'text' | 'markdown' | 'json' | 'code';
}

// ---- Built-in profiles ----

export const AGENT_PROFILES: readonly AgentProfile[] = [
  {
    name: 'planner',
    domain: 'planning',
    displayName: '规划助手',
    description: '分解复杂任务，制定执行计划',
    icon: '📋',
    systemPrompt:
      'You are a planning agent. Your job is to break down complex tasks into clear, ' +
      'actionable steps. Always provide structured plans with priorities and dependencies.',
    model: 'gpt-4o',
    temperature: 0.3,
    maxIterations: 10,
    allowedTools: ['shell_exec', 'file_read', 'file_list', 'web_fetch', 'grep'],
    blockedTools: [],
    specializations: ['plan', 'organize', 'decompose', 'strategy', 'roadmap', 'task'],
    outputFormat: 'markdown',
  },
  {
    name: 'researcher',
    domain: 'research',
    displayName: '研究助手',
    description: '搜索、分析和综合信息',
    icon: '🔍',
    systemPrompt:
      'You are a research agent. Search for information, analyze findings, ' +
      'and provide comprehensive summaries with citations.',
    model: 'gpt-4o',
    temperature: 0.5,
    maxIterations: 15,
    allowedTools: ['web_fetch', 'web_search', 'grep', 'file_read', 'file_list'],
    blockedTools: ['file_write', 'shell_exec'],
    specializations: ['search', 'research', 'find', 'analyze', 'investigate', 'look up'],
    outputFormat: 'markdown',
  },
  {
    name: 'writer',
    domain: 'writing',
    displayName: '写作助手',
    description: '创作、编辑和改进文本内容',
    icon: '✍️',
    systemPrompt:
      'You are a writing agent. Help users create, edit, and improve text content. ' +
      'Maintain consistent tone and style.',
    model: 'gpt-4o',
    temperature: 0.7,
    maxIterations: 10,
    allowedTools: ['file_read', 'file_write', 'web_fetch'],
    blockedTools: ['shell_exec'],
    specializations: ['write', 'draft', 'edit', 'compose', 'article', 'essay', 'blog'],
    outputFormat: 'markdown',
  },
  {
    name: 'coder',
    domain: 'ops',
    displayName: '编程助手',
    description: '编写、调试和优化代码',
    icon: '💻',
    systemPrompt:
      'You are a coding agent. Help users write, debug, and optimize code. ' +
      'Follow best practices and write clean, documented code.',
    model: 'gpt-4o',
    temperature: 0.2,
    maxIterations: 15,
    allowedTools: ['shell_exec', 'file_read', 'file_write', 'file_list', 'grep', 'file_search'],
    blockedTools: [],
    specializations: [
      'code', 'program', 'debug', 'fix', 'implement', 'develop', 'build', 'compile', 'test',
    ],
    outputFormat: 'code',
  },
  {
    name: 'reviewer',
    domain: 'review',
    displayName: '审查助手',
    description: '审查代码、文档和方案',
    icon: '🔎',
    systemPrompt:
      'You are a review agent. Carefully review code, documents, and plans. ' +
      'Identify issues, suggest improvements, and ensure quality.',
    model: 'gpt-4o',
    temperature: 0.3,
    maxIterations: 10,
    allowedTools: ['file_read', 'file_list', 'grep', 'file_search'],
    blockedTools: ['file_write', 'shell_exec'],
    specializations: ['review', 'check', 'audit', 'inspect', 'evaluate', 'assess'],
    outputFormat: 'markdown',
  },
  {
    name: 'reader',
    domain: 'reading',
    displayName: '阅读助手',
    description: '阅读和理解长文本、文档，管理订阅源和多媒体内容',
    icon: '📖',
    systemPrompt:
      'You are a reading agent. Help users understand long documents, extract key ' +
      'information, provide summaries, manage RSS/podcast subscriptions, resolve URLs, ' +
      'and render video and podcast content.',
    model: 'gpt-4o',
    temperature: 0.3,
    maxIterations: 10,
    allowedTools: [
      'file_read',
      'web_fetch',
      'grep',
      'resolve_url',
      'discover_rss_feeds',
      'parse_rss_feed',
      'parse_opml',
      'export_opml',
      'resolve_youtube',
      'resolve_podcast',
      'render_video',
      'render_podcast',
      'schedule_fetch',
    ],
    blockedTools: ['file_write', 'shell_exec'],
    specializations: [
      'read', 'summarize', 'understand', 'extract', 'comprehend',
      'rss', 'feed', 'podcast', 'video', 'subscribe', 'opml', 'youtube',
    ],
    outputFormat: 'markdown',
  },
  {
    name: 'assistant',
    domain: 'planning',
    displayName: '通用助手',
    description: '通用对话和任务处理',
    icon: '🤖',
    systemPrompt:
      'You are a helpful general-purpose assistant. Help users with any task, ' +
      'using available tools when needed. Be clear and concise.',
    model: 'gpt-4o',
    temperature: 0.5,
    maxIterations: 15,
    allowedTools: [
      'shell_exec', 'file_read', 'file_write', 'file_list', 'grep',
      'web_fetch', 'datetime', 'calculate', 'json_parse', 'ask_user',
    ],
    blockedTools: [],
    specializations: ['help', 'assist', 'general', 'chat'],
    outputFormat: 'text',
  },
];

// ---- Lookup helpers ----

/** Get a profile by exact name. */
export function getProfile(name: string): AgentProfile | undefined {
  return AGENT_PROFILES.find((p) => p.name === name);
}

/**
 * Match a query string to the best profile based on specialization keywords.
 * Falls back to 'assistant' when no specialization matches.
 */
export function matchProfile(query: string): AgentProfile {
  const lower = query.toLowerCase();

  let bestProfile: AgentProfile | undefined;
  let bestScore = 0;

  for (const profile of AGENT_PROFILES) {
    let score = 0;
    for (const keyword of profile.specializations) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  if (bestProfile && bestScore > 0) return bestProfile;

  // Default to 'assistant'
  return AGENT_PROFILES.find((p) => p.name === 'assistant')!;
}

/**
 * Convert an AgentProfile to an AgentConfig compatible with AgentExecutor.
 */
export function profileToAgentConfig(profile: AgentProfile): AgentConfig {
  return {
    name: profile.name,
    domain: profile.domain,
    systemPrompt: profile.systemPrompt,
    model: profile.model,
    maxIterations: profile.maxIterations,
    allowedCapabilities: profile.allowedTools,
    blockedCapabilities: profile.blockedTools,
    temperature: profile.temperature,
  };
}
