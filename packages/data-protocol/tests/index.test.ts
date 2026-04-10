import { describe, expect, it } from 'vitest';

import {
  createMutationEnvelope,
  createCursor,
  createRepositoryCursor,
  parseCursor,
  isDeletionMutation,
  isCreationMutation,
} from '../src/index';

import type {
  MutationEnvelope,
  ObjectQueryFilter,
  AgentItemView,
  AgentLinkView,
  AgentEventView,
  AgentDataAccess,
  WriteTransactionResult,
  ObjectRecord,
  LinkRecord,
  EventRecord,
  SearchResult,
} from '../src/index';

// ── MutationEnvelope ───────────────────────────────────────────────

describe('MutationEnvelope', () => {
  const baseInput = {
    mutationId: 'mut_1',
    objectUid: 'task:tsk_123',
    objectType: 'task',
    actorType: 'user' as const,
    actorId: 'user_1',
    deviceId: 'dev_1',
    baseVersion: 'v0',
    type: 'task.status_changed',
    payload: { status: 'done' },
    occurredAt: '2026-01-01T00:00:00.000Z',
  };

  it('creates envelope with idempotency key', () => {
    const envelope = createMutationEnvelope(baseInput);

    expect(envelope.idempotencyKey).toBe('mut_1:dev_1');
    expect(envelope.mutationId).toBe('mut_1');
    expect(envelope.objectUid).toBe('task:tsk_123');
    expect(envelope.objectType).toBe('task');
    expect(envelope.actorType).toBe('user');
    expect(envelope.baseVersion).toBe('v0');
  });

  it('isDeletionMutation detects .deleted suffix', () => {
    const deletion = createMutationEnvelope({
      ...baseInput,
      type: 'article.deleted',
      payload: { articleId: 'art_1' },
    });
    expect(isDeletionMutation(deletion)).toBe(true);
  });

  it('isDeletionMutation detects payload.deleted flag', () => {
    expect(
      isDeletionMutation({ type: 'article.updated', payload: { deleted: true } }),
    ).toBe(true);
  });

  it('isDeletionMutation returns false for non-deletions', () => {
    expect(
      isDeletionMutation({ type: 'task.status_changed', payload: {} }),
    ).toBe(false);
  });

  it('isCreationMutation detects .created suffix', () => {
    const creation = createMutationEnvelope({
      ...baseInput,
      type: 'task.created',
    });
    expect(isCreationMutation(creation)).toBe(true);
  });

  it('isCreationMutation detects payload.created flag', () => {
    expect(
      isCreationMutation({ type: 'task.init', payload: { created: true } }),
    ).toBe(true);
  });

  it('isCreationMutation returns false for non-creations', () => {
    expect(
      isCreationMutation({ type: 'task.status_changed', payload: {} }),
    ).toBe(false);
  });
});

// ── Cursor utilities ───────────────────────────────────────────────

describe('Cursor utilities', () => {
  it('createCursor produces expected format', () => {
    const cursor = createCursor('2026-01-02T00:00:00.000Z', 'art_1');
    expect(cursor).toBe('2026-01-02T00:00:00.000Z::art_1');
  });

  it('createRepositoryCursor is an alias for createCursor', () => {
    const a = createCursor('2026-01-01T00:00:00.000Z', 'x');
    const b = createRepositoryCursor('2026-01-01T00:00:00.000Z', 'x');
    expect(a).toBe(b);
  });

  it('parseCursor round-trips correctly', () => {
    const cursor = createCursor('2026-01-02T00:00:00.000Z', 'note_01JZ');
    const parsed = parseCursor(cursor);
    expect(parsed).toEqual({
      updatedAt: '2026-01-02T00:00:00.000Z',
      id: 'note_01JZ',
    });
  });

  it('parseCursor returns null for invalid cursor', () => {
    expect(parseCursor('no-separator')).toBeNull();
    expect(parseCursor('::trailing')).toBeNull();
    expect(parseCursor('leading::')).toBeNull();
  });
});

// ── Type-level tests (compile-time verification) ───────────────────

describe('Type completeness', () => {
  it('ObjectQueryFilter accepts all expected fields', () => {
    const filter: ObjectQueryFilter = {
      objectType: 'task',
      status: 'active',
      origin: 'human',
      layer: 'source',
      textSearch: 'deploy',
      updatedSince: '2026-01-01T00:00:00.000Z',
      cursor: null,
      limit: 20,
    };
    expect(filter.objectType).toBe('task');
    expect(filter.limit).toBe(20);
  });

  it('AgentItemView has all required fields', () => {
    const item: AgentItemView = {
      objectUid: 'note:nte_1',
      objectType: 'note',
      title: 'My Note',
      summary: null,
      status: 'active',
      origin: 'human',
      layer: 'source',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(item.objectUid).toBe('note:nte_1');
    expect(item.origin).toBe('human');
  });

  it('AgentLinkView has all required fields', () => {
    const link: AgentLinkView = {
      linkId: 'lnk_1',
      sourceUid: 'task:tsk_1',
      targetUid: 'note:nte_1',
      relationType: 'supports',
      origin: 'ai',
      status: 'proposed',
      confidence: 0.85,
      whySummary: 'Note discusses the task',
    };
    expect(link.relationType).toBe('supports');
    expect(link.confidence).toBe(0.85);
  });

  it('AgentEventView has all required fields', () => {
    const event: AgentEventView = {
      eventId: 'evt_1',
      streamUid: 'task:tsk_1',
      eventType: 'task.status_changed',
      actorType: 'user',
      payloadJson: '{"status":"done"}',
      occurredAt: '2026-01-01T00:00:00.000Z',
    };
    expect(event.eventType).toBe('task.status_changed');
  });

  it('WriteTransactionResult has all required fields', () => {
    const result: WriteTransactionResult = {
      objectUid: 'task:tsk_1',
      versionToken: 'v1',
      linksCreated: 2,
      eventsAppended: 1,
    };
    expect(result.linksCreated).toBe(2);
  });

  it('MutationEnvelope includes all Wave 1 fields', () => {
    const envelope: MutationEnvelope = {
      mutationId: 'mut_1',
      objectUid: 'task:tsk_1',
      objectType: 'task',
      actorType: 'user',
      actorId: 'user_1',
      deviceId: 'dev_1',
      baseVersion: 'v0',
      type: 'task.created',
      payload: {},
      occurredAt: '2026-01-01T00:00:00.000Z',
      idempotencyKey: 'mut_1:dev_1',
    };
    expect(envelope.baseVersion).toBe('v0');
    expect(envelope.objectType).toBe('task');
  });
});
