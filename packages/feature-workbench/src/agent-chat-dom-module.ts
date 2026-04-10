import type { AgentMessage, AgentSurface, AgentDomain, AgentStep } from '@orbit/agent-core';

// ---------------------------------------------------------------------------
// Input → ViewModel mapping for Agent Chat
// ---------------------------------------------------------------------------

export interface AgentChatInput {
  readonly surface: AgentSurface;
  readonly sessionId: string | null;
  readonly messages: readonly AgentMessage[];
  readonly isProcessing: boolean;
  readonly currentDomain: AgentDomain | 'orchestrator' | null;
  readonly pendingApprovals: readonly { id: string; reason: string; capabilityName: string }[];
}

export interface AgentChatViewModel {
  readonly surface: AgentSurface;
  readonly sessionId: string | null;
  readonly messages: readonly AgentChatMessageViewModel[];
  readonly isProcessing: boolean;
  readonly currentDomain: AgentDomain | 'orchestrator' | null;
  readonly pendingApprovals: readonly AgentChatApprovalViewModel[];
  readonly surfaceLabel: string;
  readonly emptyStateMessage: string;
}

export interface AgentChatMessageViewModel {
  readonly id: string;
  readonly role: AgentMessage['role'];
  readonly content: string;
  readonly timestamp: string;
  readonly isToolCall: boolean;
  readonly toolName?: string;
  readonly toolArgs?: string;
  readonly toolResult?: string;
  readonly roleLabel: string;
  readonly formattedTime: string;
}

export interface AgentChatApprovalViewModel {
  readonly id: string;
  readonly reason: string;
  readonly capabilityName: string;
  readonly capabilityLabel: string;
}

// ---- Label maps ----

const SURFACE_LABELS: Record<AgentSurface, string> = {
  project: '项目',
  reader: '阅读器',
  research: '研究',
  writing: '写作',
  journal: '日志',
  'task-center': '任务中心',
  'global-chat': '全局对话',
};

const SURFACE_EMPTY_MESSAGES: Record<AgentSurface, string> = {
  project: '发送消息开始项目对话 …',
  reader: '有任何阅读相关的问题？请提问 …',
  research: '让我们开始研究吧 …',
  writing: '准备好辅助写作了，发送消息开始 …',
  journal: '记录你的想法，我可以帮忙 …',
  'task-center': '关于任务有什么需要帮助的？',
  'global-chat': '你好！有什么可以帮到你的？',
};

const ROLE_LABELS: Record<AgentMessage['role'], string> = {
  system: '系统',
  user: '用户',
  assistant: '助手',
  tool: '工具',
};

const CAPABILITY_LABELS: Record<string, string> = {
  'file-write': '文件写入',
  'file-delete': '文件删除',
  'web-fetch': '网络请求',
  'api-call': 'API 调用',
  'db-write': '数据库写入',
  'send-email': '发送邮件',
};

// ---- Helpers ----

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}

function mapMessage(msg: AgentMessage): AgentChatMessageViewModel {
  const hasToolCalls = (msg.toolCalls?.length ?? 0) > 0;
  const firstTool = hasToolCalls ? msg.toolCalls![0] : undefined;

  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    isToolCall: hasToolCalls || msg.role === 'tool',
    toolName: firstTool?.name ?? (msg.role === 'tool' ? 'tool-result' : undefined),
    toolArgs: firstTool?.arguments,
    toolResult: msg.role === 'tool' ? msg.content : undefined,
    roleLabel: ROLE_LABELS[msg.role],
    formattedTime: formatTime(msg.timestamp),
  };
}

function mapApproval(approval: {
  id: string;
  reason: string;
  capabilityName: string;
}): AgentChatApprovalViewModel {
  return {
    id: approval.id,
    reason: approval.reason,
    capabilityName: approval.capabilityName,
    capabilityLabel: CAPABILITY_LABELS[approval.capabilityName] ?? approval.capabilityName,
  };
}

// ---- Public ----

export function createAgentChatViewModel(input: AgentChatInput): AgentChatViewModel {
  return {
    surface: input.surface,
    sessionId: input.sessionId,
    messages: input.messages.map(mapMessage),
    isProcessing: input.isProcessing,
    currentDomain: input.currentDomain,
    pendingApprovals: input.pendingApprovals.map(mapApproval),
    surfaceLabel: SURFACE_LABELS[input.surface],
    emptyStateMessage: SURFACE_EMPTY_MESSAGES[input.surface],
  };
}
