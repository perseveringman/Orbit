import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Chip, Tabs, Separator } from '@heroui/react';

import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { createElectronRuntimeAdapter } from '@orbit/platform-electron';
import { setTheme, getCurrentTheme, type OrbitThemeMode } from '@orbit/ui-dom';

import { createFallbackDesktopBridge } from '../shared/contracts';
import { AgentDevTools } from './agent-devtools/AgentDevTools';
import { AgentHub } from './agent-hub/AgentHub';

const CURRENT_DATE = '2026-04-09';
const ACTIVE_SECTION = 'today' as const;
const USER_INTENT = '交付 Orbit 桌面端 P0：让项目与任务自然落到 Today / Focus / Review。';
const FOCUS_BRIEF = `# Focus brief
先锁定唯一活跃项目与开放任务。
把 Today、Focus、Review 收拢成一张可信的桌面工作面。`;

const TASK_STATUS_LABELS: Record<TaskRecord['status'], string> = {
  todo: '待做',
  doing: '进行中',
  done: '已完成',
  canceled: '已取消'
};

function createProjectRecord(overrides: Partial<ProjectRecord> & Pick<ProjectRecord, 'id' | 'title'>): ProjectRecord {
  return {
    kind: 'project',
    id: overrides.id,
    workspaceId: 'orbit-workspace',
    title: overrides.title,
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt ?? '2026-04-01T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-01T09:00:00.000Z',
    deletedAt: overrides.deletedAt,
    lastReviewedAt: overrides.lastReviewedAt ?? null
  };
}

function createTaskRecord(overrides: Partial<TaskRecord> & Pick<TaskRecord, 'id' | 'title'>): TaskRecord {
  return {
    kind: 'task',
    id: overrides.id,
    workspaceId: 'orbit-workspace',
    projectId: overrides.projectId ?? null,
    title: overrides.title,
    status: overrides.status ?? 'todo',
    createdAt: overrides.createdAt ?? '2026-04-01T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-01T09:00:00.000Z',
    deletedAt: overrides.deletedAt,
    todayOn: overrides.todayOn ?? null,
    focusRank: overrides.focusRank ?? null,
    completedAt: overrides.completedAt ?? null,
    lastReviewedAt: overrides.lastReviewedAt ?? null
  };
}

const seedProjects = [
  createProjectRecord({
    id: 'project-orbit-p0',
    title: 'Orbit reboot / Desktop P0 slice',
    lastReviewedAt: '2026-04-08T18:00:00.000Z'
  }),
  createProjectRecord({
    id: 'project-reader-cleanup',
    title: 'Reader shell cleanup',
    status: 'done',
    lastReviewedAt: '2026-04-09T08:10:00.000Z'
  })
] as const;

const seedTasks = [
  createTaskRecord({
    id: 'task-workbench-shell',
    projectId: 'project-orbit-p0',
    title: 'Wire desktop workbench shell',
    status: 'doing',
    todayOn: CURRENT_DATE,
    focusRank: 1,
    lastReviewedAt: '2026-04-09T08:30:00.000Z'
  }),
  createTaskRecord({
    id: 'task-review-cards',
    projectId: 'project-orbit-p0',
    title: 'Polish Today / Review presentation',
    status: 'todo',
    todayOn: CURRENT_DATE,
    focusRank: 2,
    lastReviewedAt: '2026-04-09T08:45:00.000Z'
  }),
  createTaskRecord({
    id: 'task-compat-shells',
    projectId: 'project-orbit-p0',
    title: 'Rewire web, mobile, and iOS compatibility shells',
    status: 'todo',
    todayOn: '2026-04-08',
    focusRank: 3,
    lastReviewedAt: null
  }),
  createTaskRecord({
    id: 'task-reader-demo',
    projectId: 'project-orbit-p0',
    title: 'Retire reader-shaped demo cards',
    status: 'done',
    completedAt: '2026-04-09T10:30:00.000Z',
    lastReviewedAt: '2026-04-09T10:45:00.000Z'
  }),
  createTaskRecord({
    id: 'task-smoke-check',
    projectId: 'project-orbit-p0',
    title: 'Run targeted checks before broad verification',
    status: 'todo',
    lastReviewedAt: '2026-04-08T16:00:00.000Z'
  })
] as const;

