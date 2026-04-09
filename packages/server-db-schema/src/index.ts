export const SERVER_DATA_POLICY = {
  acceptedData: ['ciphertext', 'metadata', 'notification'] as const,
  plaintextHandling: 'forbidden',
  description: '服务端数据库只保存密文索引、元数据与通知状态，不处理用户明文。',
} as const;

export type ServerMetadataScalar = string | number | boolean | null | Date;
export type ServerColumnDataType = 'uuid' | 'text' | 'timestamptz' | 'jsonb' | 'integer' | 'boolean';

export interface ServerColumnDefinition<TDataType extends ServerColumnDataType = ServerColumnDataType> {
  readonly name: string;
  readonly dataType: TDataType;
  readonly nullable: boolean;
  readonly description: string;
  readonly plaintextAllowed: false;
}

export interface ServerIndexDefinition<TColumnName extends string = string> {
  readonly name: string;
  readonly columns: readonly TColumnName[];
  readonly unique?: boolean;
  readonly purpose: string;
}

export interface ServerTableDefinition<
  TColumns extends Record<string, ServerColumnDefinition> = Record<string, ServerColumnDefinition>,
> {
  readonly schema: 'server';
  readonly name: string;
  readonly description: string;
  readonly plaintextAllowed: false;
  readonly primaryKey: readonly (keyof TColumns & string)[];
  readonly columns: TColumns;
  readonly indexes: readonly ServerIndexDefinition<keyof TColumns & string>[];
}

function defineColumn<TDataType extends ServerColumnDataType>(
  definition: Omit<ServerColumnDefinition<TDataType>, 'plaintextAllowed'>,
): ServerColumnDefinition<TDataType> {
  return {
    ...definition,
    plaintextAllowed: false,
  };
}

function defineTable<TColumns extends Record<string, ServerColumnDefinition>>(
  definition: Omit<ServerTableDefinition<TColumns>, 'schema' | 'plaintextAllowed'>,
): ServerTableDefinition<TColumns> {
  return {
    ...definition,
    schema: 'server',
    plaintextAllowed: false,
  };
}

export const SERVER_ACCOUNTS_TABLE = defineTable({
  name: 'server_accounts',
  description: '账号主记录，仅保存账号标识、设备基线与加密元数据摘要。',
  primaryKey: ['accountId'],
  columns: {
    accountId: defineColumn({ name: 'account_id', dataType: 'uuid', nullable: false, description: '账号主键。' }),
    externalSubject: defineColumn({ name: 'external_subject', dataType: 'text', nullable: false, description: '外部身份提供方主体标识。' }),
    encryptedProfileRef: defineColumn({ name: 'encrypted_profile_ref', dataType: 'text', nullable: false, description: '密文资料引用，不含用户明文。' }),
    metadata: defineColumn({ name: 'metadata', dataType: 'jsonb', nullable: false, description: '服务端可见元数据。' }),
    createdAt: defineColumn({ name: 'created_at', dataType: 'timestamptz', nullable: false, description: '创建时间。' }),
    revokedAt: defineColumn({ name: 'revoked_at', dataType: 'timestamptz', nullable: true, description: '撤销时间。' }),
  },
  indexes: [
    { name: 'server_accounts_external_subject_uidx', columns: ['externalSubject'], unique: true, purpose: '按外部身份快速定位账号。' },
  ],
});

export const SERVER_DEVICES_TABLE = defineTable({
  name: 'server_devices',
  description: '设备注册表，仅保存设备身份、能力摘要与通知路由信息。',
  primaryKey: ['deviceId'],
  columns: {
    deviceId: defineColumn({ name: 'device_id', dataType: 'uuid', nullable: false, description: '设备主键。' }),
    accountId: defineColumn({ name: 'account_id', dataType: 'uuid', nullable: false, description: '所属账号。' }),
    encryptedDeviceRef: defineColumn({ name: 'encrypted_device_ref', dataType: 'text', nullable: false, description: '设备密文描述引用。' }),
    notificationTopic: defineColumn({ name: 'notification_topic', dataType: 'text', nullable: false, description: '通知 fanout 主题。' }),
    lastSeenAt: defineColumn({ name: 'last_seen_at', dataType: 'timestamptz', nullable: true, description: '最后活跃时间。' }),
    metadata: defineColumn({ name: 'metadata', dataType: 'jsonb', nullable: false, description: '设备元数据。' }),
  },
  indexes: [
    { name: 'server_devices_account_idx', columns: ['accountId'], purpose: '按账号聚合设备。' },
  ],
});

export const SERVER_SYNC_SESSIONS_TABLE = defineTable({
  name: 'server_sync_sessions',
  description: '同步会话游标与提交元数据，不存放用户明文内容。',
  primaryKey: ['sessionId'],
  columns: {
    sessionId: defineColumn({ name: 'session_id', dataType: 'uuid', nullable: false, description: '同步会话主键。' }),
    accountId: defineColumn({ name: 'account_id', dataType: 'uuid', nullable: false, description: '所属账号。' }),
    deviceId: defineColumn({ name: 'device_id', dataType: 'uuid', nullable: false, description: '发起同步的设备。' }),
    cursor: defineColumn({ name: 'cursor', dataType: 'text', nullable: false, description: '服务端同步游标。' }),
    encryptedMutationRef: defineColumn({ name: 'encrypted_mutation_ref', dataType: 'text', nullable: true, description: '密文变更批次引用。' }),
    committedAt: defineColumn({ name: 'committed_at', dataType: 'timestamptz', nullable: false, description: '提交时间。' }),
    metadata: defineColumn({ name: 'metadata', dataType: 'jsonb', nullable: false, description: '同步元数据。' }),
  },
  indexes: [
    { name: 'server_sync_sessions_account_cursor_idx', columns: ['accountId', 'cursor'], purpose: '按账号与游标拉取增量同步。' },
  ],
});

