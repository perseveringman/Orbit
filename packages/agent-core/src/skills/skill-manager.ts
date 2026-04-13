// ---------------------------------------------------------------------------
// @orbit/agent-core – Skill Manager (M12)
//
// Manages skill lifecycle: install, uninstall, enable/disable, resolution.
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { SkillDefinition, SkillInstallInput, SkillManager, SkillSource } from './types.js';
import type { SkillResolver } from './skill-resolver.js';
import { loadBuiltinSkills } from './builtin-skills.js';

// ---- Implementation ----

export class SkillManagerImpl implements SkillManager {
  private readonly skills = new Map<string, SkillDefinition>();
  private readonly resolver?: SkillResolver;

  constructor(resolver?: SkillResolver) {
    this.resolver = resolver;
  }

  listSkills(): readonly SkillDefinition[] {
    return [...this.skills.values()];
  }

  getSkill(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  installFromDefinition(input: SkillInstallInput, source: SkillSource): SkillDefinition {
    const skill: SkillDefinition = {
      id: generateId('skill'),
      name: input.name,
      description: input.description,
      version: input.version ?? '0.0.0',
      author: input.author,
      source,
      instructions: input.instructions,
      tools: input.tools,
      mcpServers: input.mcpServers,
      inputSchema: input.inputSchema,
      tags: input.tags ?? [],
      installedAt: new Date().toISOString(),
      status: 'active',
    };

    this.skills.set(skill.id, skill);
    return skill;
  }

  async installFromUrl(url: string): Promise<SkillDefinition> {
    if (!this.resolver) {
      throw new Error('No SkillResolver configured — cannot install from URL.');
    }

    const result = await this.resolver.resolve(url);

    if (!result.success || !result.skill) {
      throw new Error(result.error ?? 'Failed to resolve skill from URL.');
    }

    const source: SkillSource = {
      type: 'url',
      url,
      fetchedAt: new Date().toISOString(),
    };

    return this.installFromDefinition(result.skill, source);
  }

  uninstall(id: string): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;

    // Builtin skills cannot be uninstalled
    if (skill.source.type === 'builtin') return false;

    return this.skills.delete(id);
  }

  enableSkill(id: string): boolean {
    return this.setStatus(id, 'active');
  }

  disableSkill(id: string): boolean {
    return this.setStatus(id, 'disabled');
  }

  getSkillsByTag(tag: string): readonly SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.tags.includes(tag));
  }

  getActiveSkills(): readonly SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.status === 'active');
  }

  resolveSkillsForAgent(skillIds: readonly string[]): readonly SkillDefinition[] {
    const idSet = new Set(skillIds);
    return [...this.skills.values()].filter(
      (s) => idSet.has(s.id) && s.status === 'active',
    );
  }

  // ---- Private helpers ----

  private setStatus(id: string, status: SkillDefinition['status']): boolean {
    const existing = this.skills.get(id);
    if (!existing) return false;

    const updated: SkillDefinition = { ...existing, status };
    this.skills.set(id, updated);
    return true;
  }
}

// ---- Factory ----

/**
 * Create a SkillManager pre-loaded with built-in skills.
 * Optionally accepts a SkillResolver for URL-based installation.
 */
export function createSkillManager(resolver?: SkillResolver): SkillManager {
  const manager = new SkillManagerImpl(resolver);
  loadBuiltinSkills(manager);
  return manager;
}