export function App() {
  const bridge = window.orbitDesktop ?? createFallbackDesktopBridge();
  const shellDescriptor = bridge.describeShell();
  const runtime = createElectronRuntimeAdapter();

  const [themeMode, setThemeMode] = useState<OrbitThemeMode>(getCurrentTheme());
  const [activeNav, setActiveNav] = useState(ACTIVE_SECTION as string);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showAgentHub, setShowAgentHub] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + Shift + A to toggle Agent Hub
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setShowAgentHub((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCloseDevTools = useCallback(() => setShowDevTools(false), []);
  const handleCloseAgentHub = useCallback(() => setShowAgentHub(false), []);

  const workbenchInput = {
    host: {
      kind: 'desktop' as const,
      containerId: shellDescriptor.rendererMountId
    },
    locale: 'zh-CN' as const,
    activeSection: ACTIVE_SECTION,
    currentDate: CURRENT_DATE,
    userIntent: USER_INTENT,
    draft: FOCUS_BRIEF,
    projects: seedProjects,
    tasks: seedTasks
  };
  const workbench = createWorkbenchDomModule(workbenchInput);
  const mountedWorkbench = mountWorkbench(workbenchInput);
  const capabilities = runtime.capabilityHost.list();
  const focus = workbench.shell.focus;
  const activeProject = workbench.shell.activeProject;

  const toggleTheme = () => {
    const next: OrbitThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeMode(next);
  };

  // If Agent Hub is active, render it full-screen
  if (showAgentHub) {
    return <AgentHub onClose={handleCloseAgentHub} />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* ===== AGENT DEVTOOLS PANEL ===== */}
      {showDevTools && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 520,
            height: '100vh',
            zIndex: 9999,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
          }}
        >
          <AgentDevTools onClose={handleCloseDevTools} />
        </div>
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className="flex flex-col w-60 border-r border-border bg-surface shrink-0">
        <div data-titlebar className="flex items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="10" r="3" />
            </svg>
            Orbit Desktop
          </div>
        </div>

        <div className="px-2 pb-2">
          <Button variant="primary" fullWidth>+ New Object</Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {workbench.shell.sections.map((section) => (
            <button
              key={section.id}
              className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                activeNav === section.id
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-muted hover:bg-surface-secondary'
              }`}
              onClick={() => setActiveNav(section.id)}
            >
              <span>
                {section.id === 'projects'
                  ? '📁'
                  : section.id === 'tasks'
                    ? '📋'
                    : section.id === 'today'
                      ? '📅'
                      : section.id === 'focus'
                        ? '🎯'
                        : '📊'}
              </span>
              {section.label}
              <span className="ml-auto text-xs text-muted">{section.count}</span>
            </button>
          ))}

          <Separator />

          <div className="mt-2">
            <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-muted uppercase tracking-wide">
              <span>📦</span> Object types
            </div>
            <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
              <Chip size="sm" variant="soft" color="accent">P</Chip>
              Projects
            </button>
            <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
              <Chip size="sm" variant="soft" color="default">D</Chip>
              Daily Notes
            </button>
          </div>
        </div>

        <div className="px-2 pb-2">
          <Separator />
          <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
            🗑 Trash
          </button>
          <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
            📖 Documentation
          </button>
        </div>

        <div className="flex items-center justify-center gap-1 px-2 py-2 border-t border-border">
          <Button variant="ghost" isIconOnly size="sm">⚙️</Button>
          <Button variant="ghost" isIconOnly size="sm" onPress={toggleTheme}>
            {themeMode === 'light' ? '🌙' : '☀️'}
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            onPress={() => setShowAgentHub(true)}
            aria-label="Agent Hub (⌘⇧A)"
          >
            🤖
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            onPress={() => setShowDevTools((v) => !v)}
            aria-label="Agent DevTools"
            className={showDevTools ? 'bg-accent rounded-md' : undefined}
          >
            🔬
          </Button>
          <Button variant="ghost" isIconOnly size="sm">👤</Button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">
              {activeNav === 'today'
                ? `Today · ${CURRENT_DATE}`
                : activeNav === 'focus'
                  ? 'Focus'
                  : activeNav === 'review'
                    ? 'Review'
                    : 'Tasks'}
            </h1>
            <div className="flex items-center gap-1">
              <Button variant="ghost" isIconOnly size="sm">‹</Button>
              <Button variant="secondary" size="sm">Today</Button>
              <Button variant="ghost" isIconOnly size="sm">›</Button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" isIconOnly size="sm">🔍</Button>
            <Button variant="ghost" isIconOnly size="sm">⋯</Button>
            <Button variant="primary" size="sm">+ New</Button>
          </div>
        </div>

        <Tabs className="px-6 pt-2">
          <Tabs.List>
            <Tabs.Tab>Overview</Tabs.Tab>
            <Tabs.Tab>{`All # ${workbench.shell.today.length}`}</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Planner */}
            <Card>
              <Card.Header>
                <Chip variant="soft" color="accent">📋 Planner</Chip>
              </Card.Header>
              <Card.Content>
                <Card.Title>{workbench.shell.planner.summary}</Card.Title>
                <Card.Description>{workbench.shell.planner.intent}</Card.Description>
                <div className="flex flex-wrap gap-2 mt-3">
                  {workbench.shell.planner.metrics.map((m) => (
                    <Chip key={m.id} size="sm" variant="soft">
                      {m.label}: {m.value}
                    </Chip>
                  ))}
                </div>
              </Card.Content>
            </Card>

            {/* Today tasks */}
            {workbench.shell.today.map((task) => (
              <Card key={task.id}>
                <Card.Header>
                  <Chip
                    variant="soft"
                    color={task.status === 'doing' ? 'warning' : 'default'}
                  >
                    {task.status === 'doing' ? '🔥 进行中' : '📝 待做'}
                  </Chip>
                </Card.Header>
                <Card.Content>
                  <Card.Title>{task.title}</Card.Title>
                </Card.Content>
                <Card.Footer>
                  <div className="flex flex-wrap gap-2">
                    <Chip size="sm" variant="soft">{task.projectTitle ?? 'No project'}</Chip>
                    {task.focusRank && <Chip size="sm" variant="soft">Focus #{task.focusRank}</Chip>}
                  </div>
                </Card.Footer>
              </Card>
            ))}

            {/* Focus */}
            {focus && (
              <Card className="border-l-3 border-accent">
                <Card.Header>
                  <Chip variant="soft" color="accent">🎯 Focus</Chip>
                </Card.Header>
                <Card.Content>
                  <Card.Title>{focus.title}</Card.Title>
                  <Card.Description>
                    {focus.projectTitle} · rank {focus.focusRank}
                  </Card.Description>
                  <div className="mt-2">
                    {workbench.editor.document.blocks.map((block) =>
                      block.kind === 'heading' ? (
                        <strong key={block.id} className="block mb-2">
                          {block.text}
                        </strong>
                      ) : (
                        <p key={block.id} className="mb-2">
                          {block.text}
                        </p>
                      )
                    )}
                  </div>
                </Card.Content>
              </Card>
            )}

            {/* Review */}
            <Card>
              <Card.Header>
                <Chip variant="soft" color="success">📊 Review</Chip>
              </Card.Header>
              <Card.Content>
                <Card.Title>{workbench.shell.review.summary}</Card.Title>
                <div className="mt-2 space-y-1 text-sm">
                  {workbench.shell.review.completedToday.map((t) => (
                    <p key={t.id}>✓ {t.title}</p>
                  ))}
                  {workbench.shell.review.carryForward.map((t) => (
                    <p key={t.id}>→ {t.title}</p>
                  ))}
                  {workbench.shell.review.tasksNeedingReview.map((t) => (
                    <p key={t.id}>⚠ 任务 · {t.title}</p>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-72 border-l border-border bg-surface overflow-y-auto shrink-0">
            <Tabs className="px-4 pt-3">
              <Tabs.List>
                <Tabs.Tab>Project</Tabs.Tab>
                <Tabs.Tab>Runtime</Tabs.Tab>
              </Tabs.List>
            </Tabs>
            <div className="p-4">
              {activeProject ? (
                <div>
                  <Chip variant="soft" color="accent">📁 Project</Chip>
                  <h2 className="text-base font-semibold text-foreground mt-2">{activeProject.title}</h2>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Open tasks</span>
                      <span className="text-foreground font-medium">{activeProject.openTaskCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Today</span>
                      <span className="text-foreground font-medium">{activeProject.todayCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Done</span>
                      <span className="text-foreground font-medium">{activeProject.doneTaskCount}</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Runtime</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Platform</span>
                      <span className="text-foreground font-medium">{bridge.host.platform}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Electron</span>
                      <span className="text-foreground font-medium">{bridge.host.electronVersion}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Capabilities</span>
                      <span className="text-foreground font-medium">{capabilities.join(', ')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted">
                  <div className="text-3xl mb-2">📁</div>
                  <div className="text-sm">No active project</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
