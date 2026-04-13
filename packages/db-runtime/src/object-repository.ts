import type { DatabasePort } from '@orbit/platform-contracts';
import type {
  ObjectRepository,
  ObjectQueryFilter,
  ObjectQueryResult,
  ObjectRecord,
} from '@orbit/data-protocol';
import { createCursor, parseCursor } from '@orbit/data-protocol';
import { generateUlid, createObjectUid, parseObjectUid } from '@orbit/domain';
import type { ObjectUid, OrbitObjectType } from '@orbit/domain';
import { getTableForType, nowIso, keysToCamel, camelToSnake } from './helpers.js';

function rowToObjectRecord(row: Record<string, unknown>): ObjectRecord {
  const camel = keysToCamel(row);
  return {
    objectUid: camel.objectUid as string,
    objectType: camel.objectType as string,
    objectId: camel.objectId as string,
    canonicalTable: camel.canonicalTable as string,
    layer: camel.layer as ObjectRecord['layer'],
    sourceFileId: (camel.sourceFileId as string) ?? null,
    title: (camel.title as string) ?? null,
    summary: (camel.summary as string) ?? null,
    status: (camel.status as string) ?? null,
    origin: camel.origin as ObjectRecord['origin'],
    visibility: camel.visibility as string,
    versionToken: camel.versionToken as string,
    createdAt: camel.createdAt as string,
    updatedAt: camel.updatedAt as string,
    deletedFlg: (camel.deletedFlg as number) === 1,
  } as ObjectRecord;
}

export class SqliteObjectRepository implements ObjectRepository {
  constructor(private readonly db: DatabasePort) {}

  async query(filter: ObjectQueryFilter): Promise<ObjectQueryResult> {
    const conditions: string[] = ['deleted_flg = 0'];
    const params: unknown[] = [];

    if (filter.objectType) {
      conditions.push('object_type = ?');
      params.push(filter.objectType);
    }
    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter.origin) {
      conditions.push('origin = ?');
      params.push(filter.origin);
    }
    if (filter.layer) {
      conditions.push('layer = ?');
      params.push(filter.layer);
    }
    if (filter.updatedSince) {
      conditions.push('updated_at > ?');
      params.push(filter.updatedSince);
    }

    if (filter.cursor) {
      const parsed = parseCursor(filter.cursor);
      if (parsed) {
        conditions.push('(updated_at < ? OR (updated_at = ? AND object_uid < ?))');
        params.push(parsed.updatedAt, parsed.updatedAt, parsed.id);
      }
    }

    const limit = filter.limit ?? 50;
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM object_index ${where} ORDER BY updated_at DESC, object_uid DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = this.db.query<Record<string, unknown>>(sql, params);

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(rowToObjectRecord);

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = createCursor(last.updatedAt, last.objectUid);
    }

    // Total hint via COUNT when no cursor
    let totalHint: number | null = null;
    if (!filter.cursor) {
      const countSql = `SELECT COUNT(*) as cnt FROM object_index ${where}`;
      const countParams = params.slice(0, -1); // remove limit param
      const countRows = this.db.query<{ cnt: number }>(countSql, countParams);
      totalHint = countRows[0]?.cnt ?? null;
    }

    return { items, nextCursor, totalHint };
  }

  async read(objectUid: ObjectUid): Promise<ObjectRecord | null> {
    const rows = this.db.query<Record<string, unknown>>(
      'SELECT * FROM object_index WHERE object_uid = ?',
      [objectUid],
    );
    if (rows.length === 0) return null;
    return rowToObjectRecord(rows[0]!);
  }

  async write(type: string, payload: Record<string, unknown>): Promise<ObjectRecord> {
    const table = getTableForType(type);
    const now = nowIso();
    const objectId = (payload.id as string) ?? generateUlid();
    const objectUid = createObjectUid(type as OrbitObjectType, objectId);
    const versionToken = generateUlid();

    // Build type-table columns from payload
    const typePayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
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

    // Sync to object_index
    const title = (payload.title as string) ?? null;
    const summary = (payload.summary as string) ?? (payload.statement as string) ?? (payload.description as string) ?? null;
    const status = (payload.status as string) ?? null;
    const origin = (payload.origin as string) ?? 'human';
    const layer = (payload.layer as string) ?? 'wiki';
    const visibility = (payload.visibility as string) ?? 'private';
    const sourceFileId = (payload.sourceFileId as string) ?? (payload.source_file_id as string) ?? null;

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

    return {
      objectUid,
      objectType: type,
      objectId,
      canonicalTable: table,
      layer: layer as ObjectRecord['layer'],
      sourceFileId,
      title,
      summary,
      status,
      origin: origin as ObjectRecord['origin'],
      visibility,
      versionToken,
      createdAt: typePayload.created_at as string,
      updatedAt: now,
      deletedFlg: false,
    } as ObjectRecord;
  }

  async delete(objectUid: ObjectUid): Promise<void> {
    const parsed = parseObjectUid(objectUid as string);
    if (!parsed) throw new Error(`Invalid object UID: ${objectUid}`);

    const table = getTableForType(parsed.type);
    const now = nowIso();

    this.db.run(`UPDATE ${table} SET deleted_flg = 1, updated_at = ? WHERE id = ?`, [
      now,
      parsed.id,
    ]);
    this.db.run(
      'UPDATE object_index SET deleted_flg = 1, updated_at = ? WHERE object_uid = ?',
      [now, objectUid],
    );
  }
}
