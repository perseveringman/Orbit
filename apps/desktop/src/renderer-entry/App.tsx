import type { CSSProperties } from 'react';

import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { createElectronRuntimeAdapter } from '@orbit/platform-electron';

import { createFallbackDesktopBridge } from '../shared/contracts';

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

const PROJECT_STATUS_LABELS: Record<ProjectRecord['status'], string> = {
  active: '进行中',
  done: '完成',
  archived: '归档'
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

function isOpenTask(task: Pick<TaskRecord, 'status'>): boolean {
  return task.status === 'todo' || task.status === 'doing';
}

function formatProjectSummary(project: {
  openTaskCount: number;
  todayCount: number;
  doneTaskCount: number;
}): string {
  return `${project.openTaskCount} 个开放任务 · ${project.todayCount} 个已经进入 Today · ${project.doneTaskCount} 个已完成`;
}

function createSectionBadgeStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '999px',
    background: active ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.88)',
    border: active ? '1px solid rgba(56, 189, 248, 0.48)' : '1px solid rgba(148, 163, 184, 0.18)',
    color: active ? '#f8fafc' : '#cbd5e1',
    fontSize: '13px'
  };
}

function createStatusChipStyle(accentColor: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    background: `${accentColor}22`,
    border: `1px solid ${accentColor}66`,
    color: '#e2e8f0',
    fontSize: '12px'
  };
}

