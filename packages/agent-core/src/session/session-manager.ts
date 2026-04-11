// ---------------------------------------------------------------------------
// @orbit/agent-core – Session Manager (M5)
// ---------------------------------------------------------------------------

import type { AgentMessage } from '../types.js';
import { generateId } from '../types.js';
import { TokenEstimator } from './token-estimator.js';

// ---- Public types ----

export interface SessionRecord {
  readonly id: string;
  readonly parentId?: string;
  readonly createdAt: number;
  readonly surface: string;
  readonly metadata: Record<string, unknown>;
  messages: AgentMessage[];
  tokenCount: number;
  compressed: boolean;
}

export interface SessionForkOptions {
  readonly summary?: string;
  readonly preserveMessages?: number;
}

// ---- SessionManager ----

export class SessionManager {
  private readonly sessions = new Map<string, SessionRecord>();

  /** Create a new session. */
  create(
    surface: string,
    metadata?: Record<string, unknown>,
  ): SessionRecord {
    const session: SessionRecord = {
      id: generateId('ses'),
      createdAt: Date.now(),
      surface,
      metadata: metadata ? { ...metadata } : {},
      messages: [],
      tokenCount: 0,
      compressed: false,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** Retrieve a session by ID. */
  get(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  /** Append a message and update the session token count. */
  addMessage(sessionId: string, message: AgentMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.messages.push(message);
    session.tokenCount += TokenEstimator.estimateMessage(message);
  }

  /**
   * Fork a session — create a child whose lineage points back to the parent.
   * Optionally injects a summary of the parent conversation and/or preserves
   * the last N messages from the parent.
   */
  fork(
    sessionId: string,
    options: SessionForkOptions = {},
  ): SessionRecord {
    const parent = this.sessions.get(sessionId);
    if (!parent) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const messages: AgentMessage[] = [];

    // Inject summary as a system message if provided
    if (options.summary) {
      messages.push({
        id: generateId('sum'),
        role: 'system',
        content: `[Session summary from parent ${parent.id}]\n${options.summary}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Carry over the last N messages from the parent
    if (options.preserveMessages && options.preserveMessages > 0) {
      const preserved = parent.messages.slice(-options.preserveMessages);
      messages.push(...preserved);
    }

    const child: SessionRecord = {
      id: generateId('ses'),
      parentId: parent.id,
      createdAt: Date.now(),
      surface: parent.surface,
      metadata: { ...parent.metadata, forkedFrom: parent.id },
      messages,
      tokenCount: TokenEstimator.estimateMessages(messages),
      compressed: false,
    };
    this.sessions.set(child.id, child);
    return child;
  }

  /**
   * Walk the parent chain upward, returning an array from the root ancestor
   * down to the given session (inclusive).
   */
  getLineage(sessionId: string): readonly SessionRecord[] {
    const chain: SessionRecord[] = [];
    let current = this.sessions.get(sessionId);
    while (current) {
      chain.push(current);
      current = current.parentId
        ? this.sessions.get(current.parentId)
        : undefined;
    }
    return chain.reverse();
  }

  /** Return direct children of the given session. */
  getChildren(sessionId: string): readonly SessionRecord[] {
    const children: SessionRecord[] = [];
    for (const session of this.sessions.values()) {
      if (session.parentId === sessionId) {
        children.push(session);
      }
    }
    return children;
  }

  /** List all sessions. */
  list(): readonly SessionRecord[] {
    return [...this.sessions.values()];
  }

  /** Delete a session. Returns true if the session existed. */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /** Convenience: estimate tokens for a message array. */
  estimateTokens(messages: readonly AgentMessage[]): number {
    return TokenEstimator.estimateMessages(messages);
  }
}
