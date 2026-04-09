export const SERVER_INFRA_DATA_POLICY = {
  acceptedData: ['ciphertext', 'metadata', 'notification'] as const,
  plaintextHandling: 'forbidden',
  description: '服务端基础设施只为密文、元数据与通知提供支撑，不处理用户明文。',
} as const;

export type ServerMetadata = Readonly<Record<string, string>>;
export type ServerIdPrefix = 'account' | 'device' | 'sync' | 'blob' | 'gdpr' | 'token' | 'notification';
export type ServerTokenScope = 'sync' | 'blob' | 'gdpr' | 'notification';

export interface ObjectStoragePort {
  putObject(input: {
    blobId: string;
    encryptedPayload: Uint8Array | string;
    contentType: string;
    checksum: string;
    sizeBytes: number;
    metadata: ServerMetadata;
  }): Promise<{ blobId: string; objectKey: string }>;
  getDownloadUrl(input: { blobId: string; expiresInSeconds: number }): Promise<{ url: string; expiresAt: Date }>;
  deleteObject(input: { blobId: string }): Promise<void>;
}

export interface NotificationFanoutPort {
  fanout(input: {
    accountId: string;
    deviceIds: readonly string[];
    topic: string;
    encryptedEnvelope: string;
    metadata: ServerMetadata;
  }): Promise<{ deliveryCount: number }>;
}

export interface TokenPort {
  mintDeviceToken(input: {
    accountId: string;
    deviceId: string;
    scope: ServerTokenScope;
    ttlSeconds: number;
  }): Promise<{ token: string; expiresAt: Date }>;
  verifyDeviceToken(input: { token: string }): Promise<{ accountId: string; deviceId: string; scope: ServerTokenScope }>;
}

export interface ClockPort {
  now(): Date;
}

export interface IdGeneratorPort {
  nextId(prefix: ServerIdPrefix): string;
}

export interface ServerInfraDeps {
  readonly objectStorage: ObjectStoragePort;
  readonly notificationFanout: NotificationFanoutPort;
  readonly tokenService: TokenPort;
  readonly clock: ClockPort;
  readonly idGenerator: IdGeneratorPort;
}

export interface IssueSyncCursorInput {
  readonly accountId: string;
  readonly version: number;
}

export interface IssueBlobLocatorInput {
  readonly blobId?: string;
}

export interface ServerInfraBundle extends ServerInfraDeps {
  readonly dataPolicy: typeof SERVER_INFRA_DATA_POLICY;
  issueSyncCursor(input: IssueSyncCursorInput): { cursor: string; issuedAt: Date };
  issueBlobLocator(input: IssueBlobLocatorInput): { blobId: string; uploadedAt: Date };
}

export function createServerInfraBundle(deps: ServerInfraDeps): ServerInfraBundle {
  return {
    ...deps,
    dataPolicy: SERVER_INFRA_DATA_POLICY,
    issueSyncCursor: (input) => ({
      cursor: `${input.accountId}:${input.version}:${deps.idGenerator.nextId('sync')}`,
      issuedAt: deps.clock.now(),
    }),
    issueBlobLocator: (input) => ({
      blobId: input.blobId ?? deps.idGenerator.nextId('blob'),
      uploadedAt: deps.clock.now(),
    }),
  };
}
