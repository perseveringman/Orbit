// ---------------------------------------------------------------------------
// @orbit/agent-core – Skills System Tests (M12)
// ---------------------------------------------------------------------------

import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  SkillManagerImpl,
  createSkillManager,
  SkillResolver,
  createSkillResolver,
  BUILTIN_SKILLS,
  loadBuiltinSkills,
} from '../src/skills/index';

import type {
  SkillDefinition,
  SkillInstallInput,
  SkillManager,
  SkillSource,
} from '../src/skills/index';

import type { LLMAdapter } from '../src/llm-adapter';

// ---- Helpers ----

function makeSkillInput(overrides: Partial<SkillInstallInput> = {}): SkillInstallInput {
  return {
    name: overrides.name ?? 'test-skill',
    description: overrides.description ?? 'A test skill',
    instructions: overrides.instructions ?? 'Do the thing.',
    version: overrides.version,
    author: overrides.author,
    tools: overrides.tools,
    mcpServers: overrides.mcpServers,
    inputSchema: overrides.inputSchema,
    tags: overrides.tags,
  };
}

const URL_SOURCE: SkillSource = { type: 'url', url: 'https://example.com/skill', fetchedAt: new Date().toISOString() };
const LOCAL_SOURCE: SkillSource = { type: 'local', path: '/tmp/skill' };

// ==========================================================================
// SkillManager
// ==========================================================================

