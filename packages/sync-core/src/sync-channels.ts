export type SyncChannel = 'object_lww' | 'document_merge' | 'blob_cas';

export type ConflictStrategy = 'last_write_wins' | 'three_way_merge' | 'content_addressed';

export interface SyncChannelConfig {
  readonly channel: SyncChannel;
  readonly description: string;
  readonly conflictStrategy: ConflictStrategy;
  readonly supportsOffline: boolean;
}

const CHANNEL_CONFIGS: Record<SyncChannel, SyncChannelConfig> = {
  object_lww: {
    channel: 'object_lww',
    description: 'Object-level last-write-wins sync for simple key-value data',
    conflictStrategy: 'last_write_wins',
    supportsOffline: true,
  },
  document_merge: {
    channel: 'document_merge',
    description: 'Document-level three-way merge for long-form text content',
    conflictStrategy: 'three_way_merge',
    supportsOffline: true,
  },
  blob_cas: {
    channel: 'blob_cas',
    description: 'Content-addressed storage for binary blobs',
    conflictStrategy: 'content_addressed',
    supportsOffline: false,
  },
};

const OBJECT_TYPE_CHANNEL_MAP: Record<string, SyncChannel> = {
  article: 'document_merge',
  document: 'document_merge',
  note: 'document_merge',
  blob: 'blob_cas',
  attachment: 'blob_cas',
  image: 'blob_cas',
};

export function getChannelConfig(channel: SyncChannel): SyncChannelConfig {
  return CHANNEL_CONFIGS[channel];
}

export function detectChannel(objectType: string): SyncChannel {
  return OBJECT_TYPE_CHANNEL_MAP[objectType] ?? 'object_lww';
}
