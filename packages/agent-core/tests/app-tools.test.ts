// ---------------------------------------------------------------------------
// @orbit/agent-core – App Tools & ToolManager Tests
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach } from 'vitest';

import {
  // App tools
  AppDataStore,
  createAppDataStore,
  projectCreateTool,
  projectListTool,
  projectUpdateTool,
  projectDeleteTool,
  milestoneCreateTool,
  milestoneListTool,
  taskCreateTool,
  taskListTool,
  taskCompleteTool,
  taskAssignTool,
  workspaceSearchTool,
  workspaceQueryTool,
  objectGetTool,
  objectLinkTool,
  APP_TOOLSETS,
  // Toolset registry
  ToolsetRegistry,
  createDefaultToolsetRegistry,
  CORE_TOOLSETS,
  // Tool manager
  createToolManager,
} from '../src/index';

import type { ToolManager, ManagedTool } from '../src/index';

// ==========================================================================
// AppDataStore (unit tests against the data layer directly)
// ==========================================================================

describe('AppDataStore', () => {
  let store: AppDataStore;

  beforeEach(() => {
    store = createAppDataStore();
  });

  // ---- Projects ----

  it('creates a project and returns it with id and name', () => {
    const project = store.createProject('Test Project', 'Description');
    expect(project.id).toMatch(/^proj_/);
    expect(project.name).toBe('Test Project');
    expect(project.description).toBe('Description');
    expect(project.status).toBe('active');
    expect(project.createdAt).toBeTruthy();
  });

  it('lists projects (returns array)', () => {
    store.createProject('P1');
    store.createProject('P2');
    const projects = store.listProjects();
    expect(projects.length).toBe(2);
  });

  it('updates a project name', () => {
    const project = store.createProject('Original');
    const updated = store.updateProject(project.id as string, { name: 'Updated' });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('Updated');
  });

  it('deletes a project', () => {
    const project = store.createProject('ToDelete');
    expect(store.deleteProject(project.id as string)).toBe(true);
    expect(store.listProjects().length).toBe(0);
  });

  it('delete returns false for nonexistent project', () => {
    expect(store.deleteProject('nonexistent')).toBe(false);
  });

  // ---- Milestones ----

  it('creates a milestone for a project', () => {
    const project = store.createProject('MilestoneProject');
    const milestone = store.createMilestone(project.id as string, 'v1.0', 'First release');
    expect(milestone).toBeDefined();
    expect(milestone!.id).toMatch(/^ms_/);
    expect(milestone!.name).toBe('v1.0');
    expect(milestone!.projectId).toBe(project.id);
  });

  it('returns undefined when creating milestone for nonexistent project', () => {
    expect(store.createMilestone('nonexistent', 'v1.0')).toBeUndefined();
  });

  it('lists milestones for a project', () => {
    const project = store.createProject('MP');
    store.createMilestone(project.id as string, 'M1');
    store.createMilestone(project.id as string, 'M2');
    const milestones = store.listMilestones(project.id as string);
    expect(milestones.length).toBe(2);
  });

  // ---- Tasks ----

  it('creates a task with project reference', () => {
    const project = store.createProject('TaskProject');
    const task = store.createTask('Build feature', { projectId: project.id as string });
    expect(task.id).toMatch(/^task_/);
    expect(task.title).toBe('Build feature');
    expect(task.projectId).toBe(project.id);
    expect(task.status).toBe('todo');
  });

  it('lists tasks filtered by project', () => {
    const p1 = store.createProject('P1');
    const p2 = store.createProject('P2');
    store.createTask('T1', { projectId: p1.id as string });
    store.createTask('T2', { projectId: p2.id as string });
    store.createTask('T3', { projectId: p1.id as string });

    const p1Tasks = store.listTasks({ projectId: p1.id as string });
    expect(p1Tasks.length).toBe(2);
  });

  it('completes a task (via updateTask)', () => {
    const task = store.createTask('Complete me');
    const updated = store.updateTask(task.id as string, { status: 'done' });
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('done');
  });

  it('assigns a task', () => {
    const task = store.createTask('Assign me');
    const updated = store.updateTask(task.id as string, { assignee: 'agent-1' });
    expect(updated).toBeDefined();
    expect(updated!.assignee).toBe('agent-1');
  });

  // ---- Workspace ----

  it('searches workspace objects (returns results)', () => {
    store.createProject('Searchable Project');
    store.createTask('Searchable Task');
    const results = store.searchObjects('Searchable');
    expect(results.length).toBe(2);
  });

  it('queries workspace by type', () => {
    store.createProject('P1');
    store.createTask('T1');
    const projects = store.queryObjects('project');
    expect(projects.length).toBe(1);
    expect(projects[0].type).toBe('project');
  });

  it('gets object by ID', () => {
    const project = store.createProject('GetMe');
    const obj = store.getObject(project.id as string);
    expect(obj).toBeDefined();
    expect(obj!.name).toBe('GetMe');
    expect(obj!.type).toBe('project');
  });

  it('links two objects', () => {
    const p = store.createProject('Source');
    const t = store.createTask('Target');
    const linked = store.addLink(p.id as string, t.id as string, 'has-task');
    expect(linked).toBe(true);
    const links = store.getLinks(p.id as string);
    expect(links.length).toBe(1);
    expect(links[0].relation).toBe('has-task');
  });

  it('link fails for nonexistent object', () => {
    const p = store.createProject('Source');
    expect(store.addLink(p.id as string, 'nonexistent', 'test')).toBe(false);
  });
});

