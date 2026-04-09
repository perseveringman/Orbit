import {
  createCapabilityHost,
  createInMemorySecureStore,
  createMemoryAuthPort,
  createStaticDatabasePort,
  createStaticSyncPort,
  createStaticWorkspacePort,
  type AuthSession,
  type NotificationPayload,
  type PlatformCapability,
  type PlatformKind,
  type PlatformPorts,
  type RuntimeAdapter,
  type WorkspaceSnapshot
} from '@orbit/platform-contracts';

export interface PlatformFixtureOptions {
  platform?: PlatformKind;
  capabilities?: Iterable<PlatformCapability>;
  workspace?: WorkspaceSnapshot | null;
  authSession?: AuthSession | null;
  secureStoreSeed?: Record<string, string>;
}

export interface PlatformFixture {
  adapter: RuntimeAdapter;
  capabilityHost: RuntimeAdapter['capabilityHost'];
  ports: PlatformPorts;
  events: {
    notifications: NotificationPayload[];
  };
}

export function buildWorkspaceSnapshot(
  overrides: Partial<WorkspaceSnapshot> = {}
): WorkspaceSnapshot {
  return {
    id: overrides.id ?? 'workspace-test',
    name: overrides.name ?? 'Orbit 测试工作区',
    rootUri: overrides.rootUri ?? 'memory://workspace-test'
  };
}

export function buildAuthSession(
  overrides: Partial<AuthSession> = {}
): AuthSession {
  return {
    userId: overrides.userId ?? 'user-test',
    accessToken: overrides.accessToken ?? 'token-test'
  };
}

export function createPlatformFixture(
  options: PlatformFixtureOptions = {}
): PlatformFixture {
  const notifications: NotificationPayload[] = [];
  const capabilityHost = createCapabilityHost(options.capabilities ?? []);
  const secureStore = createInMemorySecureStore(options.secureStoreSeed ?? {});

  const ports: PlatformPorts = {
    workspace:
      createStaticWorkspacePort(options.workspace ?? buildWorkspaceSnapshot()),
    database: createStaticDatabasePort('memory'),
    sync: createStaticSyncPort(),
    capabilityHost,
    notification: {
      async notify(payload) {
        notifications.push(payload);
      }
    },
    auth: createMemoryAuthPort(options.authSession ?? buildAuthSession()),
    secureStore
  };

  const adapter: RuntimeAdapter = {
    platform: options.platform ?? 'test',
    capabilityHost,
    ports
  };

  return {
    adapter,
    capabilityHost,
    ports,
    events: {
      notifications
    }
  };
}
