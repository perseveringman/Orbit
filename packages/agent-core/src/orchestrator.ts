// ---------------------------------------------------------------------------
// @orbit/agent-core – Orchestrator
// ---------------------------------------------------------------------------

import type {
  AgentDomain,
  AgentMessage,
  AgentRun,
  AgentSession,
  AgentStep,
  AgentSurface,
  ApprovalRequest,
  MemoryEntry,
  OrchestratorConfig,
  TokenUsage,
} from './types.js';
import { AGENT_DOMAINS, generateId } from './types.js';
import type { ToolRegistry } from './tool-registry.js';
import type { MemoryManager } from './memory-manager.js';
import { ContextCompressor } from './context-compressor.js';
import { SafetyGate } from './safety-gate.js';
import type { LLMAdapter } from './llm-adapter.js';
import { DOMAIN_AGENT_CONFIGS } from './domain-agents.js';

// ---- Public types ----

export interface OrchestratorInput {
  readonly session: AgentSession;
  readonly userMessage: string;
  readonly availableContext: readonly MemoryEntry[];
}

export interface OrchestratorOutput {
  readonly run: AgentRun;
  readonly responseMessage: AgentMessage;
  readonly objectMutations: readonly string[];
  readonly pendingApprovals: readonly ApprovalRequest[];
}

// ---- Intent routing heuristics ----

const SURFACE_TO_DEFAULT_DOMAIN: Record<AgentSurface, AgentDomain> = {
  project: 'planning',
  reader: 'reading',
  research: 'research',
  writing: 'writing',
  journal: 'writing',
  'task-center': 'planning',
  'global-chat': 'planning',
};

const KEYWORD_DOMAIN_MAP: readonly { readonly keywords: readonly string[]; readonly domain: AgentDomain }[] = [
  { keywords: ['plan', 'break down', 'task', 'schedule', 'prioritize'], domain: 'planning' },
  { keywords: ['read', 'find', 'look up', 'extract', 'show me'], domain: 'reading' },
  { keywords: ['research', 'search', 'investigate', 'compare', 'analyze'], domain: 'research' },
  { keywords: ['write', 'draft', 'compose', 'edit', 'rewrite'], domain: 'writing' },
  { keywords: ['review', 'check', 'critique', 'feedback', 'evaluate'], domain: 'review' },
  { keywords: ['link', 'connect', 'graph', 'relate', 'map'], domain: 'graph' },
  { keywords: ['import', 'export', 'sync', 'backup', 'clean', 'migrate'], domain: 'ops' },
];

// ---- Default config ----

const DEFAULT_CONFIG: OrchestratorConfig = {
  defaultModel: 'gpt-4o',
  maxIterations: 15,
  maxConcurrentDelegations: 3,
  maxDelegationDepth: 2,
  compressionThreshold: 4000,
};

// ---- Orchestrator ----

export class Orchestrator {
  private readonly config: OrchestratorConfig;
  private readonly registry: ToolRegistry;
  private readonly memory: MemoryManager;
  private readonly safety: SafetyGate;
  private readonly llm: LLMAdapter;
  private readonly compressor: ContextCompressor;

  constructor(
    config: Partial<OrchestratorConfig>,
    registry: ToolRegistry,
    memory: MemoryManager,
    safety: SafetyGate,
    llm: LLMAdapter,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = registry;
    this.memory = memory;
    this.safety = safety;
    this.llm = llm;
    this.compressor = new ContextCompressor({
      protectLastTokens: Math.floor(this.config.compressionThreshold * 0.4),
    });
  }

