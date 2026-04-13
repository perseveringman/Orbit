// ---------------------------------------------------------------------------
// @orbit/agent-core – Roles barrel export
// ---------------------------------------------------------------------------

export type {
  AgentToolConfig,
  AgentRoleDefinition,
  CreateRoleInput,
  UpdateRoleInput,
  ResolvedAgentConfig,
  RoleRegistry,
} from './types.js';

export { RoleRegistryImpl } from './role-registry.js';

export { BUILTIN_ROLES, loadBuiltinRoles } from './builtin-roles.js';
