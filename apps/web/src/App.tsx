import { useState } from 'react';
import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { createWebRuntimeAdapter } from '@orbit/platform-web';
import { setTheme, getCurrentTheme, setStyleVariant } from '@orbit/ui-dom';
import type { OrbitThemeMode, OrbitStyleVariant } from '@orbit/ui-tokens';

const runtime = createWebRuntimeAdapter();
const CURRENT_DATE = '2026-04-09';

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

export default function App(): JSX.Element {
  const [themeMode, setThemeMode] = useState<OrbitThemeMode>(getCurrentTheme());
  const [styleVariant, setStyleVariantState] = useState<OrbitStyleVariant>(savedStyle);
  const [activeNav, setActiveNav] = useState('today');

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

  const focus = workbenchModule.shell.focus;
  const activeProject = workbenchModule.shell.activeProject;

  return (
    <div className="app">
      {/* ===== SIDEBAR ===== */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="10" cy="10" r="3"/>
            </svg>
            Orbit
          </div>
        </div>

        <div style={{ padding: '8px 10px' }}>
          <button className="sidebar-new-btn">
            <span>+</span> New Object
          </button>
        </div>

        <div className="sidebar-content">
          {workbenchModule.shell.sections.map((section) => (
            <div
              key={section.id}
              className={`sidebar-nav-item${activeNav === section.id ? ' active' : ''}`}
              onClick={() => setActiveNav(section.id)}
            >
              <span className="icon">
                {section.id === 'projects' ? '📁' :
                 section.id === 'tasks' ? '📋' :
                 section.id === 'today' ? '📅' :
                 section.id === 'focus' ? '🎯' : '📊'}
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
              <span className="icon" style={{ background: 'var(--type-project-bg)', color: 'var(--type-project-text)' }}>P</span>
              Projects
            </div>
            <div className="sidebar-nav-item" data-type="daily">
              <span className="icon" style={{ background: 'var(--type-daily-bg)', color: 'var(--type-daily-text)' }}>D</span>
              Daily Notes
            </div>
            <div className="sidebar-nav-item" data-type="atomic">
              <span className="icon" style={{ background: 'var(--type-atomic-bg)', color: 'var(--type-atomic-text)' }}>A</span>
              Atomic Notes
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
          <button className="icon-btn">👤</button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="main-content">
        <div className="page-nav active">
          <div className="page-header">
            <div className="page-header-left">
              <span className="page-title">
                {activeNav === 'today' ? 'Today' :
                 activeNav === 'focus' ? 'Focus' :
                 activeNav === 'review' ? 'Review' :
                 activeNav === 'projects' ? 'Projects' : 'Tasks'}
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
            </div>
          </div>

          <div className="tab-bar">
            <div className="tab-item active">Overview</div>
            <div className="tab-item">
              All <span className="tab-count"># {workbenchModule.shell.today.length}</span>
            </div>
          </div>

          <div className="page-body">
            <div className="page-body-content">
              {/* Planner summary */}
              <div className="object-card">
                <div className="object-card-header">
                  <span className="type-label project">📋 Planner</span>
                </div>
                <div className="object-card-title">{workbenchModule.shell.planner.summary}</div>
                <div className="object-card-body">
                  <p>{workbenchModule.shell.planner.intent}</p>
                </div>
              </div>

              {/* Today tasks */}
              {workbenchModule.shell.today.map((task) => (
                <div key={task.id} className="object-card">
                  <div className="object-card-header">
                    <span className={`type-label ${task.status === 'doing' ? 'atomic' : 'daily'}`}>
                      {task.status === 'doing' ? '🔥 Doing' : '📝 Todo'}
                    </span>
                  </div>
                  <div className="object-card-title">{task.title}</div>
                  <div className="object-card-footer">
                    <span className="tags-row">
                      <span className="tag-badge">{task.projectTitle ?? 'No project'}</span>
                      {task.focusRank != null && <span className="tag-badge">Focus #{task.focusRank}</span>}
                    </span>
                  </div>
                </div>
              ))}

              {/* Focus card */}
              {focus && (
                <div className="object-card" style={{ borderLeft: '3px solid var(--bg-button-primary)' }}>
                  <div className="object-card-header">
                    <span className="type-label project">🎯 Focus</span>
                  </div>
                  <div className="object-card-title">{focus.title}</div>
                  <div className="object-card-body">
                    <p>{focus.projectTitle} · rank {focus.focusRank}</p>
                  </div>
                </div>
              )}

              {/* Review section */}
              {workbenchModule.shell.review.completedToday.length > 0 && (
                <div className="object-card">
                  <div className="object-card-header">
                    <span className="type-label tag">📊 Review</span>
                  </div>
                  <div className="object-card-title">{workbenchModule.shell.review.summary}</div>
                  <div className="object-card-body">
                    {workbenchModule.shell.review.completedToday.map((t) => (
                      <p key={t.id}>✓ {t.title}</p>
                    ))}
                    {workbenchModule.shell.review.carryForward.map((t) => (
                      <p key={t.id}>→ {t.title}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ===== RIGHT PANEL ===== */}
            <div className="right-panel">
              <div className="right-panel-tabs">
                <div className="right-panel-tab active">Project</div>
                <div className="right-panel-tab">Graph view</div>
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
                        <span className="detail-prop-label">Status</span>
                        <span className="detail-prop-value">{activeProject.status}</span>
                      </div>
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
    </div>
  );
}
