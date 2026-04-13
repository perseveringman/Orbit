import type { DatabasePort } from '@orbit/platform-contracts';
import type {
  LinkRepository,
  LinkRecord,
  LinkQueryFilter,
  WriteLinkInput,
} from '@orbit/data-protocol';
import type { ObjectUid } from '@orbit/domain';
import { generateUlid } from '@orbit/domain';
import { nowIso, keysToCamel } from './helpers.js';

function rowToLinkRecord(row: Record<string, unknown>): LinkRecord {
  const camel = keysToCamel(row);
  return {
    linkId: camel.linkId as string,
    sourceUid: camel.sourceUid as string,
    targetUid: camel.targetUid as string,
    relationType: camel.relationType as string,
    origin: camel.origin as LinkRecord['origin'],
    sourceChannel: (camel.sourceChannel as LinkRecord['sourceChannel']) ?? null,
    status: camel.status as LinkRecord['status'],
    confidence: (camel.confidence as number) ?? null,
    whySummary: (camel.whySummary as string) ?? null,
    contextJson: (camel.contextJson as string) ?? null,
    weight: (camel.weight as number) ?? null,
    createdAt: camel.createdAt as string,
    updatedAt: camel.updatedAt as string,
  } as LinkRecord;
}

export class SqliteLinkRepository implements LinkRepository {
  constructor(private readonly db: DatabasePort) {}

  async write(input: WriteLinkInput): Promise<LinkRecord> {
    const now = nowIso();
    const linkId = generateUlid();

    this.db.run(
      `INSERT OR REPLACE INTO links
        (link_id, source_uid, target_uid, relation_type, origin, source_channel, status, confidence, why_summary, context_json, weight, created_at, updated_at, deleted_flg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        linkId,
        input.sourceUid,
        input.targetUid,
        input.relationType,
        input.origin,
        input.sourceChannel ?? null,
        input.status ?? 'active',
        input.confidence ?? null,
        input.whySummary ?? null,
        input.contextJson ?? null,
        input.weight ?? null,
        now,
        now,
      ],
    );

    return {
      linkId,
      sourceUid: input.sourceUid,
      targetUid: input.targetUid,
      relationType: input.relationType,
      origin: input.origin,
      sourceChannel: input.sourceChannel ?? null,
      status: input.status ?? 'active',
      confidence: input.confidence ?? null,
      whySummary: input.whySummary ?? null,
      contextJson: input.contextJson ?? null,
      weight: input.weight ?? null,
      createdAt: now,
      updatedAt: now,
    } as LinkRecord;
  }

  async list(filter: LinkQueryFilter): Promise<LinkRecord[]> {
    const conditions: string[] = ['deleted_flg = 0'];
    const params: unknown[] = [];

    if (filter.relationType) {
      conditions.push('relation_type = ?');
      params.push(filter.relationType);
    }
    if (filter.origin) {
      conditions.push('origin = ?');
      params.push(filter.origin);
    }
    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    const limit = filter.limit ?? 50;
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM links ${where} ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.query<Record<string, unknown>>(sql, params);
    return rows.map(rowToLinkRecord);
  }

  async backlinks(
    targetUid: ObjectUid,
    filter?: LinkQueryFilter,
  ): Promise<LinkRecord[]> {
    const conditions: string[] = ['deleted_flg = 0', 'target_uid = ?'];
    const params: unknown[] = [targetUid];

    if (filter?.relationType) {
      conditions.push('relation_type = ?');
      params.push(filter.relationType);
    }
    if (filter?.origin) {
      conditions.push('origin = ?');
      params.push(filter.origin);
    }
    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    const limit = filter?.limit ?? 50;
    const where = `WHERE ${conditions.join(' AND ')}`;
    const sql = `SELECT * FROM links ${where} ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.query<Record<string, unknown>>(sql, params);
    return rows.map(rowToLinkRecord);
  }
}
