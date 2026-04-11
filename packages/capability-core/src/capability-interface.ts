// ---------------------------------------------------------------------------
// @orbit/capability-core – Full Capability Interface (Wave 2-C)
// ---------------------------------------------------------------------------

export type ExposureLevel = 'internal' | 'local' | 'external';
export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3';
export type ApprovalLevel = 'A0' | 'A1' | 'A2' | 'A3';
export type DataBoundary = 'local' | 'workspace' | 'external';
export type EgressPolicy = 'none' | 'metadata_only' | 'content_hash' | 'full_content';

export type CapabilityDomain =
  | 'workspace_query'
  | 'content_capture'
  | 'research'
  | 'writing'
  | 'planning'
  | 'graph'
  | 'integration'
  | 'sensitive';

export interface CapabilityDefinition {
  readonly id: string;
  readonly version: string;
  readonly domain: CapabilityDomain;
  readonly kind: string;
  readonly exposure: ExposureLevel;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly risk: RiskLevel;
  readonly approval: ApprovalLevel;
  readonly audit: boolean;
  readonly egress: EgressPolicy;
  readonly description: string;
  readonly displayName: string;
}
