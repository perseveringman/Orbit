import type { DatabasePort } from '@orbit/platform-contracts';
import type {
  WriteTransaction,
  WriteTransactionResult,
  WriteTransactionFactory,
  WriteLinkInput,
  AppendEventInput,
} from '@orbit/data-protocol';
import type { ObjectUid, OrbitObjectType } from '@orbit/domain';
import { generateUlid, createObjectUid, parseObjectUid } from '@orbit/domain';
import { getTableForType, nowIso, camelToSnake } from './helpers.js';

export class SqliteWriteTransaction implements WriteTransaction {
  private objectType: string | null = null;
  private payload: Record<string, unknown> = {};
  private objectUid: ObjectUid | null = null;
  private objectId: string | null = null;
  private versionToken: string | null = null;
  private pendingLinks: readonly WriteLinkInput[] = [];
  private pendingEvents: readonly AppendEventInput[] = [];
  private indexSynced = false;

  constructor(private readonly db: DatabasePort) {}

  writeObject(type: string, payload: Record<string, unknown>): WriteTransaction {
    this.objectType = type;
    this.payload = payload;
    this.objectId = (payload.id as string) ?? generateUlid();
    this.objectUid = createObjectUid(type as OrbitObjectType, this.objectId);
    this.versionToken = generateUlid();
    return this;
  }

  syncIndex(): WriteTransaction {
    this.indexSynced = true;
    return this;
  }

  writeLinks(links: readonly WriteLinkInput[]): WriteTransaction {
    this.pendingLinks = links;
    return this;
  }

  appendEvents(events: readonly AppendEventInput[]): WriteTransaction {
    this.pendingEvents = events;
    return this;
  }

  async execute(): Promise<WriteTransactionResult> {
    if (!this.objectType || !this.objectUid || !this.objectId || !this.versionToken) {
      throw new Error('WriteTransaction: writeObject() must be called before execute()');
    }

    const type = this.objectType;
    const objectUid = this.objectUid;
    const objectId = this.objectId;
    const versionToken = this.versionToken;
    const table = getTableForType(type);
    const now = nowIso();
    let linksCreated = 0;
    let eventsAppended = 0;

    this.db.transaction(() => {
      // Step 1: Write to type table
      const typePayload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this.payload)) {
        typePayload[camelToSnake(key)] = value;
      }
      typePayload.id = objectId;
      typePayload.created_at = typePayload.created_at ?? now;
      typePayload.updated_at = now;
      if (typePayload.deleted_flg === undefined) {
        typePayload.deleted_flg = 0;
      }

      const typeCols = Object.keys(typePayload);
      const typePlaceholders = typeCols.map(() => '?').join(', ');
      const typeValues = typeCols.map((c) => typePayload[c]);
      this.db.run(
        `INSERT OR REPLACE INTO ${table} (${typeCols.join(', ')}) VALUES (${typePlaceholders})`,
        typeValues,
      );

      // Step 2: Sync object_index
      if (this.indexSynced) {
        const title = (this.payload.title as string) ?? null;
        const summary = (this.payload.summary as string) ?? (this.payload.statement as string) ?? (this.payload.description as string) ?? null;
        const status = (this.payload.status as string) ?? null;
        const origin = (this.payload.origin as string) ?? 'human';
        const layer = (this.payload.layer as string) ?? 'wiki';
        const visibility = (this.payload.visibility as string) ?? 'private';
        const sourceFileId = (this.payload.sourceFileId as string) ?? (this.payload.source_file_id as string) ?? null;

        this.db.run(
          `INSERT OR REPLACE INTO object_index
            (object_uid, object_type, object_id, canonical_table, layer, source_file_id, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            objectUid, type, objectId, table, layer, sourceFileId,
            title, summary, status, origin, visibility, versionToken,
            typePayload.created_at, now,
          ],
        );

        // Sync FTS
        this.db.run(
          `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
           VALUES (?, ?, ?, ?)`,
          [objectUid, title ?? '', summary ?? '', ''],
        );
      }

      // Step 3: Write links
      for (const link of this.pendingLinks) {
        const linkId = generateUlid();
        this.db.run(
          `INSERT OR REPLACE INTO links
            (link_id, source_uid, target_uid, relation_type, origin, source_channel, status, confidence, why_summary, context_json, weight, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            linkId,
            link.sourceUid,
            link.targetUid,
            link.relationType,
            link.origin,
            link.sourceChannel ?? null,
            link.status ?? 'active',
            link.confidence ?? null,
            link.whySummary ?? null,
            link.contextJson ?? null,
            link.weight ?? null,
            now,
            now,
          ],
        );
        linksCreated++;
      }

      // Step 4: Append events
      for (const evt of this.pendingEvents) {
        const eventId = generateUlid();
        this.db.run(
          `INSERT INTO events
            (event_id, stream_uid, event_type, actor_type, actor_id, causation_id, correlation_id, payload_json, occurred_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            evt.streamUid ?? objectUid,
            evt.eventType,
            evt.actorType,
            evt.actorId ?? null,
            evt.causationId ?? null,
            evt.correlationId ?? null,
            evt.payloadJson,
            now,
            now,
          ],
        );
        eventsAppended++;
      }
    });

    return { objectUid, versionToken, linksCreated, eventsAppended };
  }
}

export class SqliteWriteTransactionFactory implements WriteTransactionFactory {
  constructor(private readonly db: DatabasePort) {}

  create(): WriteTransaction {
    return new SqliteWriteTransaction(this.db);
  }
}
