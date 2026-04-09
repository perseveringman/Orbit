export const CAPABILITY_KINDS = ['search', 'sync', 'import', 'export', 'agent'] as const;
export const CAPABILITY_RESOURCES = ['workspace', 'article', 'blob', 'network', 'settings'] as const;
export const CAPABILITY_ACCESSES = ['read', 'write', 'admin'] as const;

export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];
export type CapabilityResource = (typeof CAPABILITY_RESOURCES)[number];
export type CapabilityAccess = (typeof CAPABILITY_ACCESSES)[number];

export interface CapabilityPermission {
  readonly resource: CapabilityResource;
  readonly access: CapabilityAccess;
}

export interface CapabilityManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: CapabilityKind;
  readonly description: string;
  readonly permissions: readonly CapabilityPermission[];
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
}

export function capabilityKey(manifest: Pick<CapabilityManifest, 'id' | 'version'>): string {
  return `${manifest.id}@${manifest.version}`;
}

export function supportsPermission(
  manifest: Pick<CapabilityManifest, 'permissions'>,
  resource: CapabilityResource,
  access: CapabilityAccess,
): boolean {
  return manifest.permissions.some((permission) => permission.resource === resource && permission.access === access);
}
