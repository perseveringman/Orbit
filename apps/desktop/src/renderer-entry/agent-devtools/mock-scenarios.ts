// ---------------------------------------------------------------------------
// Agent DevTools – Mock Event Scenarios
// Produces realistic OrbitAgentEvent sequences for testing the full pipeline.
// ---------------------------------------------------------------------------

import type { OrbitAgentEvent } from '@orbit/agent-core';

type Scenario = () => AsyncGenerator<OrbitAgentEvent>;

let _id = 0;
function id(prefix = 'run'): string {
  _id += 1;
  return `${prefix}_mock_${_id}`;
}

function ts(offsetMs = 0): number {
  return Date.now() + offsetMs;
}

function ev<T extends OrbitAgentEvent>(
  type: T['type'],
  runId: string,
  fields: Omit<T, 'type' | 'runId' | 'timestamp'>,
  offsetMs = 0,
): T {
  return { type, runId, timestamp: ts(offsetMs), ...fields } as unknown as T;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- 1. Basic chat (streaming text response) ----

const basicChat: Scenario = async function* () {
  const runId = id();
  const sessionId = id('session');

  yield ev('orchestrator:started', runId, { sessionId, surface: 'global-chat' });
  await sleep(200);

  yield ev('orchestrator:routed', runId, { domain: 'planning', reason: '用户提问，路由到规划域' });
  await sleep(150);

  yield ev('agent:started', runId, { domain: 'planning', model: 'mock-gpt-4o' });
  await sleep(300);

  yield ev('agent:reasoning', runId, { content: '分析用户的问题，准备回答...' });
  await sleep(200);

  const response = 'Orbit 是一个以 AI 为核心的知识管理系统。\n\n它的主要特点包括：\n1. **多域 Agent 架构** — 规划、阅读、研究、写作等专业代理\n2. **安全审批机制** — 分级风险控制\n3. **可观测性** — 完整的追踪、指标和日志\n4. **流式事件管线** — 实时反馈执行进度';
  const chunks = response.match(/.{1,8}/g) ?? [response];

  for (const chunk of chunks) {
    yield ev('agent:stream-delta', runId, { delta: chunk });
    await sleep(40);
  }

  yield ev('agent:iteration', runId, {
    iteration: 1,
    maxIterations: 15,
    tokenUsage: { promptTokens: 120, completionTokens: 85, totalTokens: 205 },
  });
  await sleep(100);

  yield ev('agent:completed', runId, {
    domain: 'planning',
    responseContent: response,
    totalTokens: 205,
    totalDurationMs: 1800,
  });

  yield ev('orchestrator:completed', runId, {
    sessionId,
    totalTokens: 205,
    totalDurationMs: 2000,
  });
};

// ---- 2. Tool usage (file_read) ----

const toolUsage: Scenario = async function* () {
  const runId = id();
  const sessionId = id('session');

  yield ev('orchestrator:started', runId, { sessionId, surface: 'global-chat' });
  await sleep(200);

  yield ev('orchestrator:routed', runId, { domain: 'reading', reason: '用户请求读取文件' });
  await sleep(150);

  yield ev('agent:started', runId, { domain: 'reading', model: 'mock-gpt-4o' });
  await sleep(300);

  yield ev('agent:reasoning', runId, { content: '用户想查看文件内容，需要调用 file_read 工具' });
  await sleep(200);

  const toolCallId = id('tc');
  yield ev('agent:tool-call', runId, {
    toolName: 'file_read',
    args: { path: 'packages/agent-core/src/types.ts' },
    toolCallId,
  });
  await sleep(100);

  yield ev('capability:started', runId, {
    capabilityName: 'file_read',
    args: { path: 'packages/agent-core/src/types.ts' },
  });
  await sleep(300);

  yield ev('safety:check-passed', runId, {
    capabilityName: 'file_read',
    tier: 'R0-read',
  });
  await sleep(100);

  const fileContent = '// @orbit/agent-core – Type definitions\n\nexport type AgentRole = \'system\' | \'user\' | \'assistant\' | \'tool\';\n\nexport interface AgentMessage {\n  readonly id: string;\n  readonly role: AgentRole;\n  readonly content: string;\n  // ... (290 lines)\n}';

  yield ev('capability:completed', runId, {
    capabilityName: 'file_read',
    result: fileContent,
    durationMs: 45,
  });

  yield ev('agent:tool-result', runId, {
    toolName: 'file_read',
    toolCallId,
    success: true,
    result: fileContent,
    durationMs: 45,
  });
  await sleep(200);

  yield ev('agent:iteration', runId, {
    iteration: 1,
    maxIterations: 15,
    tokenUsage: { promptTokens: 180, completionTokens: 45, totalTokens: 225 },
  });

  const analysis = '文件 `types.ts` 定义了 agent-core 的核心类型：\n\n- **AgentRole** — 消息角色 (system/user/assistant/tool)\n- **AgentMessage** — 消息结构体\n- **AgentDomain** — 7 个领域代理\n- **RiskLevel** — R0~R3 四级风险\n\n共 290 行，是整个框架的类型基础。';

  const chunks = analysis.match(/.{1,10}/g) ?? [analysis];
  for (const chunk of chunks) {
    yield ev('agent:stream-delta', runId, { delta: chunk });
    await sleep(35);
  }

  yield ev('agent:iteration', runId, {
    iteration: 2,
    maxIterations: 15,
    tokenUsage: { promptTokens: 350, completionTokens: 120, totalTokens: 470 },
  });

  yield ev('agent:completed', runId, {
    domain: 'reading',
    responseContent: analysis,
    totalTokens: 470,
    totalDurationMs: 2500,
  });

  yield ev('orchestrator:completed', runId, {
    sessionId,
    totalTokens: 470,
    totalDurationMs: 2800,
  });
};

// ---- 3. Multi-tool chain ----

const multiToolChain: Scenario = async function* () {
  const runId = id();
  const sessionId = id('session');

  yield ev('orchestrator:started', runId, { sessionId, surface: 'research' });
  await sleep(200);

  yield ev('orchestrator:routed', runId, { domain: 'research', reason: '多步骤研究任务' });
  await sleep(100);

  yield ev('agent:started', runId, { domain: 'research', model: 'mock-gpt-4o' });
  await sleep(300);

  yield ev('agent:reasoning', runId, {
    content: '需要先搜索网络获取最新信息，然后读取本地文件对比，最后整理结果',
  });
  await sleep(200);

  // Tool 1: web_search
  const tc1 = id('tc');
  yield ev('agent:tool-call', runId, {
    toolName: 'web_search',
    args: { query: 'agent framework architecture 2026' },
    toolCallId: tc1,
  });
  await sleep(100);

  yield ev('capability:started', runId, {
    capabilityName: 'web_search',
    args: { query: 'agent framework architecture 2026' },
  });

  yield ev('capability:progress', runId, {
    capabilityName: 'web_search',
    progress: 0.5,
    message: '正在搜索...',
  });
  await sleep(400);

  yield ev('capability:completed', runId, {
    capabilityName: 'web_search',
    result: '找到 12 条结果：1) Multi-agent orchestration patterns... 2) Event-driven agent pipelines...',
    durationMs: 850,
  });

  yield ev('agent:tool-result', runId, {
    toolName: 'web_search',
    toolCallId: tc1,
    success: true,
    result: '找到 12 条结果：1) Multi-agent orchestration... 2) Event-driven pipelines...',
    durationMs: 850,
  });
  await sleep(200);

  yield ev('agent:iteration', runId, {
    iteration: 1,
    maxIterations: 15,
    tokenUsage: { promptTokens: 240, completionTokens: 60, totalTokens: 300 },
  });

  // Tool 2: file_read
  const tc2 = id('tc');
  yield ev('agent:tool-call', runId, {
    toolName: 'file_read',
    args: { path: 'docs/agent-plan/README.md' },
    toolCallId: tc2,
  });
  await sleep(100);

  yield ev('capability:started', runId, {
    capabilityName: 'file_read',
    args: { path: 'docs/agent-plan/README.md' },
  });
  await sleep(200);

  yield ev('capability:completed', runId, {
    capabilityName: 'file_read',
    result: '# Orbit Agent Plan\n## M1-M12 milestones...',
    durationMs: 30,
  });

  yield ev('agent:tool-result', runId, {
    toolName: 'file_read',
    toolCallId: tc2,
    success: true,
    result: '# Orbit Agent Plan\n## M1-M12 milestones...',
    durationMs: 30,
  });
  await sleep(150);

  yield ev('agent:iteration', runId, {
    iteration: 2,
    maxIterations: 15,
    tokenUsage: { promptTokens: 500, completionTokens: 95, totalTokens: 595 },
  });

  // Tool 3: text_transform
  const tc3 = id('tc');
  yield ev('agent:tool-call', runId, {
    toolName: 'text_transform',
    args: { operation: 'summarize', text: '...(combined results)...' },
    toolCallId: tc3,
  });
  await sleep(100);

  yield ev('capability:started', runId, {
    capabilityName: 'text_transform',
    args: { operation: 'summarize' },
  });
  await sleep(150);

  yield ev('capability:completed', runId, {
    capabilityName: 'text_transform',
    result: '综合对比摘要已生成',
    durationMs: 120,
  });

  yield ev('agent:tool-result', runId, {
    toolName: 'text_transform',
    toolCallId: tc3,
    success: true,
    result: '综合对比摘要已生成',
    durationMs: 120,
  });
  await sleep(200);

  yield ev('agent:iteration', runId, {
    iteration: 3,
    maxIterations: 15,
    tokenUsage: { promptTokens: 680, completionTokens: 180, totalTokens: 860 },
  });

  // Final response
  const finalResponse = '## 研究结果\n\n经过网络搜索和本地文档对比分析：\n\n**Orbit 的 Agent 架构优势：**\n- ✅ 事件驱动的异步管线（vs 同步调用链）\n- ✅ 多域代理分工（vs 单一通用 Agent）\n- ✅ 分级安全审批（vs 全自动/全手动）\n- ✅ 完整可观测性（tracer + metrics + logs）\n\n使用了 3 个工具，共 3 次迭代完成分析。';

  const chunks = finalResponse.match(/.{1,12}/g) ?? [finalResponse];
  for (const chunk of chunks) {
    yield ev('agent:stream-delta', runId, { delta: chunk });
    await sleep(30);
  }

  yield ev('agent:completed', runId, {
    domain: 'research',
    responseContent: finalResponse,
    totalTokens: 860,
    totalDurationMs: 4200,
  });

  yield ev('orchestrator:completed', runId, {
    sessionId,
    totalTokens: 860,
    totalDurationMs: 4500,
  });
};

// ---- 4. Approval workflow ----

const approvalWorkflow: Scenario = async function* () {
  const runId = id();
  const sessionId = id('session');

  yield ev('orchestrator:started', runId, { sessionId, surface: 'writing' });
  await sleep(200);

  yield ev('orchestrator:routed', runId, { domain: 'writing', reason: '写入文件需要审批' });
  await sleep(150);

  yield ev('agent:started', runId, { domain: 'writing', model: 'mock-gpt-4o' });
  await sleep(300);

  yield ev('agent:reasoning', runId, {
    content: '用户要求创建新文件，需要调用 file_write，这是 R1 级操作，需要审批',
  });
  await sleep(200);

  const toolCallId = id('tc');
  yield ev('agent:tool-call', runId, {
    toolName: 'file_write',
    args: { path: 'src/new-module.ts', content: 'export const hello = "world";' },
    toolCallId,
  });
  await sleep(100);

  yield ev('capability:started', runId, {
    capabilityName: 'file_write',
    args: { path: 'src/new-module.ts' },
  });
  await sleep(100);

  yield ev('safety:approval-required', runId, {
    capabilityName: 'file_write',
    tier: 'R1-internal-write',
    reason: '即将写入文件 src/new-module.ts，需要用户确认',
  });
  await sleep(500);

  // Simulate auto-approval after delay
  yield ev('safety:check-passed', runId, {
    capabilityName: 'file_write',
    tier: 'R1-internal-write',
  });
  await sleep(200);

  yield ev('capability:completed', runId, {
    capabilityName: 'file_write',
    result: '文件已写入: src/new-module.ts (29 bytes)',
    durationMs: 35,
  });

  yield ev('agent:tool-result', runId, {
    toolName: 'file_write',
    toolCallId,
    success: true,
    result: '文件已写入: src/new-module.ts (29 bytes)',
    durationMs: 35,
  });
  await sleep(200);

  yield ev('agent:iteration', runId, {
    iteration: 1,
    maxIterations: 15,
    tokenUsage: { promptTokens: 160, completionTokens: 55, totalTokens: 215 },
  });

  const resp = '✅ 文件已成功创建。\n\n路径: `src/new-module.ts`\n内容: 导出了 `hello` 常量。\n\n审批流程已通过 (R1-internal-write → A2-confirm)。';
  const chunks = resp.match(/.{1,10}/g) ?? [resp];
  for (const chunk of chunks) {
    yield ev('agent:stream-delta', runId, { delta: chunk });
    await sleep(35);
  }

  yield ev('agent:completed', runId, {
    domain: 'writing',
    responseContent: resp,
    totalTokens: 215,
    totalDurationMs: 2800,
  });

  yield ev('orchestrator:completed', runId, {
    sessionId,
    totalTokens: 215,
    totalDurationMs: 3000,
  });
};

// ---- 5. Error handling ----

const errorHandling: Scenario = async function* () {
  const runId = id();
  const sessionId = id('session');

  yield ev('orchestrator:started', runId, { sessionId, surface: 'global-chat' });
  await sleep(200);

  yield ev('orchestrator:routed', runId, { domain: 'ops', reason: '执行操作命令' });
  await sleep(150);

  yield ev('agent:started', runId, { domain: 'ops', model: 'mock-gpt-4o' });
  await sleep(300);

  yield ev('agent:reasoning', runId, { content: '尝试执行 shell 命令' });
  await sleep(200);

  const toolCallId = id('tc');
  yield ev('agent:tool-call', runId, {
    toolName: 'shell_exec',
    args: { command: 'cat /nonexistent/file.txt' },
    toolCallId,
  });
  await sleep(100);

  yield ev('capability:started', runId, {
    capabilityName: 'shell_exec',
    args: { command: 'cat /nonexistent/file.txt' },
  });
  await sleep(200);

  yield ev('capability:error', runId, {
    capabilityName: 'shell_exec',
    error: 'ENOENT: no such file or directory',
    durationMs: 15,
  });

  yield ev('agent:tool-result', runId, {
    toolName: 'shell_exec',
    toolCallId,
    success: false,
    result: 'Error: ENOENT: no such file or directory, open \'/nonexistent/file.txt\'',
    durationMs: 15,
  });
  await sleep(200);

  yield ev('agent:iteration', runId, {
    iteration: 1,
    maxIterations: 15,
    tokenUsage: { promptTokens: 140, completionTokens: 35, totalTokens: 175 },
  });

  // Agent recovers with a user-facing error message
  const recovery = '❌ 命令执行失败\n\n文件 `/nonexistent/file.txt` 不存在。\n\n**建议：**\n- 检查路径是否正确\n- 使用 `file_list` 查看可用文件\n- 确保文件已创建';

  const chunks = recovery.match(/.{1,10}/g) ?? [recovery];
  for (const chunk of chunks) {
    yield ev('agent:stream-delta', runId, { delta: chunk });
    await sleep(35);
  }

  yield ev('agent:completed', runId, {
    domain: 'ops',
    responseContent: recovery,
    totalTokens: 175,
    totalDurationMs: 1500,
  });

  yield ev('orchestrator:completed', runId, {
    sessionId,
    totalTokens: 175,
    totalDurationMs: 1700,
  });
};

// ---- 6. Multi-agent delegation ----

const multiAgent: Scenario = async function* () {
  const runId = id();
  const childRunId = id('child');
  const sessionId = id('session');

  yield ev('orchestrator:started', runId, { sessionId, surface: 'project' });
  await sleep(200);

  yield ev('orchestrator:routed', runId, {
    domain: 'planning',
    reason: '复合任务需要多域协作',
  });
  await sleep(150);

  yield ev('agent:started', runId, { domain: 'planning', model: 'mock-gpt-4o' });
  await sleep(300);

  yield ev('agent:reasoning', runId, {
    content: '此任务涉及代码阅读和写作，需要委派给 reading 域先分析代码',
  });
  await sleep(200);

  // Delegation
  yield ev('orchestrator:delegated', runId, {
    targetDomain: 'reading',
    task: '分析 agent-core 的事件类型定义',
    childRunId,
  });
  await sleep(200);

  // Child agent execution
  yield ev('agent:started', childRunId, { domain: 'reading', model: 'mock-gpt-4o' });
  await sleep(200);

  const readTcId = id('tc');
  yield ev('agent:tool-call', childRunId, {
    toolName: 'file_read',
    args: { path: 'packages/agent-core/src/events.ts' },
    toolCallId: readTcId,
  });
  await sleep(100);

  yield ev('capability:started', childRunId, {
    capabilityName: 'file_read',
    args: { path: 'packages/agent-core/src/events.ts' },
  });
  await sleep(200);

  yield ev('capability:completed', childRunId, {
    capabilityName: 'file_read',
    result: '// events.ts - 22 event types across 5 categories',
    durationMs: 25,
  });

  yield ev('agent:tool-result', childRunId, {
    toolName: 'file_read',
    toolCallId: readTcId,
    success: true,
    result: '// events.ts - 22 event types across 5 categories',
    durationMs: 25,
  });
  await sleep(200);

  yield ev('agent:iteration', childRunId, {
    iteration: 1,
    maxIterations: 10,
    tokenUsage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
  });

  yield ev('agent:completed', childRunId, {
    domain: 'reading',
    responseContent: '事件系统包含 22 个事件类型，分为 5 大类别',
    totalTokens: 280,
    totalDurationMs: 1200,
  });
  await sleep(200);

  // Parent agent continues
  yield ev('agent:reasoning', runId, {
    content: '子代理完成了代码分析，现在整合结果进行总结',
  });
  await sleep(200);

  const summary = '## 任务完成报告\n\n**多域协作结果：**\n\n1. 📖 **reading 域** 分析了 `events.ts`\n   - 22 个事件类型\n   - 5 大类别: Capability / Safety / Compression / Agent / Orchestrator\n\n2. 📋 **planning 域** 整合了分析结果\n   - 事件架构设计合理\n   - 类型层次清晰\n\n✅ 委派执行成功，耗时 1.2s';

  const chunks = summary.match(/.{1,10}/g) ?? [summary];
  for (const chunk of chunks) {
    yield ev('agent:stream-delta', runId, { delta: chunk });
    await sleep(30);
  }

  yield ev('agent:iteration', runId, {
    iteration: 2,
    maxIterations: 15,
    tokenUsage: { promptTokens: 520, completionTokens: 200, totalTokens: 720 },
  });

  yield ev('agent:completed', runId, {
    domain: 'planning',
    responseContent: summary,
    totalTokens: 720,
    totalDurationMs: 3500,
  });

  yield ev('orchestrator:completed', runId, {
    sessionId,
    totalTokens: 1000,
    totalDurationMs: 4000,
  });
};

// ---- Export scenario registry ----

export interface ScenarioInfo {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly run: Scenario;
}

export const SCENARIOS: readonly ScenarioInfo[] = [
  {
    id: 'basic-chat',
    label: '💬 基本对话',
    description: '简单文本响应 + 流式输出',
    run: basicChat,
  },
  {
    id: 'tool-usage',
    label: '🔧 工具调用',
    description: 'file_read 工具 + 安全检查',
    run: toolUsage,
  },
  {
    id: 'multi-tool',
    label: '⛓️ 多工具链',
    description: 'web_search → file_read → text_transform',
    run: multiToolChain,
  },
  {
    id: 'approval',
    label: '🔐 审批流程',
    description: 'file_write 触发 R1 级安全审批',
    run: approvalWorkflow,
  },
  {
    id: 'error',
    label: '❌ 错误处理',
    description: '工具执行失败 + Agent 自愈',
    run: errorHandling,
  },
  {
    id: 'multi-agent',
    label: '🤝 多 Agent 协作',
    description: 'orchestrator 委派子代理执行',
    run: multiAgent,
  },
] as const;