export function App() {
  const bridge = window.orbitDesktop ?? createFallbackDesktopBridge();
  const shellDescriptor = bridge.describeShell();
  const runtime = createElectronRuntimeAdapter();
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
  const activeProjectBacklog = workbench.shell.tasks.filter(
    (task) => task.projectId === activeProject?.id && isOpenTask(task)
  );
  const pendingReviewCount =
    workbench.shell.review.projectsNeedingReview.length + workbench.shell.review.tasksNeedingReview.length;

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    padding: '24px',
    background: 'linear-gradient(180deg, rgba(10,15,30,1) 0%, rgba(17,24,39,1) 100%)',
    color: '#f8fafc',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  };
  const panelStyle: CSSProperties = {
    padding: '20px',
    borderRadius: '18px',
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 18px 48px rgba(2, 6, 23, 0.28)'
  };
  const kickerStyle: CSSProperties = {
    margin: '0 0 10px',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  };
  const mutedBodyStyle: CSSProperties = {
    margin: 0,
    color: '#cbd5e1',
    lineHeight: 1.6
  };
  const resetListStyle: CSSProperties = {
    margin: 0,
    padding: 0,
    listStyle: 'none'
  };

  return (
    <main style={pageStyle}>
      <section
        style={{
          ...panelStyle,
          marginBottom: '18px',
          background: 'linear-gradient(135deg, rgba(8, 47, 73, 0.88) 0%, rgba(15, 23, 42, 0.92) 55%, rgba(30, 41, 59, 0.92) 100%)'
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: '18px',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.9fr)',
            alignItems: 'start'
          }}
        >
          <div>
            <p style={kickerStyle}>Orbit desktop P0</p>
            <h1 style={{ margin: '0 0 12px', fontSize: '36px', lineHeight: 1.05 }}>
              项目 + 任务 → Today / Focus → Review
            </h1>
            <p style={{ ...mutedBodyStyle, fontSize: '18px', marginBottom: '12px' }}>
              {workbench.shell.planner.intentLabel}：{workbench.shell.planner.intent}
            </p>
            <p style={mutedBodyStyle}>{workbench.shell.planner.summary}</p>
          </div>

          <div
            style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'rgba(15, 23, 42, 0.62)',
              border: '1px solid rgba(148, 163, 184, 0.2)'
            }}
          >
            <p style={kickerStyle}>Current shell</p>
            <h2 style={{ margin: '0 0 8px', fontSize: '24px' }}>{workbench.shell.title}</h2>
            <p style={mutedBodyStyle}>
              日期 {workbench.shell.planner.currentDate} · mount = {mountedWorkbench.mountTarget}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
              {workbench.shell.sections.map((section) => (
                <span key={section.id} style={createSectionBadgeStyle(section.active)}>
                  {section.label} · {section.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '12px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            marginTop: '18px'
          }}
        >
          {workbench.shell.planner.metrics.map((metric) => (
            <article
              key={metric.id}
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1px solid rgba(148, 163, 184, 0.18)'
              }}
            >
              <span style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '12px' }}>
                {metric.label}
              </span>
              <strong style={{ fontSize: '24px' }}>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(360px, 1.2fr) minmax(280px, 0.95fr)',
          alignItems: 'start'
        }}
      >
        <article style={panelStyle}>
          <p style={kickerStyle}>Project / backlog</p>
          {activeProject ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '24px' }}>{activeProject.title}</h2>
                <span style={createStatusChipStyle('#38bdf8')}>
                  {PROJECT_STATUS_LABELS[activeProject.status]}
                </span>
              </div>
              <p style={{ ...mutedBodyStyle, marginTop: '10px', marginBottom: '18px' }}>
                {formatProjectSummary(activeProject)}
              </p>
              <ul style={{ ...resetListStyle, display: 'grid', gap: '10px' }}>
                {activeProjectBacklog.map((task) => (
                  <li
                    key={task.id}
                    style={{
                      padding: '14px',
                      borderRadius: '14px',
                      background: 'rgba(30, 41, 59, 0.72)',
                      border: '1px solid rgba(148, 163, 184, 0.16)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '8px'
                      }}
                    >
                      <strong>{task.title}</strong>
                      <span
                        style={createStatusChipStyle(task.status === 'doing' ? '#22c55e' : '#f59e0b')}
                      >
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                      {task.isToday
                        ? `Today · focus rank ${task.focusRank ?? '—'}`
                        : task.isCarryForward
                          ? `需要延续 · 昨日承接`
                          : '仍在 backlog 中'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={mutedBodyStyle}>当前没有活跃项目。</p>
          )}
        </article>

        <div style={{ display: 'grid', gap: '16px' }}>
          <article style={panelStyle}>
            <p style={kickerStyle}>Today</p>
            <h2 style={{ margin: '0 0 14px', fontSize: '24px' }}>今天只保留 {workbench.shell.today.length} 个清晰动作</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {workbench.shell.today.map((task) => (
                <article
                  key={task.id}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'rgba(8, 47, 73, 0.32)',
                    border: '1px solid rgba(56, 189, 248, 0.18)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginBottom: '8px'
                    }}
                  >
                    <strong>{task.title}</strong>
                    <span style={createStatusChipStyle(task.status === 'doing' ? '#22c55e' : '#38bdf8')}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  <p style={{ ...mutedBodyStyle, fontSize: '14px' }}>
                    {task.projectTitle ?? '未归属项目'} · focus rank {task.focusRank ?? '—'}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article style={panelStyle}>
            <p style={kickerStyle}>Focus</p>
            {focus ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <h2 style={{ margin: 0, fontSize: '24px' }}>{focus.title}</h2>
                  <span style={createStatusChipStyle('#22c55e')}>{TASK_STATUS_LABELS[focus.status]}</span>
                </div>
                <p style={{ ...mutedBodyStyle, marginTop: '10px', marginBottom: '14px' }}>
                  {focus.projectTitle ?? '未归属项目'} · focus rank {focus.focusRank ?? '—'} · Today
                </p>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'rgba(30, 41, 59, 0.72)',
                    border: '1px solid rgba(148, 163, 184, 0.16)'
                  }}
                >
                  {workbench.editor.document.blocks.map((block) =>
                    block.kind === 'heading' ? (
                      <strong key={block.id} style={{ display: 'block', marginBottom: '10px', fontSize: '15px' }}>
                        {block.text}
                      </strong>
                    ) : (
                      <p key={block.id} style={{ ...mutedBodyStyle, marginBottom: '10px', fontSize: '14px' }}>
                        {block.text}
                      </p>
                    )
                  )}
                </div>
              </>
            ) : (
              <p style={mutedBodyStyle}>今天还没有进入 Focus 的任务。</p>
            )}
          </article>
        </div>

        <article style={panelStyle}>
          <p style={kickerStyle}>Review</p>
          <h2 style={{ margin: '0 0 14px', fontSize: '24px' }}>{workbench.shell.review.summary}</h2>

          <div style={{ display: 'grid', gap: '14px' }}>
            <section>
              <strong style={{ display: 'block', marginBottom: '8px' }}>今日完成</strong>
              <ul style={{ ...resetListStyle, display: 'grid', gap: '8px' }}>
                {workbench.shell.review.completedToday.map((task) => (
                  <li key={task.id} style={{ color: '#cbd5e1' }}>
                    {task.title}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <strong style={{ display: 'block', marginBottom: '8px' }}>需要延续</strong>
              <ul style={{ ...resetListStyle, display: 'grid', gap: '8px' }}>
                {workbench.shell.review.carryForward.map((task) => (
                  <li key={task.id} style={{ color: '#cbd5e1' }}>
                    {task.title}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <strong style={{ display: 'block', marginBottom: '8px' }}>待回顾信号 · {pendingReviewCount}</strong>
              <ul style={{ ...resetListStyle, display: 'grid', gap: '8px' }}>
                {workbench.shell.review.projectsNeedingReview.map((project) => (
                  <li key={project.id} style={{ color: '#cbd5e1' }}>
                    项目 · {project.title}
                  </li>
                ))}
                {workbench.shell.review.tasksNeedingReview.map((task) => (
                  <li key={task.id} style={{ color: '#cbd5e1' }}>
                    任务 · {task.title}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </section>

      <footer
        style={{
          ...panelStyle,
          marginTop: '18px',
          display: 'grid',
          gap: '14px',
          gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(0, 1.1fr)',
          background: 'rgba(2, 6, 23, 0.72)'
        }}
      >
        <div>
          <p style={kickerStyle}>Runtime status</p>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>
            {bridge.host.platform} / Electron {bridge.host.electronVersion}
          </h2>
          <p style={mutedBodyStyle}>
            shell slots = {workbench.slots.planner.name}, {workbench.slots.workspace.name}, {workbench.slots.review.name}
          </p>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {capabilities.map((capability) => (
              <span key={capability} style={createSectionBadgeStyle(true)}>
                {capability}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {shellDescriptor.layers.map((layer) => (
              <span key={layer.id} style={createSectionBadgeStyle(false)}>
                {layer.id} · {layer.responsibility}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