describe('SkillManager', () => {
  let manager: SkillManager;

  beforeEach(() => {
    manager = createSkillManager();
  });

  it('creates a skill manager with the factory function', () => {
    expect(manager).toBeDefined();
    expect(typeof manager.listSkills).toBe('function');
  });

  it('lists builtin skills after creation (4 builtin)', () => {
    const skills = manager.listSkills();
    expect(skills.length).toBe(4);
    const names = skills.map((s) => s.name);
    expect(names).toContain('orbit:planning');
    expect(names).toContain('orbit:research');
    expect(names).toContain('orbit:reading');
    expect(names).toContain('orbit:writing');
  });

  it('installs a skill from definition', () => {
    const input = makeSkillInput({ name: 'custom-skill', tags: ['custom'] });
    const installed = manager.installFromDefinition(input, URL_SOURCE);

    expect(installed.id).toMatch(/^skill_/);
    expect(installed.name).toBe('custom-skill');
    expect(installed.description).toBe('A test skill');
    expect(installed.source).toEqual(URL_SOURCE);
    expect(installed.status).toBe('active');
    expect(installed.tags).toEqual(['custom']);
    expect(installed.installedAt).toBeTruthy();
  });

  it('gets a skill by ID', () => {
    const installed = manager.installFromDefinition(makeSkillInput({ name: 'findme' }), LOCAL_SOURCE);
    const found = manager.getSkill(installed.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('findme');
  });

  it('returns undefined for unknown skill ID', () => {
    expect(manager.getSkill('nonexistent')).toBeUndefined();
  });

  it('uninstalls a custom skill', () => {
    const installed = manager.installFromDefinition(makeSkillInput(), LOCAL_SOURCE);
    expect(manager.uninstall(installed.id)).toBe(true);
    expect(manager.getSkill(installed.id)).toBeUndefined();
  });

  it('cannot uninstall a builtin skill', () => {
    const builtins = manager.listSkills().filter((s) => s.source.type === 'builtin');
    expect(builtins.length).toBeGreaterThan(0);
    const result = manager.uninstall(builtins[0].id);
    expect(result).toBe(false);
    // Still present
    expect(manager.getSkill(builtins[0].id)).toBeDefined();
  });

  it('enables a skill', () => {
    const installed = manager.installFromDefinition(makeSkillInput(), LOCAL_SOURCE);
    manager.disableSkill(installed.id);
    expect(manager.getSkill(installed.id)!.status).toBe('disabled');

    const result = manager.enableSkill(installed.id);
    expect(result).toBe(true);
    expect(manager.getSkill(installed.id)!.status).toBe('active');
  });

  it('disables a skill', () => {
    const installed = manager.installFromDefinition(makeSkillInput(), LOCAL_SOURCE);
    const result = manager.disableSkill(installed.id);
    expect(result).toBe(true);
    expect(manager.getSkill(installed.id)!.status).toBe('disabled');
  });

  it('returns false when enabling/disabling nonexistent skill', () => {
    expect(manager.enableSkill('nope')).toBe(false);
    expect(manager.disableSkill('nope')).toBe(false);
  });

  it('gets skills by tag', () => {
    manager.installFromDefinition(makeSkillInput({ name: 'tagged', tags: ['alpha', 'beta'] }), LOCAL_SOURCE);
    manager.installFromDefinition(makeSkillInput({ name: 'other', tags: ['gamma'] }), LOCAL_SOURCE);

    const alphaSkills = manager.getSkillsByTag('alpha');
    expect(alphaSkills.length).toBe(1);
    expect(alphaSkills[0].name).toBe('tagged');
  });

  it('gets active skills (excludes disabled ones)', () => {
    const installed = manager.installFromDefinition(makeSkillInput({ name: 'will-disable' }), LOCAL_SOURCE);
    const before = manager.getActiveSkills().length;

    manager.disableSkill(installed.id);
    const after = manager.getActiveSkills().length;

    expect(after).toBe(before - 1);
    expect(manager.getActiveSkills().find((s) => s.id === installed.id)).toBeUndefined();
  });

  it('resolves skills for agent (only active, matching IDs)', () => {
    const s1 = manager.installFromDefinition(makeSkillInput({ name: 's1' }), LOCAL_SOURCE);
    const s2 = manager.installFromDefinition(makeSkillInput({ name: 's2' }), LOCAL_SOURCE);
    const s3 = manager.installFromDefinition(makeSkillInput({ name: 's3' }), LOCAL_SOURCE);

    manager.disableSkill(s2.id);

    const resolved = manager.resolveSkillsForAgent([s1.id, s2.id, s3.id]);
    const ids = resolved.map((s) => s.id);

    expect(ids).toContain(s1.id);
    expect(ids).not.toContain(s2.id); // disabled
    expect(ids).toContain(s3.id);
  });

  it('resolves empty array when no IDs match', () => {
    const resolved = manager.resolveSkillsForAgent(['fake-id']);
    expect(resolved).toEqual([]);
  });

  it('handles installing skills with same name (both are stored with unique IDs)', () => {
    const a = manager.installFromDefinition(makeSkillInput({ name: 'dup' }), LOCAL_SOURCE);
    const b = manager.installFromDefinition(makeSkillInput({ name: 'dup' }), LOCAL_SOURCE);

    expect(a.id).not.toBe(b.id);
    expect(manager.getSkill(a.id)).toBeDefined();
    expect(manager.getSkill(b.id)).toBeDefined();
  });
});

// ==========================================================================
// SkillResolver
// ==========================================================================

describe('SkillResolver', () => {
  let resolver: SkillResolver;

  beforeEach(() => {
    resolver = createSkillResolver(); // no LLM → heuristic mode
  });

  it('creates a resolver without LLM (heuristic mode)', () => {
    expect(resolver).toBeInstanceOf(SkillResolver);
  });

  it('returns error result for invalid URL (fetch failure)', async () => {
    // Mock global fetch to throw
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'));

    const result = await resolver.resolve('https://invalid.example/broken');
    expect(result.success).toBe(false);
    expect(result.error).toContain('network error');
    expect(result.sourceUrl).toBe('https://invalid.example/broken');

    fetchSpy.mockRestore();
  });

  it('extracts name/description from page content using heuristics', async () => {
    const mockPage = [
      '# My Cool Skill',
      '## A tool for productivity',
      '',
      'description: Helps you be productive',
      'instructions: Use this skill to manage tasks',
      'tags: [productivity, tasks]',
      'tools: [task.create, task.list]',
    ].join('\n');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockPage, { status: 200 }),
    );

    const result = await resolver.resolve('https://example.com/skill');

    expect(result.success).toBe(true);
    expect(result.skill).toBeDefined();
    expect(result.skill!.name).toBe('My Cool Skill');
    expect(result.skill!.description).toBe('Helps you be productive');
    expect(result.skill!.instructions).toBe('Use this skill to manage tasks');
    expect(result.skill!.tags).toEqual(['productivity', 'tasks']);
    expect(result.skill!.tools).toEqual(['task.create', 'task.list']);

    fetchSpy.mockRestore();
  });

  it('returns failure when page has no extractable skill name', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Some random content with no headings or structured data', { status: 200 }),
    );

    const result = await resolver.resolve('https://example.com/empty');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    fetchSpy.mockRestore();
  });

  it('resolves with mock LLM adapter that returns structured skill data', async () => {
    const mockLLM: LLMAdapter = {
      chatCompletion: vi.fn().mockResolvedValue({
        id: 'resp-1',
        choices: [
          {
            message: {
              id: 'msg-1',
              role: 'assistant' as const,
              content: JSON.stringify({
                name: 'llm-extracted-skill',
                description: 'Extracted by LLM',
                instructions: 'Follow the plan',
                tools: ['web_search'],
                tags: ['ai'],
              }),
              timestamp: new Date().toISOString(),
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    };

    const llmResolver = createSkillResolver(mockLLM);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('# Some Page\nSome content', { status: 200 }),
    );

    const result = await llmResolver.resolve('https://example.com/llm-skill');

    expect(result.success).toBe(true);
    expect(result.skill).toBeDefined();
    expect(result.skill!.name).toBe('llm-extracted-skill');
    expect(result.skill!.instructions).toBe('Follow the plan');
    expect(mockLLM.chatCompletion).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });
});

// ==========================================================================
// Builtin Skills
// ==========================================================================

describe('Builtin Skills', () => {
  it('BUILTIN_SKILLS has exactly 4 items', () => {
    expect(BUILTIN_SKILLS).toHaveLength(4);
  });

  it('each builtin skill has required fields', () => {
    for (const skill of BUILTIN_SKILLS) {
      expect(typeof skill.name).toBe('string');
      expect(skill.name.length).toBeGreaterThan(0);
      expect(typeof skill.description).toBe('string');
      expect(skill.description.length).toBeGreaterThan(0);
      expect(typeof skill.instructions).toBe('string');
      expect(skill.instructions.length).toBeGreaterThan(0);
      expect(Array.isArray(skill.tools)).toBe(true);
      expect(skill.tools!.length).toBeGreaterThan(0);
    }
  });

  it('loadBuiltinSkills registers all 4 into a manager', () => {
    const manager = new SkillManagerImpl();
    expect(manager.listSkills()).toHaveLength(0);

    loadBuiltinSkills(manager);

    const skills = manager.listSkills();
    expect(skills).toHaveLength(4);
    for (const skill of skills) {
      expect(skill.source.type).toBe('builtin');
      expect(skill.status).toBe('active');
    }
  });

  it('builtin skill names follow orbit: prefix convention', () => {
    for (const skill of BUILTIN_SKILLS) {
      expect(skill.name).toMatch(/^orbit:/);
    }
  });
});