export const SERVER_BLOBS_TABLE = defineTable({
  name: 'server_blobs',
  description: '密文 blob 清单，保存对象存储定位、校验与生命周期状态。',
  primaryKey: ['blobId'],
  columns: {
    blobId: defineColumn({ name: 'blob_id', dataType: 'uuid', nullable: false, description: 'blob 主键。' }),
    accountId: defineColumn({ name: 'account_id', dataType: 'uuid', nullable: false, description: '所属账号。' }),
    storageKey: defineColumn({ name: 'storage_key', dataType: 'text', nullable: false, description: '对象存储键。' }),
    checksum: defineColumn({ name: 'checksum', dataType: 'text', nullable: false, description: '密文文件校验和。' }),
    sizeBytes: defineColumn({ name: 'size_bytes', dataType: 'integer', nullable: false, description: '字节大小。' }),
    uploadedAt: defineColumn({ name: 'uploaded_at', dataType: 'timestamptz', nullable: true, description: '上传完成时间。' }),
    metadata: defineColumn({ name: 'metadata', dataType: 'jsonb', nullable: false, description: 'blob 元数据。' }),
  },
  indexes: [
    { name: 'server_blobs_account_idx', columns: ['accountId'], purpose: '按账号管理 blob 生命周期。' },
  ],
});

export const SERVER_GDPR_REQUESTS_TABLE = defineTable({
  name: 'server_gdpr_requests',
  description: 'GDPR 请求队列表，跟踪导出与删除流程状态。',
  primaryKey: ['requestId'],
  columns: {
    requestId: defineColumn({ name: 'request_id', dataType: 'uuid', nullable: false, description: '请求主键。' }),
    accountId: defineColumn({ name: 'account_id', dataType: 'uuid', nullable: false, description: '所属账号。' }),
    requestType: defineColumn({ name: 'request_type', dataType: 'text', nullable: false, description: '导出或删除。' }),
    status: defineColumn({ name: 'status', dataType: 'text', nullable: false, description: '请求状态。' }),
    encryptedArchiveRef: defineColumn({ name: 'encrypted_archive_ref', dataType: 'text', nullable: true, description: '导出档案的密文引用。' }),
    requestedAt: defineColumn({ name: 'requested_at', dataType: 'timestamptz', nullable: false, description: '请求时间。' }),
    fulfilledAt: defineColumn({ name: 'fulfilled_at', dataType: 'timestamptz', nullable: true, description: '完成时间。' }),
  },
  indexes: [
    { name: 'server_gdpr_requests_account_status_idx', columns: ['accountId', 'status'], purpose: '按账号查看 GDPR 请求执行进度。' },
  ],
});

export const SERVER_NOTIFICATION_OUTBOX_TABLE = defineTable({
  name: 'server_notification_outbox',
  description: '通知扇出队列表，仅记录通知载荷摘要、目标与投递状态。',
  primaryKey: ['notificationId'],
  columns: {
    notificationId: defineColumn({ name: 'notification_id', dataType: 'uuid', nullable: false, description: '通知主键。' }),
    accountId: defineColumn({ name: 'account_id', dataType: 'uuid', nullable: false, description: '所属账号。' }),
    deviceId: defineColumn({ name: 'device_id', dataType: 'uuid', nullable: true, description: '目标设备，可为空表示广播。' }),
    topic: defineColumn({ name: 'topic', dataType: 'text', nullable: false, description: '通知主题。' }),
    encryptedEnvelopeRef: defineColumn({ name: 'encrypted_envelope_ref', dataType: 'text', nullable: false, description: '通知密文引用。' }),
    deliveryState: defineColumn({ name: 'delivery_state', dataType: 'text', nullable: false, description: '投递状态。' }),
    createdAt: defineColumn({ name: 'created_at', dataType: 'timestamptz', nullable: false, description: '创建时间。' }),
  },
  indexes: [
    { name: 'server_notification_outbox_account_topic_idx', columns: ['accountId', 'topic'], purpose: '按账号与主题批量投递通知。' },
  ],
});

export const SERVER_METADATA_TABLES = {
  accounts: SERVER_ACCOUNTS_TABLE,
  devices: SERVER_DEVICES_TABLE,
  syncSessions: SERVER_SYNC_SESSIONS_TABLE,
  blobs: SERVER_BLOBS_TABLE,
  gdprRequests: SERVER_GDPR_REQUESTS_TABLE,
  notificationOutbox: SERVER_NOTIFICATION_OUTBOX_TABLE,
} as const;

export type ServerMetadataTableKey = keyof typeof SERVER_METADATA_TABLES;
export type ServerMetadataTableName = (typeof SERVER_METADATA_TABLES)[ServerMetadataTableKey]['name'];

export type ServerMetadataRecordMap = {
  [TTableKey in ServerMetadataTableKey]: {
    [TColumnKey in keyof (typeof SERVER_METADATA_TABLES)[TTableKey]['columns']]: ServerMetadataScalar;
  };
};

export function listServerMetadataTableNames(): ServerMetadataTableName[] {
  return Object.values(SERVER_METADATA_TABLES).map((table) => table.name);
}
