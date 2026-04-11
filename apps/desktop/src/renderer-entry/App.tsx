import { useState, useEffect, useCallback } from 'react';

import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { createElectronRuntimeAdapter } from '@orbit/platform-electron';
import { setTheme, getCurrentTheme, setStyleVariant } from '@orbit/ui-dom';
import type { OrbitThemeMode, OrbitStyleVariant } from '@orbit/ui-tokens';

import { createFallbackDesktopBridge } from '../shared/contracts';
import { AgentDevTools } from './agent-devtools/AgentDevTools';

const CURRENT_DATE = '2026-04-09';
const ACTIVE_SECTION = 'today' as const;
const USER_INTENT = '交付 Orbit 桌面端 P0：让项目与任务自然落到 Today / Focus / Review。';
const FOCUS_BRIEF = `# Focus brief
先锁定唯一活跃项目与开放任务。
把 Today、Focus、Review 收拢成一张可信的桌面工作面。`;

const STYLE_VARIANTS: OrbitStyleVariant[] = ['default', 'notion', 'spaceship', 'library'];
const STYLE_LABELS: Record<OrbitStyleVariant, string> = {
  default: '🎨 Default',
  notion: '📝 Notion',
  spaceship: '🚀 Spaceship',
  library: '📚 Library'
};

