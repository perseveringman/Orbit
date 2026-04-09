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
  type RuntimeAdapter
} from '@orbit/platform-contracts';

export interface WebRuntimeAdapterOptions {
  authSession?: AuthSession | null;
  capabilities?: Iterable<PlatformCapability>;
  ports?: Partial<Omit<PlatformPorts, 'capabilityHost'>>;
}

const 默认能力: PlatformCapability[] = [
  'database',
  'sync',
  'notification',
  'auth',
  'secure-store'
];

export function createWebRuntimeAdapter(
  options: WebRuntimeAdapterOptions = {}
): RuntimeAdapter {
  const capabilityHost = createCapabilityHost(options.capabilities ?? 默认能力);
  const secureStore =
    options.ports?.secureStore ?? createInMemorySecureStore();

  const ports: PlatformPorts = {
    workspace: options.ports?.workspace ?? createStaticWorkspacePort(null),
    database: options.ports?.database ?? createStaticDatabasePort('indexeddb'),
    sync: options.ports?.sync ?? createStaticSyncPort(),
    capabilityHost,
    notification:
      options.ports?.notification ?? createNoopNotificationPort(),
    auth: options.ports?.auth ?? createMemoryAuthPort(options.authSession ?? null),
    secureStore
  };

  return {
    platform: 'web',
    capabilityHost,
    ports
  };
}
