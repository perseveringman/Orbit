import {
  createCapabilityHost,
  createInMemorySecureStore,
  createMemoryAuthPort,
  createNoopNotificationPort,
  createStaticDatabasePort,
  createStaticSyncPort,
  createStaticWorkspacePort,
  type AuthSession,
  type PlatformCapability,
  type PlatformPorts,
  type RuntimeAdapter,
  type WorkspaceSnapshot
} from '@orbit/platform-contracts';

export interface ElectronRuntimeAdapterOptions {
  workspace?: WorkspaceSnapshot | null;
  authSession?: AuthSession | null;
  capabilities?: Iterable<PlatformCapability>;
  ports?: Partial<Omit<PlatformPorts, 'capabilityHost'>>;
}

const 默认能力: PlatformCapability[] = [
  'workspace',
  'database',
  'sync',
  'notification',
  'auth',
  'secure-store'
];

export function createElectronRuntimeAdapter(
  options: ElectronRuntimeAdapterOptions = {}
): RuntimeAdapter {
  const capabilityHost = createCapabilityHost(options.capabilities ?? 默认能力);
  const secureStore =
    options.ports?.secureStore ?? createInMemorySecureStore();

  const ports: PlatformPorts = {
    workspace:
      options.ports?.workspace ??
      createStaticWorkspacePort(
        options.workspace ?? {
          id: 'desktop-workspace',
          name: 'Orbit 桌面工作区',
          rootUri: 'file:///orbit'
        }
      ),
    database: options.ports?.database ?? createStaticDatabasePort('sqlite'),
    sync: options.ports?.sync ?? createStaticSyncPort(),
    capabilityHost,
    notification:
      options.ports?.notification ?? createNoopNotificationPort(),
    auth: options.ports?.auth ?? createMemoryAuthPort(options.authSession ?? null),
    secureStore
  };

  return {
    platform: 'electron',
    capabilityHost,
    ports
  };
}
