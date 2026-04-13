// ---------------------------------------------------------------------------
// @orbit/agent-core – Application-level Internal Tools
// ---------------------------------------------------------------------------

import { generateId } from '../types.js';
import type { BuiltinTool, ToolOutput } from './types.js';
import type { Toolset } from './toolset-registry.js';

// ---- In-memory data store ----

/** Simulated application data store. Real backends are plugged in later. */
export class AppDataStore {
  private readonly projects = new Map<string, Record<string, unknown>>();
  private readonly milestones = new Map<string, Record<string, unknown>>();
  private readonly tasks = new Map<string, Record<string, unknown>>();
  private readonly objects = new Map<string, Record<string, unknown>>();
  private readonly links: Array<{ source: string; target: string; relation: string }> = [];

  // ---- Projects ----

  createProject(name: string, description?: string): Record<string, unknown> {
    const id = generateId('proj');
    const now = new Date().toISOString();
    const project = { id, name, description: description ?? '', status: 'active', createdAt: now, updatedAt: now };
    this.projects.set(id, project);
    this.objects.set(id, { ...project, type: 'project' });
    return project;
  }

  listProjects(status?: string): readonly Record<string, unknown>[] {
    const all = [...this.projects.values()];
    return status ? all.filter((p) => p.status === status) : all;
  }

  updateProject(id: string, updates: Record<string, unknown>): Record<string, unknown> | undefined {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated = { ...project, ...updates, id, updatedAt: new Date().toISOString() };
    this.projects.set(id, updated);
    this.objects.set(id, { ...updated, type: 'project' });
    return updated;
  }

  deleteProject(id: string): boolean {
    const existed = this.projects.delete(id);
    if (existed) this.objects.delete(id);
    return existed;
  }

  // ---- Milestones ----

  createMilestone(projectId: string, name: string, description?: string): Record<string, unknown> | undefined {
    if (!this.projects.has(projectId)) return undefined;
    const id = generateId('ms');
    const now = new Date().toISOString();
    const milestone = { id, projectId, name, description: description ?? '', status: 'open', createdAt: now, updatedAt: now };
    this.milestones.set(id, milestone);
    this.objects.set(id, { ...milestone, type: 'milestone' });
    return milestone;
  }

  listMilestones(projectId: string): readonly Record<string, unknown>[] {
    return [...this.milestones.values()].filter((m) => m.projectId === projectId);
  }

  updateMilestone(id: string, updates: Record<string, unknown>): Record<string, unknown> | undefined {
    const milestone = this.milestones.get(id);
    if (!milestone) return undefined;
    const updated = { ...milestone, ...updates, id, updatedAt: new Date().toISOString() };
    this.milestones.set(id, updated);
    this.objects.set(id, { ...updated, type: 'milestone' });
    return updated;
  }

  // ---- Tasks ----

  createTask(
    title: string,
    opts?: { projectId?: string; milestoneId?: string; description?: string; priority?: string },
  ): Record<string, unknown> {
    const id = generateId('task');
    const now = new Date().toISOString();
    const task: Record<string, unknown> = {
      id,
      title,
      description: opts?.description ?? '',
      status: 'todo',
      priority: opts?.priority ?? 'medium',
      projectId: opts?.projectId ?? null,
      milestoneId: opts?.milestoneId ?? null,
      assignee: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, task);
    this.objects.set(id, { ...task, type: 'task' });
    return task;
  }

  listTasks(filters?: { projectId?: string; milestoneId?: string; status?: string }): readonly Record<string, unknown>[] {
    let all = [...this.tasks.values()];
    if (filters?.projectId) all = all.filter((t) => t.projectId === filters.projectId);
    if (filters?.milestoneId) all = all.filter((t) => t.milestoneId === filters.milestoneId);
    if (filters?.status) all = all.filter((t) => t.status === filters.status);
    return all;
  }