  /**
   * Route a user message to the most appropriate domain agent
   * based on surface context and keyword heuristics.
   */
  routeIntent(message: string, surface: AgentSurface): AgentDomain {
    const lower = message.toLowerCase();

    // Keyword matching (first match wins)
    for (const { keywords, domain } of KEYWORD_DOMAIN_MAP) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return domain;
      }
    }

    // Fall back to surface default
    return SURFACE_TO_DEFAULT_DOMAIN[surface];
  }

  /**
   * Assemble the full message context for a run, including
   * memory recall and optional compression.
   */
  async assembleContext(
    session: AgentSession,
  ): Promise<readonly AgentMessage[]> {
    let messages = [...session.messages];

    // Compress if needed
    if (this.compressor.shouldCompress(messages, this.config.compressionThreshold)) {
      const result = await this.compressor.compress(
        messages,
        this.config.compressionThreshold,
        async (text) => `Summary: ${text.slice(0, 200)}`,
      );
      messages = [...result.compressedMessages];
    }

    return messages;
  }

  /**
   * Execute a full agent run: route intent, assemble context, loop
   * through LLM calls and tool invocations until done.
   */
  async execute(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const domain = this.routeIntent(input.userMessage, input.session.surface);
    const runId = generateId('run');
    const steps: AgentStep[] = [];
    const pendingApprovals: ApprovalRequest[] = [];
    const objectMutations: string[] = [];

    const accUsage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    // Build context with memory
    const contextMessages = await this.assembleContext(input.session);
    const memoryBlock = this.memory.buildContextBlock(input.availableContext);

    const systemMsg: AgentMessage = {
      id: generateId('msg'),
      role: 'system',
      content:
        (DOMAIN_AGENT_CONFIGS[domain]?.systemPrompt ?? '') +
        (memoryBlock ? `\n\n${memoryBlock}` : ''),
      timestamp: new Date().toISOString(),
    };

    const userMsg: AgentMessage = {
      id: generateId('msg'),
      role: 'user',
      content: input.userMessage,
      timestamp: new Date().toISOString(),
    };

    const conversation: AgentMessage[] = [
      systemMsg,
      ...contextMessages.filter((m) => m.role !== 'system'),
      userMsg,
    ];

    // Agentic loop
    let iterations = 0;
    let lastAssistantMessage: AgentMessage = userMsg; // placeholder

    const domainConfig = DOMAIN_AGENT_CONFIGS[domain];
    const availableTools = this.registry.getDefinitions({
      domain,
      surface: input.session.surface,
    });

    while (iterations < this.config.maxIterations) {
      iterations++;

      const response = await this.llm.chatCompletion({
        model: domainConfig?.model ?? this.config.defaultModel,
        messages: conversation,
        tools: availableTools.length > 0 ? availableTools : undefined,
      });

      accUsage.promptTokens += response.usage.promptTokens;
      accUsage.completionTokens += response.usage.completionTokens;
      accUsage.totalTokens += response.usage.totalTokens;

      const choice = response.choices[0];
      if (!choice) break;

      lastAssistantMessage = choice.message;
      conversation.push(lastAssistantMessage);

      // Record reasoning step
      if (choice.message.content) {
        steps.push({
          id: generateId('step'),
          runId,
          kind: 'reasoning',
          content: choice.message.content,
          timestamp: new Date().toISOString(),
        });
      }

      // If no tool calls, we're done
      if (choice.finishReason !== 'tool_calls' || !choice.message.toolCalls?.length) {
        break;
      }

      // Process tool calls
      for (const tc of choice.message.toolCalls) {
        // Safety check
        const toolDef = availableTools.find((t) => t.name === tc.name);
        if (toolDef) {
          const check = this.safety.checkCapability(toolDef, {
            surface: input.session.surface,
            scopeLimit: toolDef.scopeLimit,
          });

          if (!check.allowed && check.requiresApproval) {
            const approval: ApprovalRequest = {
              id: generateId('apr'),
              runId,
              capabilityName: tc.name,
              riskLevel: toolDef.riskLevel,
              policy: check.tier,
              reason: check.reason ?? 'Requires approval',
              impactSummary: `Tool "${tc.name}" on ${input.session.surface}`,
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            pendingApprovals.push(approval);

            steps.push({
              id: generateId('step'),
              runId,
              kind: 'approval-wait',
              content: `Awaiting approval for ${tc.name}`,
              toolName: tc.name,
              approvalRequestId: approval.id,
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          if (!check.allowed) {
            const errorMsg: AgentMessage = {
              id: generateId('msg'),
              role: 'tool',
              content: `Error: ${check.reason ?? 'Not allowed'}`,
              toolCallId: tc.id,
              timestamp: new Date().toISOString(),
            };
            conversation.push(errorMsg);
            continue;
          }
        }

        // Dispatch tool
        steps.push({
          id: generateId('step'),
          runId,
          kind: 'tool-call',
          content: `Calling ${tc.name}`,
          toolName: tc.name,
          toolArgs: tc.arguments,
          timestamp: new Date().toISOString(),
        });

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }

        const result = await this.registry.dispatch(tc.name, args);

        steps.push({
          id: generateId('step'),
          runId,
          kind: 'tool-result',
          content: result.success ? result.output : (result.error ?? 'Unknown error'),
          toolName: tc.name,
          toolResult: result.output,
          timestamp: new Date().toISOString(),
        });

        const toolResultMsg: AgentMessage = {
          id: generateId('msg'),
          role: 'tool',
          content: result.success ? result.output : `Error: ${result.error}`,
          toolCallId: tc.id,
          timestamp: new Date().toISOString(),
        };
        conversation.push(toolResultMsg);
      }
    }

    const usage: TokenUsage = {
      promptTokens: accUsage.promptTokens,
      completionTokens: accUsage.completionTokens,
      totalTokens: accUsage.totalTokens,
    };

    const run: AgentRun = {
      id: runId,
      sessionId: input.session.id,
      agentDomain: domain,
      model: domainConfig?.model ?? this.config.defaultModel,
      status: pendingApprovals.length > 0 ? 'awaiting-approval' : 'completed',
      tokenUsage: usage,
      steps,
      createdAt: new Date().toISOString(),
      completedAt: pendingApprovals.length > 0 ? undefined : new Date().toISOString(),
    };

    return {
      run,
      responseMessage: lastAssistantMessage,
      objectMutations,
      pendingApprovals,
    };
  }

  /**
   * Delegate a sub-task to a specific domain agent with a fresh context.
   */
  async delegate(
    parentRun: AgentRun,
    domain: AgentDomain,
    task: string,
  ): Promise<AgentRun> {
    const delegateSession: AgentSession = {
      id: generateId('ses'),
      workspaceId: '',
      surface: 'global-chat',
      anchorObjectIds: [],
      lineage: [{ type: 'delegated_from', sourceId: parentRun.id }],
      status: 'active',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const output = await this.execute({
      session: delegateSession,
      userMessage: task,
      availableContext: [],
    });

    return output.run;
  }
}
