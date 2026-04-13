// ---------------------------------------------------------------------------
// @orbit/agent-core – Skills barrel export (M12)
// ---------------------------------------------------------------------------

// Types
export type {
  SkillStatus,
  SkillSource,
  SkillDefinition,
  SkillInstallInput,
  SkillResolveResult,
  SkillManager,
} from './types.js';
export { SKILL_STATUSES } from './types.js';

// Skill Manager
export { SkillManagerImpl, createSkillManager } from './skill-manager.js';

// Skill Resolver
export { SkillResolver, createSkillResolver } from './skill-resolver.js';

// Built-in Skills
export { BUILTIN_SKILLS, loadBuiltinSkills } from './builtin-skills.js';
