export type PlatformKind = 'electron' | 'web' | 'ios' | 'test';

export type PlatformCapability =
  | 'workspace'
  | 'database'
  | 'sync'
  | 'notification'
  | 'auth'
  | 'secure-store';

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  rootUri: string;
}

export interface DatabaseConnection {
  driver: string;
  connectedAt: string;
}

export interface SyncStatus {
  phase: 'idle' | 'running';
  updatedAt: string;
}

export interface SyncResult {
  status: 'idle' | 'synced';
  updatedRecords: number;
}

export interface NotificationPayload {
  title: string;
  body?: string;
  tag?: string;
}

export interface AuthSession {
  userId: string;
  accessToken?: string;
}

export interface WorkspacePort {
  getCurrent(): Promise<WorkspaceSnapshot | null>;
  openResource(resourceUri: string): Promise<void>;
}

export interface DatabasePort {
  connect(): Promise<DatabaseConnection>;
  close(): Promise<void>;
}

export interface SyncPort {
  getStatus(): Promise<SyncStatus>;
  syncNow(): Promise<SyncResult>;
}

export interface CapabilityHostPort {
  has(capability: PlatformCapability): boolean;
  list(): PlatformCapability[];
}

export interface NotificationPort {
  notify(payload: NotificationPayload): Promise<void>;
}

export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  signIn(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

export interface SecureStorePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PlatformPorts {
  workspace: WorkspacePort;
  database: DatabasePort;
  sync: SyncPort;
  capabilityHost: CapabilityHostPort;
  notification: NotificationPort;
  auth: AuthPort;
  secureStore: SecureStorePort;
}

export interface RuntimeAdapter {
  platform: PlatformKind;
  capabilityHost: CapabilityHostPort;
  ports: PlatformPorts;
}

export function createCapabilityHost(
  capabilities: Iterable<PlatformCapability>
): CapabilityHostPort {
  const capabilitySet = new Set(capabilities);

  return {
    has(capability) {
      return capabilitySet.has(capability);
    },
    list() {
      return [...capabilitySet.values()];
    }
  };
}

export function createInMemorySecureStore(
  seed: Record<string, string> = {}
): SecureStorePort {
  const storage = new Map(Object.entries(seed));

  return {
    async get(key) {
      return storage.get(key) ?? null;
    },
    async set(key, value) {
      storage.set(key, value);
    },
    async remove(key) {
      storage.delete(key);
    }
  };
}

export function createNoopNotificationPort(): NotificationPort {
  return {
    async notify() {
      return undefined;
    }
  };
}

export function createStaticWorkspacePort(
  snapshot: WorkspaceSnapshot | null = null
): WorkspacePort {
  return {
    async getCurrent() {
      return snapshot;
    },
    async openResource() {
      return undefined;
    }
  };
}

export function createStaticDatabasePort(driver = 'memory'): DatabasePort {
  return {
    async connect() {
      return {
        driver,
        connectedAt: new Date(0).toISOString()
      };
    },
    async close() {
      return undefined;
    }
  };
}

export function createStaticSyncPort(): SyncPort {
  return {
    async getStatus() {
      return {
        phase: 'idle',
        updatedAt: new Date(0).toISOString()
      };
    },
    async syncNow() {
      return {
        status: 'synced',
        updatedRecords: 0
      };
    }
  };
}

export function createMemoryAuthPort(
  session: AuthSession | null = null
): AuthPort {
  let currentSession = session;

  return {
    async getSession() {
      return currentSession;
    },
    async signIn() {
      return currentSession;
    },
    async signOut() {
      currentSession = null;
    }
  };
}