  updateTask(id: string, updates: Record<string, unknown>): Record<string, unknown> | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates, id, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    this.objects.set(id, { ...updated, type: 'task' });
    return updated;
  }

  // ---- Objects & Links ----

  getObject(id: string): Record<string, unknown> | undefined {
    return this.objects.get(id);
  }

  searchObjects(query: string, type?: string, limit = 20): readonly Record<string, unknown>[] {
    const q = query.toLowerCase();
    let results = [...this.objects.values()].filter((obj) => {
      const haystack = JSON.stringify(obj).toLowerCase();
      return haystack.includes(q);
    });
    if (type) results = results.filter((obj) => obj.type === type);
    return results.slice(0, limit);
  }

  queryObjects(type: string, filters?: Record<string, unknown>): readonly Record<string, unknown>[] {
    let results = [...this.objects.values()].filter((obj) => obj.type === type);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        results = results.filter((obj) => obj[key] === value);
      }
    }
    return results;
  }

  addLink(sourceId: string, targetId: string, relation: string): boolean {
    if (!this.objects.has(sourceId) || !this.objects.has(targetId)) return false;
    this.links.push({ source: sourceId, target: targetId, relation });
    return true;
  }

  getLinks(objectId: string): readonly { source: string; target: string; relation: string }[] {
    return this.links.filter((l) => l.source === objectId || l.target === objectId);
  }
}

// ---- Factory ----

/** Create a fresh in-memory application data store. */
export function createAppDataStore(): AppDataStore {
  return new AppDataStore();
}

// Shared default store for the pre-built tool instances
const defaultStore = createAppDataStore();

// ---------------------------------------------------------------------------
// Planning tools
// ---------------------------------------------------------------------------

/** Create a new project. */
export const projectCreateTool: BuiltinTool = {
  name: 'project.create',
  description: 'Create a new project with a name and optional description.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Project name' },
      description: { type: 'string', description: 'Optional project description' },
    },
    required: ['name'],
  },

  async execute(args): Promise<ToolOutput> {
    const name = args.name;
    if (typeof name !== 'string' || name.trim() === '') {
      return { success: false, output: 'Error: "name" argument is required and must be a non-empty string.' };
    }
    const desc = typeof args.description === 'string' ? args.description : undefined;
    const project = defaultStore.createProject(name.trim(), desc);
    return { success: true, output: JSON.stringify(project, null, 2), metadata: { id: project.id as string } };
  },
};

/** List all projects, optionally filtered by status. */
export const projectListTool: BuiltinTool = {
  name: 'project.list',
  description: 'List all projects, optionally filtered by status.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by project status (e.g. "active", "archived")' },
    },
    required: [],
  },

  async execute(args): Promise<ToolOutput> {
    const status = typeof args.status === 'string' ? args.status : undefined;
    const projects = defaultStore.listProjects(status);
    return { success: true, output: JSON.stringify(projects, null, 2), metadata: { count: projects.length } };
  },
};

/** Update an existing project. */
export const projectUpdateTool: BuiltinTool = {
  name: 'project.update',
  description: 'Update a project by ID. Can change name, description, or status.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Project ID' },
      name: { type: 'string', description: 'New project name' },
      description: { type: 'string', description: 'New description' },
      status: { type: 'string', description: 'New status' },
    },
    required: ['id'],
  },

  async execute(args): Promise<ToolOutput> {
    const id = args.id;
    if (typeof id !== 'string' || id.trim() === '') {
      return { success: false, output: 'Error: "id" argument is required.' };
    }
    const updates: Record<string, unknown> = {};
    if (typeof args.name === 'string') updates.name = args.name;
    if (typeof args.description === 'string') updates.description = args.description;
    if (typeof args.status === 'string') updates.status = args.status;

    const project = defaultStore.updateProject(id, updates);
    if (!project) return { success: false, output: `Error: Project "${id}" not found.` };
    return { success: true, output: JSON.stringify(project, null, 2) };
  },
};

/** Delete a project by ID. */
export const projectDeleteTool: BuiltinTool = {
  name: 'project.delete',
  description: 'Delete a project by ID.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Project ID to delete' },
    },
    required: ['id'],
  },

  async execute(args): Promise<ToolOutput> {
    const id = args.id;
    if (typeof id !== 'string' || id.trim() === '') {
      return { success: false, output: 'Error: "id" argument is required.' };
    }
    const deleted = defaultStore.deleteProject(id);
    if (!deleted) return { success: false, output: `Error: Project "${id}" not found.` };
    return { success: true, output: `Project "${id}" deleted.` };
  },
};