// ==========================================================================
// App Tools (execute through the exported BuiltinTool objects)
// Note: These use the module-level defaultStore, so tests can see each
// other's side effects. We test by creating unique names and using IDs.
// ==========================================================================

describe('App Tools (planning)', () => {
  it('project.create returns JSON with id and name', async () => {
    const result = await projectCreateTool.execute({ name: 'AppToolProject' });
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.output);
    expect(parsed.id).toMatch(/^proj_/);
    expect(parsed.name).toBe('AppToolProject');
  });

  it('project.create fails without name', async () => {
    const result = await projectCreateTool.execute({});
    expect(result.success).toBe(false);
  });

  it('project.list returns array', async () => {
    // Create a project first to ensure list has items
    await projectCreateTool.execute({ name: 'ListTestProject' });
    const result = await projectListTool.execute({});
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('project.update changes name', async () => {
    const createResult = await projectCreateTool.execute({ name: 'BeforeUpdate' });
    const projectId = JSON.parse(createResult.output).id;

    const updateResult = await projectUpdateTool.execute({ id: projectId, name: 'AfterUpdate' });
    expect(updateResult.success).toBe(true);
    const updated = JSON.parse(updateResult.output);
    expect(updated.name).toBe('AfterUpdate');
  });

  it('project.delete removes a project', async () => {
    const createResult = await projectCreateTool.execute({ name: 'ToBeDeleted' });
    const projectId = JSON.parse(createResult.output).id;

    const deleteResult = await projectDeleteTool.execute({ id: projectId });
    expect(deleteResult.success).toBe(true);
  });

  it('milestone.create creates a milestone for a project', async () => {
    const createResult = await projectCreateTool.execute({ name: 'MilestoneTestProject' });
    const projectId = JSON.parse(createResult.output).id;

    const msResult = await milestoneCreateTool.execute({ projectId, name: 'v1.0' });
    expect(msResult.success).toBe(true);
    const milestone = JSON.parse(msResult.output);
    expect(milestone.id).toMatch(/^ms_/);
    expect(milestone.projectId).toBe(projectId);
  });

  it('milestone.list lists milestones for a project', async () => {
    const createResult = await projectCreateTool.execute({ name: 'MsListProject' });
    const projectId = JSON.parse(createResult.output).id;
    await milestoneCreateTool.execute({ projectId, name: 'Alpha' });
    await milestoneCreateTool.execute({ projectId, name: 'Beta' });

    const listResult = await milestoneListTool.execute({ projectId });
    expect(listResult.success).toBe(true);
    const milestones = JSON.parse(listResult.output);
    expect(milestones.length).toBeGreaterThanOrEqual(2);
  });

  it('task.create creates a task with projectId', async () => {
    const createResult = await projectCreateTool.execute({ name: 'TaskTestProject' });
    const projectId = JSON.parse(createResult.output).id;

    const taskResult = await taskCreateTool.execute({ title: 'Build UI', projectId });
    expect(taskResult.success).toBe(true);
    const task = JSON.parse(taskResult.output);
    expect(task.id).toMatch(/^task_/);
    expect(task.projectId).toBe(projectId);
  });

  it('task.list returns tasks', async () => {
    await taskCreateTool.execute({ title: 'TaskListTest' });
    const result = await taskListTool.execute({});
    expect(result.success).toBe(true);
    const tasks = JSON.parse(result.output);
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('task.complete marks a task as done', async () => {
    const createResult = await taskCreateTool.execute({ title: 'CompleteMe' });
    const taskId = JSON.parse(createResult.output).id;

    const completeResult = await taskCompleteTool.execute({ id: taskId });
    expect(completeResult.success).toBe(true);
    expect(completeResult.output).toContain('complete');
  });

  it('task.assign assigns a task', async () => {
    const createResult = await taskCreateTool.execute({ title: 'AssignMe' });
    const taskId = JSON.parse(createResult.output).id;

    const assignResult = await taskAssignTool.execute({ id: taskId, assignee: 'agent-42' });
    expect(assignResult.success).toBe(true);
    expect(assignResult.output).toContain('agent-42');
  });
});

describe('App Tools (workspace)', () => {
  it('workspace.search returns results array', async () => {
    // Create something to search for
    await projectCreateTool.execute({ name: 'SearchableWorkspaceProject' });
    const result = await workspaceSearchTool.execute({ query: 'SearchableWorkspace' });
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('workspace.query by type', async () => {
    await taskCreateTool.execute({ title: 'QueryTypeTask' });
    const result = await workspaceQueryTool.execute({ type: 'task' });
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.every((o: any) => o.type === 'task')).toBe(true);
  });

  it('object.get retrieves object by ID', async () => {
    const createResult = await projectCreateTool.execute({ name: 'GetByIdProject' });
    const id = JSON.parse(createResult.output).id;

    const result = await objectGetTool.execute({ id });
    expect(result.success).toBe(true);
    const obj = JSON.parse(result.output);
    expect(obj.id).toBe(id);
    expect(obj.type).toBe('project');
  });

  it('object.link links two objects', async () => {
    const p = await projectCreateTool.execute({ name: 'LinkSource' });
    const t = await taskCreateTool.execute({ title: 'LinkTarget' });
    const sourceId = JSON.parse(p.output).id;
    const targetId = JSON.parse(t.output).id;

    const result = await objectLinkTool.execute({ sourceId, targetId, relation: 'owns' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('owns');
  });
});

// ==========================================================================
// ToolManager
// ==========================================================================

describe('ToolManager', () => {
  let toolManager: ToolManager;
  let toolsetRegistry: ToolsetRegistry;

  beforeEach(() => {
    toolsetRegistry = createDefaultToolsetRegistry();
    // Also register app toolsets
    for (const toolset of APP_TOOLSETS) {
      toolsetRegistry.register(toolset);
    }
    toolManager = createToolManager(toolsetRegistry);
  });

  it('creates a tool manager with factory function', () => {
    expect(toolManager).toBeDefined();
    expect(typeof toolManager.listAllTools).toBe('function');
  });

  it('listAllTools returns all tools', () => {
    const all = toolManager.listAllTools();
    expect(all.length).toBeGreaterThan(0);
    // Should include both core and app tools
    const names = all.map((t) => t.name);
    expect(names).toContain('shell_exec');
    expect(names).toContain('project.create');
    expect(names).toContain('workspace.search');
  });

  it('listToolsBySource("builtin") returns only system tools', () => {
    const builtins = toolManager.listToolsBySource('builtin');
    expect(builtins.length).toBeGreaterThan(0);
    for (const tool of builtins) {
      expect(tool.source).toBe('builtin');
      // Should not include planning or workspace tools
      expect(['terminal', 'filesystem', 'web', 'interaction', 'code', 'utility']).toContain(tool.category);
    }
  });

  it('listToolsBySource("app") returns only planning/workspace tools', () => {
    const appTools = toolManager.listToolsBySource('app');
    expect(appTools.length).toBeGreaterThan(0);
    for (const tool of appTools) {
      expect(tool.source).toBe('app');
      expect(['planning', 'workspace']).toContain(tool.category);
    }
  });

  it('listToolsByCategory("planning") returns planning tools', () => {
    const planningTools = toolManager.listToolsByCategory('planning');
    expect(planningTools.length).toBeGreaterThanOrEqual(12); // 12 planning tools
    for (const tool of planningTools) {
      expect(tool.category).toBe('planning');
    }
  });

  it('listToolsForAgent with allowed list filters correctly', () => {
    const allowed = ['shell_exec', 'project.create'];
    const tools = toolManager.listToolsForAgent(allowed, []);
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('shell_exec');
    expect(names).toContain('project.create');
  });

  it('listToolsForAgent with blocked list filters correctly', () => {
    const allBefore = toolManager.listAllTools().length;
    const blocked = ['shell_exec', 'project.create'];
    const tools = toolManager.listToolsForAgent([], blocked);
    expect(tools.length).toBe(allBefore - 2);
    const names = tools.map((t) => t.name);
    expect(names).not.toContain('shell_exec');
    expect(names).not.toContain('project.create');
  });

  it('listToolsForAgent with empty allowed returns all (minus blocked)', () => {
    const all = toolManager.listAllTools();
    const tools = toolManager.listToolsForAgent([], []);
    expect(tools.length).toBe(all.length);
  });

  it('executeTool dispatches to correct handler', async () => {
    // datetime is a safe tool to execute
    const result = await toolManager.executeTool('datetime', {});
    expect(result.success).toBe(true);
    expect(result.toolName).toBe('datetime');
    expect(result.source).toBe('builtin');
    expect(result.output).toBeTruthy();
  });

  it('executeTool returns error for nonexistent tool', async () => {
    const result = await toolManager.executeTool('nonexistent-tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('executeTool works for app tools', async () => {
    const result = await toolManager.executeTool('project.create', { name: 'ManagerTestProject' });
    expect(result.success).toBe(true);
    expect(result.source).toBe('app');
    const parsed = JSON.parse(result.output);
    expect(parsed.name).toBe('ManagerTestProject');
  });

  it('getToolCount returns accurate summary', () => {
    const summary = toolManager.getToolCount();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.bySource.builtin).toBeGreaterThan(0);
    expect(summary.bySource.app).toBeGreaterThan(0);
    expect(summary.bySource.mcp).toBe(0);
    expect(summary.bySource.skill).toBe(0);

    // Category checks
    expect(summary.byCategory['planning']).toBeGreaterThanOrEqual(12);
    expect(summary.byCategory['workspace']).toBeGreaterThanOrEqual(4);
    expect(summary.byCategory['terminal']).toBeGreaterThanOrEqual(1);

    // Total should be sum of bySource
    const sourceSum = Object.values(summary.bySource).reduce((a, b) => a + b, 0);
    expect(summary.total).toBe(sourceSum);
  });

  it('getTool retrieves a specific managed tool', () => {
    const tool = toolManager.getTool('project.create');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('project.create');
    expect(tool!.source).toBe('app');
    expect(tool!.category).toBe('planning');
  });
});