const savedStyle = (typeof localStorage !== 'undefined'
  ? localStorage.getItem('orbit-style') as OrbitStyleVariant | null
  : null) ?? 'default';

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
  const [styleVariant, setStyleVariantState] = useState<OrbitStyleVariant>(savedStyle);
  const [activeNav, setActiveNav] = useState(ACTIVE_SECTION as string);
  const [showDevTools, setShowDevTools] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + Shift + A to toggle Agent DevTools
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setShowDevTools((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCloseDevTools = useCallback(() => setShowDevTools(false), []);

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

  const cycleStyle = () => {
    const currentIdx = STYLE_VARIANTS.indexOf(styleVariant);
    const next = STYLE_VARIANTS[(currentIdx + 1) % STYLE_VARIANTS.length];
    setStyleVariant(next);
    setStyleVariantState(next);
  };

  return (
    <div className="app">
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
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="10" r="3" />
            </svg>
            Orbit Desktop
          </div>
        </div>

        <div style={{ padding: '8px 10px' }}>
          <button className="sidebar-new-btn">
            <span>+</span> New Object
          </button>
        </div>

        <div className="sidebar-content">
          {workbench.shell.sections.map((section) => (
            <div
              key={section.id}
              className={`sidebar-nav-item${activeNav === section.id ? ' active' : ''}`}
              onClick={() => setActiveNav(section.id)}
            >
              <span className="icon">
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
              <span className="count">{section.count}</span>
            </div>
          ))}

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span>📦</span> Object types
            </div>
            <div className="sidebar-nav-item" data-type="project">
              <span className="icon" style={{ background: 'var(--type-project-bg)', color: 'var(--type-project-text)' }}>
                P
              </span>
              Projects
            </div>
            <div className="sidebar-nav-item" data-type="daily">
              <span className="icon" style={{ background: 'var(--type-daily-bg)', color: 'var(--type-daily-text)' }}>
                D
              </span>
              Daily Notes
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-divider" />
          <div className="sidebar-footer-item">🗑 Trash</div>
          <div className="sidebar-footer-item">📖 Documentation</div>
        </div>

        <div className="sidebar-bottom-icons">
          <button className="icon-btn">⚙️</button>
          <button className="icon-btn" onClick={toggleTheme}>
            {themeMode === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="icon-btn" onClick={cycleStyle} title={`Style: ${styleVariant}`}>
            {STYLE_LABELS[styleVariant].split(' ')[0]}
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowDevTools((v) => !v)}
            title="Agent DevTools (⌘⇧A)"
            style={showDevTools ? { background: 'var(--bg-button-primary)', borderRadius: 6 } : undefined}
          >
            🔬
          </button>
          <button className="icon-btn">👤</button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <span className="page-title">
              {activeNav === 'today'
                ? `Today · ${CURRENT_DATE}`
                : activeNav === 'focus'
                  ? 'Focus'
                  : activeNav === 'review'
                    ? 'Review'
                    : 'Tasks'}
            </span>
            <div className="page-header-nav">
              <button className="nav-arrow-btn">‹</button>
              <button className="today-btn">Today</button>
              <button className="nav-arrow-btn">›</button>
            </div>
          </div>
          <div className="page-header-right">
            <button className="toolbar-btn">🔍</button>
            <button className="toolbar-btn">⋯</button>
            <button className="btn-primary">+ New</button>
          </div>
        </div>

        <div className="tab-bar">
          <div className="tab-item active">Overview</div>
          <div className="tab-item">
            All <span className="tab-count"># {workbench.shell.today.length}</span>
          </div>
        </div>

        <div className="page-body">
          <div className="page-body-content">
            {/* Planner */}
            <div className="object-card">
              <div className="object-card-header">
                <span className="type-label project">📋 Planner</span>
              </div>
              <div className="object-card-title">{workbench.shell.planner.summary}</div>
              <div className="object-card-body">
                <p>{workbench.shell.planner.intent}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  {workbench.shell.planner.metrics.map((m) => (
                    <span key={m.id} className="tag-badge">
                      {m.label}: {m.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Today tasks */}
            {workbench.shell.today.map((task) => (
              <div key={task.id} className="object-card">
                <div className="object-card-header">
                  <span className={`type-label ${task.status === 'doing' ? 'atomic' : 'daily'}`}>
                    {task.status === 'doing' ? '🔥 进行中' : '📝 待做'}
                  </span>
                </div>
                <div className="object-card-title">{task.title}</div>
                <div className="object-card-footer">
                  <span className="tags-row">
                    <span className="tag-badge">{task.projectTitle ?? 'No project'}</span>
                    {task.focusRank && <span className="tag-badge">Focus #{task.focusRank}</span>}
                  </span>
                </div>
              </div>
            ))}

            {/* Focus */}
            {focus && (
              <div className="object-card" style={{ borderLeft: '3px solid var(--bg-button-primary)' }}>
                <div className="object-card-header">
                  <span className="type-label project">🎯 Focus</span>
                </div>
                <div className="object-card-title">{focus.title}</div>
                <div className="object-card-body">
                  <p>
                    {focus.projectTitle} · rank {focus.focusRank}
                  </p>
                  {workbench.editor.document.blocks.map((block) =>
                    block.kind === 'heading' ? (
                      <strong key={block.id} style={{ display: 'block', marginBottom: '8px' }}>
                        {block.text}
                      </strong>
                    ) : (
                      <p key={block.id} style={{ margin: '0 0 8px' }}>
                        {block.text}
                      </p>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Review */}
            <div className="object-card">
              <div className="object-card-header">
                <span className="type-label tag">📊 Review</span>
              </div>
              <div className="object-card-title">{workbench.shell.review.summary}</div>
              <div className="object-card-body">
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
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="right-panel">
            <div className="right-panel-tabs">
              <div className="right-panel-tab active">Project</div>
              <div className="right-panel-tab">Runtime</div>
            </div>
            <div className="right-panel-content">
              {activeProject ? (
                <div>
                  <div className="detail-type-label">
                    <span className="type-label project">📁 Project</span>
                  </div>
                  <div className="detail-title">{activeProject.title}</div>
                  <div className="detail-properties">
                    <div className="detail-prop">
                      <span className="detail-prop-label">Open tasks</span>
                      <span className="detail-prop-value">{activeProject.openTaskCount}</span>
                    </div>
                    <div className="detail-prop">
                      <span className="detail-prop-label">Today</span>
                      <span className="detail-prop-value">{activeProject.todayCount}</span>
                    </div>
                    <div className="detail-prop">
                      <span className="detail-prop-label">Done</span>
                      <span className="detail-prop-value">{activeProject.doneTaskCount}</span>
                    </div>
                  </div>

                  <div className="detail-backlinks-title">Runtime</div>
                  <div className="detail-properties">
                    <div className="detail-prop">
                      <span className="detail-prop-label">Platform</span>
                      <span className="detail-prop-value">{bridge.host.platform}</span>
                    </div>
                    <div className="detail-prop">
                      <span className="detail-prop-label">Electron</span>
                      <span className="detail-prop-value">{bridge.host.electronVersion}</span>
                    </div>
                    <div className="detail-prop">
                      <span className="detail-prop-label">Capabilities</span>
                      <span className="detail-prop-value">{capabilities.join(', ')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📁</div>
                  <div className="empty-state-title">No active project</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