/** Create a milestone within a project. */
export const milestoneCreateTool: BuiltinTool = {
  name: 'milestone.create',
  description: 'Create a new milestone within a project.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Parent project ID' },
      name: { type: 'string', description: 'Milestone name' },
      description: { type: 'string', description: 'Optional milestone description' },
    },
    required: ['projectId', 'name'],
  },

  async execute(args): Promise<ToolOutput> {
    const projectId = args.projectId;
    const name = args.name;
    if (typeof projectId !== 'string' || projectId.trim() === '') {
      return { success: false, output: 'Error: "projectId" argument is required.' };
    }
    if (typeof name !== 'string' || name.trim() === '') {
      return { success: false, output: 'Error: "name" argument is required.' };
    }
    const desc = typeof args.description === 'string' ? args.description : undefined;
    const milestone = defaultStore.createMilestone(projectId, name.trim(), desc);
    if (!milestone) return { success: false, output: `Error: Project "${projectId}" not found.` };
    return { success: true, output: JSON.stringify(milestone, null, 2), metadata: { id: milestone.id as string } };
  },
};

/** List milestones for a project. */
export const milestoneListTool: BuiltinTool = {
  name: 'milestone.list',
  description: 'List milestones for a given project.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project ID to list milestones for' },
    },
    required: ['projectId'],
  },

  async execute(args): Promise<ToolOutput> {
    const projectId = args.projectId;
    if (typeof projectId !== 'string' || projectId.trim() === '') {
      return { success: false, output: 'Error: "projectId" argument is required.' };
    }
    const milestones = defaultStore.listMilestones(projectId);
    return { success: true, output: JSON.stringify(milestones, null, 2), metadata: { count: milestones.length } };
  },
};

/** Update a milestone by ID. */
export const milestoneUpdateTool: BuiltinTool = {
  name: 'milestone.update',
  description: 'Update a milestone by ID. Can change name, description, or status.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Milestone ID' },
      name: { type: 'string', description: 'New milestone name' },
      description: { type: 'string', description: 'New description' },
      status: { type: 'string', description: 'New status' },
    },
    required: ['id'],
  },

  async execute(args): Promise<ToolOutput> {
    const id = args.id;
    if (typeof id !== 'string' || id.trim() === '') {
      return { success: false, output: 'Error: "id" argument is required.' };
    }
    const updates: Record<string, unknown> = {};
    if (typeof args.name === 'string') updates.name = args.name;
    if (typeof args.description === 'string') updates.description = args.description;
    if (typeof args.status === 'string') updates.status = args.status;

    const milestone = defaultStore.updateMilestone(id, updates);
    if (!milestone) return { success: false, output: `Error: Milestone "${id}" not found.` };
    return { success: true, output: JSON.stringify(milestone, null, 2) };
  },
};

/** Create a new task. */
export const taskCreateTool: BuiltinTool = {
  name: 'task.create',
  description: 'Create a new task with a title. Optionally assign to a project or milestone.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description' },
      projectId: { type: 'string', description: 'Associated project ID' },
      milestoneId: { type: 'string', description: 'Associated milestone ID' },
      priority: { type: 'string', description: 'Priority: "low", "medium", "high", "critical"' },
    },
    required: ['title'],
  },

  async execute(args): Promise<ToolOutput> {
    const title = args.title;
    if (typeof title !== 'string' || title.trim() === '') {
      return { success: false, output: 'Error: "title" argument is required and must be a non-empty string.' };
    }
    const task = defaultStore.createTask(title.trim(), {
      projectId: typeof args.projectId === 'string' ? args.projectId : undefined,
      milestoneId: typeof args.milestoneId === 'string' ? args.milestoneId : undefined,
      description: typeof args.description === 'string' ? args.description : undefined,
      priority: typeof args.priority === 'string' ? args.priority : undefined,
    });
    return { success: true, output: JSON.stringify(task, null, 2), metadata: { id: task.id as string } };
  },
};

