// ---------------------------------------------------------------------------
// @orbit/agent-core – Agent Executor (M6)
// ---------------------------------------------------------------------------

import type { AgentStep, TokenUsage, AgentMessage, ChatCompletionRequest } from '../types.js';
import { generateId } from '../types.js';
import type { LLMAdapter } from '../llm-adapter.js';
import type { ExecutionContext } from '../execution-context.js';
import type { OrbitAgentEvent } from '../events.js';
import { createEvent } from '../events.js';
import type {
  AgentStartedEvent,
  AgentIterationEvent,
  AgentReasoningEvent,
  AgentCompletedEvent,
  AgentErrorEvent,
} from '../events.js';

// ---- Public types ----

export interface AgentConfig {
  readonly name: string;
  readonly domain: string;
  readonly systemPrompt: string;
  readonly model?: string;
  readonly maxIterations: number;
  readonly allowedCapabilities?: readonly string[];
  readonly blockedCapabilities?: readonly string[];
  readonly temperature?: number;
}

export interface AgentInput {
  readonly task: string;
  readonly context?: string;
  readonly parentRunId?: string;
}

export type AgentOutputStatus = 'completed' | 'error' | 'cancelled' | 'max-iterations';

export interface AgentOutput {
  readonly agentName: string;
  readonly response: string;
  readonly steps: readonly AgentStep[];
  readonly tokenUsage: TokenUsage;
  readonly durationMs: number;
  readonly status: AgentOutputStatus;
}

// ---- Agent Executor ----

export class AgentExecutor {
  constructor(
    private readonly config: AgentConfig,
    private readonly llm: LLMAdapter,
    private readonly toolRegistry: { dispatch?(name: string, args: Record<string, unknown>): Promise<{ success: boolean; output: string; error?: string }> } | null,
  ) {}

  /**
   * Execute agent and return output (non-streaming).
   * Internally consumes executeStream().
   */
  async execute(input: AgentInput, context?: ExecutionContext): Promise<AgentOutput> {
    const stream = this.executeStream(input, context);
    let result: IteratorResult<OrbitAgentEvent, AgentOutput>;
    do {
      result = await stream.next();
    } while (!result.done);
    return result.value;
  }

  /**
   * Stream execution events and return final AgentOutput.
   */
  async *executeStream(
    input: AgentInput,
    context?: ExecutionContext,
  ): AsyncGenerator<OrbitAgentEvent, AgentOutput> {
    const startTime = Date.now();
    const runId = input.parentRunId ?? generateId('run');
    const steps: AgentStep[] = [];
    const accUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    yield createEvent<AgentStartedEvent>('agent:started', runId, {
      domain: this.config.domain,
      model: this.config.model ?? 'default',
    });

    // Build conversation
    const conversation: AgentMessage[] = [];

    const systemContent = input.context
      ? `${this.config.systemPrompt}\n\n${input.context}`
      : this.config.systemPrompt;

    conversation.push({
      id: generateId('msg'),
      role: 'system',
      content: systemContent,
      timestamp: new Date().toISOString(),
    });

    conversation.push({
      id: generateId('msg'),
      role: 'user',
      content: input.task,
      timestamp: new Date().toISOString(),
    });

    let iterations = 0;
    let lastContent = '';
    let status: AgentOutputStatus = 'completed';

    try {
      while (iterations < this.config.maxIterations) {
        // Check for cancellation
        if (context?.signal.aborted) {
          status = 'cancelled';
          break;
        }

        iterations++;

        const request: ChatCompletionRequest = {
          model: this.config.model ?? 'default',
          messages: conversation,
          temperature: this.config.temperature,
        };

        const response = await this.llm.chatCompletion(request);

        accUsage.promptTokens += response.usage.promptTokens;
        accUsage.completionTokens += response.usage.completionTokens;
        accUsage.totalTokens += response.usage.totalTokens;

        yield createEvent<AgentIterationEvent>('agent:iteration', runId, {
          iteration: iterations,
          maxIterations: this.config.maxIterations,
          tokenUsage: { ...accUsage },
        });

        const choice = response.choices[0];
        if (!choice) break;

        conversation.push(choice.message);

        if (choice.message.content) {
          lastContent = choice.message.content;
          steps.push({
            id: generateId('step'),
            runId,
            kind: 'reasoning',
            content: choice.message.content,
            timestamp: new Date().toISOString(),
          });

          yield createEvent<AgentReasoningEvent>('agent:reasoning', runId, {
            content: choice.message.content,
          });
        }

        // If no tool calls, we're done
        if (choice.finishReason !== 'tool_calls' || !choice.message.toolCalls?.length) {
          break;
        }

        // Process tool calls
        for (const tc of choice.message.toolCalls) {
          steps.push({
            id: generateId('step'),
            runId,
            kind: 'tool-call',
            content: `Calling ${tc.name}`,
            toolName: tc.name,
            toolArgs: tc.arguments,
            timestamp: new Date().toISOString(),
          });

          let resultContent: string;
          if (this.toolRegistry?.dispatch) {
            let args: Record<string, unknown>;
            try {
              args = JSON.parse(tc.arguments) as Record<string, unknown>;
            } catch {
              args = {};
            }

            const result = await this.toolRegistry.dispatch(tc.name, args);
            resultContent = result.success ? result.output : (result.error ?? 'Unknown error');

            steps.push({
              id: generateId('step'),
              runId,
              kind: 'tool-result',
              content: resultContent,
              toolName: tc.name,
              toolResult: result.output,
              timestamp: new Date().toISOString(),
            });
          } else {
            resultContent = 'Tool registry not available';
          }

          conversation.push({
            id: generateId('msg'),
            role: 'tool',
            content: resultContent,
            toolCallId: tc.id,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Detect max-iterations
      if (iterations >= this.config.maxIterations && status === 'completed') {
        status = 'max-iterations';
      }
    } catch (err: unknown) {
      status = 'error';
      const errorMessage = err instanceof Error ? err.message : String(err);
      lastContent = `Error: ${errorMessage}`;

      yield createEvent<AgentErrorEvent>('agent:error', runId, {
        domain: this.config.domain,
        error: errorMessage,
      });
    }

    const durationMs = Date.now() - startTime;

    yield createEvent<AgentCompletedEvent>('agent:completed', runId, {
      domain: this.config.domain,
      responseContent: lastContent,
      totalTokens: accUsage.totalTokens,
      totalDurationMs: durationMs,
    });

    return {
      agentName: this.config.name,
      response: lastContent,
      steps,
      tokenUsage: {
        promptTokens: accUsage.promptTokens,
        completionTokens: accUsage.completionTokens,
        totalTokens: accUsage.totalTokens,
      },
      durationMs,
      status,
    };
  }

  getConfig(): AgentConfig {
    return this.config;
  }
}
