import type { DatabasePort } from '@orbit/platform-contracts';
import type {
  EventRepository,
  EventRecord,
  AppendEventInput,
  EventListResult,
} from '@orbit/data-protocol';
import { createCursor, parseCursor } from '@orbit/data-protocol';
import type { ObjectUid } from '@orbit/domain';
import { generateUlid } from '@orbit/domain';
import { nowIso, keysToCamel } from './helpers.js';

function rowToEventRecord(row: Record<string, unknown>): EventRecord {
  const camel = keysToCamel(row);
  return {
    eventId: camel.eventId as string,
    streamUid: (camel.streamUid as string) ?? null,
    eventType: camel.eventType as string,
    actorType: camel.actorType as string,
    actorId: (camel.actorId as string) ?? null,
    causationId: (camel.causationId as string) ?? null,
    correlationId: (camel.correlationId as string) ?? null,
    payloadJson: camel.payloadJson as string,
    occurredAt: camel.occurredAt as string,
    createdAt: camel.createdAt as string,
  } as EventRecord;
}

const DEFAULT_LIMIT = 50;

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly db: DatabasePort) {}

  async append(input: AppendEventInput): Promise<EventRecord> {
    const now = nowIso();
    const eventId = generateUlid();

    this.db.run(
      `INSERT INTO events
        (event_id, stream_uid, event_type, actor_type, actor_id, causation_id, correlation_id, payload_json, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        input.streamUid ?? null,
        input.eventType,
        input.actorType,
        input.actorId ?? null,
        input.causationId ?? null,
        input.correlationId ?? null,
        input.payloadJson,
        now,
        now,
      ],
    );

    return {
      eventId,
      streamUid: input.streamUid ?? null,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      causationId: input.causationId ?? null,
      correlationId: input.correlationId ?? null,
      payloadJson: input.payloadJson,
      occurredAt: now,
      createdAt: now,
    } as EventRecord;
  }

  async listByStream(
    streamUid: ObjectUid,
    cursor?: string,
  ): Promise<EventListResult> {
    const conditions: string[] = ['stream_uid = ?'];
    const params: unknown[] = [streamUid];

    if (cursor) {
      const parsed = parseCursor(cursor);
      if (parsed) {
        conditions.push(
          '(occurred_at > ? OR (occurred_at = ? AND event_id > ?))',
        );
        params.push(parsed.updatedAt, parsed.updatedAt, parsed.id);
      }
    }

    const limit = DEFAULT_LIMIT;
    const where = `WHERE ${conditions.join(' AND ')}`;
    const sql = `SELECT * FROM events ${where} ORDER BY occurred_at ASC, event_id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = this.db.query<Record<string, unknown>>(sql, params);
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(rowToEventRecord);

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = createCursor(last.occurredAt, last.eventId);
    }

    return { items, nextCursor };
  }

  async replay(cursor: string, limit?: number): Promise<EventListResult> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const parsed = parseCursor(cursor);
    if (parsed) {
      conditions.push(
        '(occurred_at > ? OR (occurred_at = ? AND event_id > ?))',
      );
      params.push(parsed.updatedAt, parsed.updatedAt, parsed.id);
    }

    const effectiveLimit = limit ?? DEFAULT_LIMIT;
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM events ${where} ORDER BY occurred_at ASC, event_id ASC LIMIT ?`;
    params.push(effectiveLimit + 1);

    const rows = this.db.query<Record<string, unknown>>(sql, params);
    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(
      rowToEventRecord,
    );

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = createCursor(last.occurredAt, last.eventId);
    }

    return { items, nextCursor };
  }
}