/** List tasks with optional filters. */
export const taskListTool: BuiltinTool = {
  name: 'task.list',
  description: 'List tasks. Optionally filter by project, milestone, or status.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Filter by project ID' },
      milestoneId: { type: 'string', description: 'Filter by milestone ID' },
      status: { type: 'string', description: 'Filter by status (e.g. "todo", "in-progress", "done")' },
    },
    required: [],
  },

  async execute(args): Promise<ToolOutput> {
    const tasks = defaultStore.listTasks({
      projectId: typeof args.projectId === 'string' ? args.projectId : undefined,
      milestoneId: typeof args.milestoneId === 'string' ? args.milestoneId : undefined,
      status: typeof args.status === 'string' ? args.status : undefined,
    });
    return { success: true, output: JSON.stringify(tasks, null, 2), metadata: { count: tasks.length } };
  },
};

/** Update a task by ID. */
export const taskUpdateTool: BuiltinTool = {
  name: 'task.update',
  description: 'Update a task by ID. Can change title, description, status, or priority.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task ID' },
      title: { type: 'string', description: 'New task title' },
      description: { type: 'string', description: 'New description' },
      status: { type: 'string', description: 'New status' },
      priority: { type: 'string', description: 'New priority' },
    },
    required: ['id'],
  },

  async execute(args): Promise<ToolOutput> {
    const id = args.id;
    if (typeof id !== 'string' || id.trim() === '') {
      return { success: false, output: 'Error: "id" argument is required.' };
    }
    const updates: Record<string, unknown> = {};
    if (typeof args.title === 'string') updates.title = args.title;
    if (typeof args.description === 'string') updates.description = args.description;
    if (typeof args.status === 'string') updates.status = args.status;
    if (typeof args.priority === 'string') updates.priority = args.priority;

    const task = defaultStore.updateTask(id, updates);
    if (!task) return { success: false, output: `Error: Task "${id}" not found.` };
    return { success: true, output: JSON.stringify(task, null, 2) };
  },
};

/** Mark a task as complete. */
export const taskCompleteTool: BuiltinTool = {
  name: 'task.complete',
  description: 'Mark a task as complete by ID.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task ID to complete' },
    },
    required: ['id'],
  },

  async execute(args): Promise<ToolOutput> {
    const id = args.id;
    if (typeof id !== 'string' || id.trim() === '') {
      return { success: false, output: 'Error: "id" argument is required.' };
    }
    const task = defaultStore.updateTask(id, { status: 'done' });
    if (!task) return { success: false, output: `Error: Task "${id}" not found.` };
    return { success: true, output: `Task "${id}" marked as complete.`, metadata: { id } };
  },
};

/** Assign a task to an agent or user. */
export const taskAssignTool: BuiltinTool = {
  name: 'task.assign',
  description: 'Assign a task to an agent or user by ID.',
  category: 'planning',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task ID' },
      assignee: { type: 'string', description: 'Assignee name or agent identifier' },
    },
    required: ['id', 'assignee'],
  },

  async execute(args): Promise<ToolOutput> {
    const id = args.id;
    const assignee = args.assignee;
    if (typeof id !== 'string' || id.trim() === '') {
      return { success: false, output: 'Error: "id" argument is required.' };
    }
    if (typeof assignee !== 'string' || assignee.trim() === '') {
      return { success: false, output: 'Error: "assignee" argument is required.' };
    }
    const task = defaultStore.updateTask(id, { assignee });
    if (!task) return { success: false, output: `Error: Task "${id}" not found.` };
    return { success: true, output: `Task "${id}" assigned to "${assignee}".`, metadata: { id, assignee } };
  },
};

// ---------------------------------------------------------------------------
// Workspace tools
// ---------------------------------------------------------------------------

/** Search workspace objects by text query. */
export const workspaceSearchTool: BuiltinTool = {
  name: 'workspace.search',
  description: 'Search workspace objects by a text query. Optionally filter by type and limit results.',
  category: 'workspace',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' },
      type: { type: 'string', description: 'Filter by object type (e.g. "project", "task")' },
      limit: { type: 'number', description: 'Maximum number of results (default: 20)' },
    },
    required: ['query'],
  },

  async execute(args): Promise<ToolOutput> {
    const query = args.query;
    if (typeof query !== 'string' || query.trim() === '') {
      return { success: false, output: 'Error: "query" argument is required and must be a non-empty string.' };
    }
    const type = typeof args.type === 'string' ? args.type : undefined;
    const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 20;
    const results = defaultStore.searchObjects(query, type, limit);
    return { success: true, output: JSON.stringify(results, null, 2), metadata: { count: results.length } };
  },
};

