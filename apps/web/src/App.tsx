import { useState, type ReactElement } from 'react';
import { Button, Card, Chip, Tabs, Separator } from '@heroui/react';
import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { setTheme, getCurrentTheme, type OrbitThemeMode } from '@orbit/ui-dom';

const CURRENT_DATE = '2026-04-09';

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
    id: 'project-browser-shell',
    title: 'Orbit browser compatibility shell',
    lastReviewedAt: '2026-04-08T18:30:00.000Z'
  })
];

const seedTasks = [
  createTaskRecord({
    id: 'task-focus',
    projectId: 'project-browser-shell',
    title: 'Stay aligned with the desktop P0 shell contract',
    status: 'doing',
    todayOn: CURRENT_DATE,
    focusRank: 1,
    lastReviewedAt: '2026-04-09T08:30:00.000Z'
  }),
  createTaskRecord({
    id: 'task-today',
    projectId: 'project-browser-shell',
    title: 'Render planner, today, focus, and review summaries',
    status: 'todo',
    todayOn: CURRENT_DATE,
    focusRank: 2,
    lastReviewedAt: '2026-04-09T08:45:00.000Z'
  }),
  createTaskRecord({
    id: 'task-review',
    projectId: 'project-browser-shell',
    title: 'Document remaining browser-host follow-up',
    status: 'done',
    completedAt: '2026-04-09T10:20:00.000Z',
    lastReviewedAt: '2026-04-09T10:25:00.000Z'
  })
];

const workbenchInput = {
  host: {
    kind: 'web' as const,
    containerId: 'orbit-root'
  },
  locale: 'zh-CN' as const,
  activeSection: 'today' as const,
  currentDate: CURRENT_DATE,
  userIntent: '让 Browser host 保持轻量兼容入口，同时接上新的 P0 shell contract。',
  draft: '# Browser host\nKeep the web shell deterministic and secondary to desktop.',
  projects: seedProjects,
  tasks: seedTasks
};

const workbenchModule = createWorkbenchDomModule(workbenchInput);
mountWorkbench(workbenchInput);

export default function App(): ReactElement {
  const [themeMode, setThemeMode] = useState<OrbitThemeMode>(getCurrentTheme());
  const [activeNav, setActiveNav] = useState('today');

  const toggleTheme = () => {
    const next: OrbitThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeMode(next);
  };

  const focus = workbenchModule.shell.focus;
  const activeProject = workbenchModule.shell.activeProject;

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* ===== SIDEBAR ===== */}
      <aside className="flex flex-col w-60 border-r border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="10" cy="10" r="3"/>
            </svg>
            Orbit
          </div>
        </div>

        <div className="px-2.5 py-2">
          <Button variant="primary" fullWidth>+ New Object</Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {workbenchModule.shell.sections.map((section) => (
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
                {section.id === 'projects' ? '📁' :
                 section.id === 'tasks' ? '📋' :
                 section.id === 'today' ? '📅' :
                 section.id === 'focus' ? '🎯' : '📊'}
              </span>
              {section.label}
              <span className="ml-auto text-xs text-muted">{section.count}</span>
            </button>
          ))}

          <Separator />

          <div className="mt-2">
            <div className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-muted uppercase tracking-wider">
              <span>📦</span> Object types
            </div>
            <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-accent text-white">P</span>
              Projects
            </button>
            <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-success text-white">D</span>
              Daily Notes
            </button>
            <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-warning text-white">A</span>
              Atomic Notes
            </button>
          </div>
        </div>

        <div className="mt-auto">
          <Separator />
          <button className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-muted hover:bg-surface-secondary rounded-lg transition-colors">🗑 Trash</button>
          <button className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-muted hover:bg-surface-secondary rounded-lg transition-colors">📖 Documentation</button>
        </div>

        <div className="flex items-center gap-1 px-2 py-2 border-t border-border">
          <Button variant="ghost" isIconOnly size="sm">⚙️</Button>
          <Button variant="ghost" isIconOnly size="sm" onPress={toggleTheme}>
            {themeMode === 'light' ? '🌙' : '☀️'}
          </Button>
          <Button variant="ghost" isIconOnly size="sm">👤</Button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">
              {activeNav === 'today' ? 'Today' :
               activeNav === 'focus' ? 'Focus' :
               activeNav === 'review' ? 'Review' :
               activeNav === 'projects' ? 'Projects' : 'Tasks'}
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
          </div>
        </div>

        <Tabs>
          <Tabs.List>
            <Tabs.Tab id="overview">Overview</Tabs.Tab>
            <Tabs.Tab id="all">All # {workbenchModule.shell.today.length}</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Planner summary */}
            <Card>
              <Card.Header>
                <Chip variant="soft" color="accent">📋 Planner</Chip>
              </Card.Header>
              <Card.Title>{workbenchModule.shell.planner.summary}</Card.Title>
              <Card.Content>
                <p>{workbenchModule.shell.planner.intent}</p>
              </Card.Content>
            </Card>

            {/* Today tasks */}
            {workbenchModule.shell.today.map((task) => (
              <Card key={task.id}>
                <Card.Header>
                  <Chip variant="soft" color={task.status === 'doing' ? 'warning' : 'default'}>
                    {task.status === 'doing' ? '🔥 Doing' : '📝 Todo'}
                  </Chip>
                </Card.Header>
                <Card.Title>{task.title}</Card.Title>
                <Card.Footer>
                  <div className="flex flex-wrap gap-1">
                    <Chip size="sm" variant="soft">{task.projectTitle ?? 'No project'}</Chip>
                    {task.focusRank != null && <Chip size="sm" variant="soft">Focus #{task.focusRank}</Chip>}
                  </div>
                </Card.Footer>
              </Card>
            ))}

            {/* Focus card */}
            {focus && (
              <Card className="border-l-3 border-accent">
                <Card.Header>
                  <Chip variant="soft" color="accent">🎯 Focus</Chip>
                </Card.Header>
                <Card.Title>{focus.title}</Card.Title>
                <Card.Content>
                  <p>{focus.projectTitle} · rank {focus.focusRank}</p>
                </Card.Content>
              </Card>
            )}

            {/* Review section */}
            {workbenchModule.shell.review.completedToday.length > 0 && (
              <Card>
                <Card.Header>
                  <Chip variant="soft" color="success">📊 Review</Chip>
                </Card.Header>
                <Card.Title>{workbenchModule.shell.review.summary}</Card.Title>
                <Card.Content>
                  {workbenchModule.shell.review.completedToday.map((t) => (
                    <p key={t.id}>✓ {t.title}</p>
                  ))}
                  {workbenchModule.shell.review.carryForward.map((t) => (
                    <p key={t.id}>→ {t.title}</p>
                  ))}
                </Card.Content>
              </Card>
            )}
          </div>

          {/* ===== RIGHT PANEL ===== */}
          <div className="w-72 border-l border-border bg-surface overflow-y-auto shrink-0">
            <Tabs>
              <Tabs.List>
                <Tabs.Tab id="project">Project</Tabs.Tab>
                <Tabs.Tab id="graph">Graph view</Tabs.Tab>
              </Tabs.List>
            </Tabs>
            <div className="p-4">
              {activeProject ? (
                <div>
                  <Chip variant="soft" color="accent">📁 Project</Chip>
                  <h2 className="text-base font-semibold text-foreground mt-2">{activeProject.title}</h2>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Status</span>
                      <span className="text-foreground font-medium">{activeProject.status}</span>
                    </div>
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
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="text-4xl mb-2">📁</div>
                  <div className="text-sm text-muted">No active project</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
