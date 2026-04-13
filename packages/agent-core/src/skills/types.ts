// ---------------------------------------------------------------------------
// @orbit/agent-core – Skills Types (M12)
// ---------------------------------------------------------------------------

// ---- Skill status ----

export const SKILL_STATUSES = ['active', 'disabled', 'error'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

// ---- Skill source ----

/** How a skill was installed / discovered. */
export type SkillSource =
  | { readonly type: 'builtin' }
  | { readonly type: 'url'; readonly url: string; readonly fetchedAt: string }
  | { readonly type: 'local'; readonly path: string }
  | { readonly type: 'registry'; readonly packageName: string };

// ---- Skill definition ----

/** Full runtime representation of an installed skill. */
export interface SkillDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly author?: string
  readonly source: SkillSource
  /** System prompt / instructions injected when the skill is active. */
  readonly instructions: string
  /** Tool names this skill depends on. */
  readonly tools?: readonly string[]
  /** MCP server IDs this skill uses. */
  readonly mcpServers?: readonly string[]
  /** JSON Schema describing the skill's expected input. */
  readonly inputSchema?: Readonly<Record<string, unknown>>
  readonly tags: readonly string[]
  readonly installedAt: string
  readonly status: SkillStatus
}

// ---- Skill install input ----

/** Input for creating / installing a skill (before ID & timestamp are assigned). */
export interface SkillInstallInput {
  readonly name: string
  readonly description: string
  readonly version?: string
  readonly author?: string
  readonly instructions: string
  readonly tools?: readonly string[]
  readonly mcpServers?: readonly string[]
  readonly inputSchema?: Readonly<Record<string, unknown>>
  readonly tags?: readonly string[]
}

// ---- Skill resolve result ----

/** Result of resolving a skill definition from a URL. */
export interface SkillResolveResult {
  readonly success: boolean
  readonly skill?: SkillInstallInput
  readonly error?: string
  readonly sourceUrl: string
}

// ---- Skill Manager interface ----

/** Manages the lifecycle of installed skills. */
export interface SkillManager {
  listSkills(): readonly SkillDefinition[]
  getSkill(id: string): SkillDefinition | undefined
  installFromDefinition(input: SkillInstallInput, source: SkillSource): SkillDefinition
  installFromUrl(url: string): Promise<SkillDefinition>
  uninstall(id: string): boolean
  enableSkill(id: string): boolean
  disableSkill(id: string): boolean
  getSkillsByTag(tag: string): readonly SkillDefinition[]
  getActiveSkills(): readonly SkillDefinition[]
  resolveSkillsForAgent(skillIds: readonly string[]): readonly SkillDefinition[]
}
