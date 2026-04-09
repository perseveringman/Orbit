export const SERVER_CORE_BOUNDARY = {
  acceptedPayloads: ['ciphertext', 'metadata', 'notification'] as const,
  plaintextHandling: 'forbidden',
  description: '服务端只处理密文、元数据与通知，不处理用户明文。',
} as const;

export type ServerMetadata = Readonly<Record<string, string>>;

export interface CiphertextBoundaryInput {
  readonly ciphertext: string;
  readonly metadata: ServerMetadata;
  readonly plaintext?: unknown;
}

export function assertServerCiphertextBoundary(input: CiphertextBoundaryInput): void {
  if (input.plaintext !== undefined) {
    throw new Error('服务端不处理用户明文。');
  }

  if (input.ciphertext.trim().length === 0) {
    throw new Error('服务端只接受密文载荷。');
  }
}

export interface ProvisionAccountInput {
  readonly externalAccountId: string;
  readonly initialDeviceId: string;
  readonly encryptedAccountEnvelope: string;
  readonly metadata: ServerMetadata;
}

export interface RevokeAccountInput {
  readonly accountId: string;
  readonly reason: 'user-request' | 'admin-request';
}

export interface RegisterDeviceInput {
  readonly accountId: string;
  readonly deviceId: string;
  readonly encryptedDeviceEnvelope: string;
  readonly metadata: ServerMetadata;
}

export interface RevokeDeviceInput {
  readonly accountId: string;
  readonly deviceId: string;
  readonly reason: 'device-lost' | 'user-request' | 'admin-request';
}

export interface CommitMutationInput {
  readonly accountId: string;
  readonly deviceId: string;
  readonly mutationId: string;
  readonly encryptedMutation: string;
  readonly metadata: ServerMetadata;
}

export interface PullEventsInput {
  readonly accountId: string;
  readonly deviceId: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface EncryptedSyncEvent {
  readonly eventId: string;
  readonly encryptedEnvelope: string;
  readonly metadata: ServerMetadata;
}

export interface CreateBlobReservationInput {
  readonly accountId: string;
  readonly deviceId: string;
  readonly blobId: string;
  readonly encryptedBlobDescriptor: string;
  readonly metadata: ServerMetadata;
}

export interface CompleteBlobUploadInput {
  readonly accountId: string;
  readonly deviceId: string;
  readonly blobId: string;
  readonly checksum: string;
  readonly metadata: ServerMetadata;
}

export interface RequestGdprExportInput {
  readonly accountId: string;
  readonly requestedByDeviceId: string;
  readonly metadata: ServerMetadata;
}

export interface RequestGdprDeletionInput {
  readonly accountId: string;
  readonly requestedByDeviceId: string;
  readonly metadata: ServerMetadata;
}

export interface AccountUseCasePort {
  provisionAccount(input: ProvisionAccountInput): Promise<{ accountId: string; createdAt: Date }>;
  revokeAccount(input: RevokeAccountInput): Promise<{ accountId: string; revokedAt: Date }>;
}

export interface DeviceUseCasePort {
  registerDevice(input: RegisterDeviceInput): Promise<{ deviceId: string; registeredAt: Date }>;
  revokeDevice(input: RevokeDeviceInput): Promise<{ deviceId: string; revokedAt: Date }>;
}

export interface SyncUseCasePort {
  commitMutation(input: CommitMutationInput): Promise<{ mutationId: string; acceptedAt: Date }>;
  pullEvents(input: PullEventsInput): Promise<{ events: readonly EncryptedSyncEvent[]; nextCursor?: string }>;
}

export interface BlobUseCasePort {
  createReservation(input: CreateBlobReservationInput): Promise<{ blobId: string; uploadUrl: string }>;
  completeUpload(input: CompleteBlobUploadInput): Promise<{ blobId: string; completedAt: Date }>;
}

export interface GdprUseCasePort {
  requestExport(input: RequestGdprExportInput): Promise<{ requestId: string; acceptedAt: Date }>;
  requestDeletion(input: RequestGdprDeletionInput): Promise<{ requestId: string; acceptedAt: Date }>;
}

export interface ServerUseCasePorts {
  readonly accounts: AccountUseCasePort;
  readonly devices: DeviceUseCasePort;
  readonly sync: SyncUseCasePort;
  readonly blobs: BlobUseCasePort;
  readonly gdpr: GdprUseCasePort;
}

export interface ServerCoreOrchestrator extends ServerUseCasePorts {
  readonly boundary: typeof SERVER_CORE_BOUNDARY;
  describeBoundary(): string;
  listCapabilities(): readonly string[];
}

export function createServerCoreOrchestrator(ports: ServerUseCasePorts): ServerCoreOrchestrator {
  return {
    boundary: SERVER_CORE_BOUNDARY,
    describeBoundary: () => SERVER_CORE_BOUNDARY.description,
    listCapabilities: () => ['accounts', 'devices', 'sync', 'blobs', 'gdpr'] as const,
    accounts: {
      provisionAccount: async (input) => {
        assertServerCiphertextBoundary({
          ciphertext: input.encryptedAccountEnvelope,
          metadata: input.metadata,
        });
        return ports.accounts.provisionAccount(input);
      },
      revokeAccount: (input) => ports.accounts.revokeAccount(input),
    },
    devices: {
      registerDevice: async (input) => {
        assertServerCiphertextBoundary({
          ciphertext: input.encryptedDeviceEnvelope,
          metadata: input.metadata,
        });
        return ports.devices.registerDevice(input);
      },
      revokeDevice: (input) => ports.devices.revokeDevice(input),
    },
    sync: {
      commitMutation: async (input) => {
        assertServerCiphertextBoundary({
          ciphertext: input.encryptedMutation,
          metadata: input.metadata,
        });
        return ports.sync.commitMutation(input);
      },
      pullEvents: (input) => ports.sync.pullEvents(input),
    },
    blobs: {
      createReservation: async (input) => {
        assertServerCiphertextBoundary({
          ciphertext: input.encryptedBlobDescriptor,
          metadata: input.metadata,
        });
        return ports.blobs.createReservation(input);
      },
      completeUpload: (input) => ports.blobs.completeUpload(input),
    },
    gdpr: {
      requestExport: (input) => ports.gdpr.requestExport(input),
      requestDeletion: (input) => ports.gdpr.requestDeletion(input),
    },
  };
}