/** Query workspace with structured filters. */
export const workspaceQueryTool: BuiltinTool = {
  name: 'workspace.query',
  description: 'Query workspace objects by type and optional structured filters.',
  category: 'workspace',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Object type to query (e.g. "project", "task", "milestone")' },
      filters: { type: 'object', description: 'Key-value filters to match against object properties' },
    },
    required: ['type'],
  },

  async execute(args): Promise<ToolOutput> {
    const type = args.type;
    if (typeof type !== 'string' || type.trim() === '') {
      return { success: false, output: 'Error: "type" argument is required.' };
    }
    const filters = typeof args.filters === 'object' && args.filters !== null
      ? (args.filters as Record<string, unknown>)
      : undefined;
    const results = defaultStore.queryObjects(type, filters);
    return { success: true, output: JSON.stringify(results, null, 2), metadata: { count: results.length } };
  },
};

/** Get details of a single object by ID. */
export const objectGetTool: BuiltinTool = {
  name: 'object.get',
  description: 'Get full details of a workspace object by ID.',
  category: 'workspace',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Object ID' },
    },
    required: ['id'],
  },

  async execute(args): Promise<ToolOutput> {
    const id = args.id;
    if (typeof id !== 'string' || id.trim() === '') {
      return { success: false, output: 'Error: "id" argument is required.' };
    }
    const obj = defaultStore.getObject(id);
    if (!obj) return { success: false, output: `Error: Object "${id}" not found.` };
    return { success: true, output: JSON.stringify(obj, null, 2), metadata: { type: obj.type as string } };
  },
};

/** Link two objects together with an optional relation. */
export const objectLinkTool: BuiltinTool = {
  name: 'object.link',
  description: 'Create a directional link between two workspace objects.',
  category: 'workspace',
  parameters: {
    type: 'object',
    properties: {
      sourceId: { type: 'string', description: 'Source object ID' },
      targetId: { type: 'string', description: 'Target object ID' },
      relation: { type: 'string', description: 'Relation label (default: "related")' },
    },
    required: ['sourceId', 'targetId'],
  },

  async execute(args): Promise<ToolOutput> {
    const sourceId = args.sourceId;
    const targetId = args.targetId;
    if (typeof sourceId !== 'string' || sourceId.trim() === '') {
      return { success: false, output: 'Error: "sourceId" argument is required.' };
    }
    if (typeof targetId !== 'string' || targetId.trim() === '') {
      return { success: false, output: 'Error: "targetId" argument is required.' };
    }
    const relation = typeof args.relation === 'string' && args.relation.trim() !== ''
      ? args.relation
      : 'related';
    const linked = defaultStore.addLink(sourceId, targetId, relation);
    if (!linked) return { success: false, output: 'Error: One or both objects not found.' };
    return {
      success: true,
      output: `Linked "${sourceId}" → "${targetId}" (${relation}).`,
      metadata: { sourceId, targetId, relation },
    };
  },
};

// ---------------------------------------------------------------------------
// App toolsets
// ---------------------------------------------------------------------------

/** Pre-built application toolsets for planning and workspace operations. */
export const APP_TOOLSETS: readonly Toolset[] = [
  {
    name: 'planning',
    description: 'Project, milestone, and task management',
    category: 'planning',
    tools: [
      projectCreateTool,
      projectListTool,
      projectUpdateTool,
      projectDeleteTool,
      milestoneCreateTool,
      milestoneListTool,
      milestoneUpdateTool,
      taskCreateTool,
      taskListTool,
      taskUpdateTool,
      taskCompleteTool,
      taskAssignTool,
    ],
  },
  {
    name: 'workspace',
    description: 'Workspace search, query, and object linking',
    category: 'workspace',
    tools: [
      workspaceSearchTool,
      workspaceQueryTool,
      objectGetTool,
      objectLinkTool,
    ],
  },
];
