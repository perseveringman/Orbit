import type { ProjectRecord, TaskRecord } from '@orbit/domain';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { createWebRuntimeAdapter } from '@orbit/platform-web';

const runtime = createWebRuntimeAdapter();
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

const capabilityList = runtime.capabilityHost.list();
const supportsWorkspace = runtime.capabilityHost.has('workspace');
const workbenchModule = createWorkbenchDomModule(workbenchInput);
const mountedWorkbench = mountWorkbench(workbenchInput);
const activeProject = workbenchModule.shell.activeProject;

const hostPanels = [
  {
    title: 'Project context',
    description: activeProject
      ? `${activeProject.openTaskCount} 个开放任务 · ${activeProject.todayCount} 个已经进入 Today。`
      : '当前没有活跃项目。',
    items: [
      `intent = ${workbenchModule.shell.planner.intent}`,
      `focus = ${workbenchModule.shell.focus?.title ?? '待选择'}`,
      `review signals = ${workbenchModule.slots.review.props.reviewItemCount}`
    ]
  },
  {
    title: 'Review snapshot',
    description: workbenchModule.shell.review.summary,
    items: [
      ...workbenchModule.shell.review.completedToday.map((task) => `completed · ${task.title}`),
      ...workbenchModule.shell.review.tasksNeedingReview.map((task) => `pending · ${task.title}`)
    ]
  }
] as const;

export default function App(): JSX.Element {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero__eyebrow">Orbit / Browser host</p>
        <div className="hero__content">
          <div>
            <h1>让 Web 保持轻量兼容入口，跟上新的 P0 project loop shell。</h1>
            <p className="hero__body">
              Browser host 不再构造 reader demo；这里只挂载 deterministic shell，并把浏览器 runtime 能力边界继续收在
              @orbit/platform-web。
            </p>
          </div>

          <dl className="hero__facts" aria-label="Web 宿主摘要">
            <div>
              <dt>当前意图</dt>
              <dd>{workbenchModule.shell.planner.intent}</dd>
            </div>
            <div>
              <dt>Today / Focus</dt>
              <dd>{workbenchModule.shell.focus?.title ?? '待选择'}</dd>
            </div>
            <div>
              <dt>挂载节点</dt>
              <dd>{mountedWorkbench.mountTarget}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="workspace-overview" aria-label="工作循环概览">
        <article className="workspace-overview__pane workspace-overview__pane--nav">
          <span className="pane__label">Planner</span>
          <h2>{workbenchModule.shell.planner.summary}</h2>
          <ul className="pane__list">
            {workbenchModule.shell.sections.map((section) => (
              <li key={section.id} className={section.active ? 'is-active' : ''}>
                <strong>{section.label}</strong>
                <span>{section.count} 个信号</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="workspace-overview__pane workspace-overview__pane--content">
          <span className="pane__label">Today / Focus</span>
          <h2>{workbenchModule.shell.focus?.title ?? '等待聚焦任务'}</h2>
          <p>
            hostKind = <strong>{mountedWorkbench.hostKind}</strong>，todayCount ={' '}
            <strong>{String(workbenchModule.shell.today.length).padStart(2, '0')}</strong>
          </p>
          <div className="article-stack">
            {workbenchModule.shell.today.map((task) => (
              <article key={task.id} className="article-card">
                <div className="article-card__meta">
                  <span>{task.status === 'doing' ? 'Doing' : 'Todo'}</span>
                  <span>{task.projectTitle ?? 'No project'}</span>
                </div>
                <h3>{task.title}</h3>
                <p>{task.focusRank ? `Focus rank ${task.focusRank}` : '进入 Today，等待排序。'}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="host-grid" aria-label="Web 宿主兼容层摘要">
        {hostPanels.map((panel) => (
          <article key={panel.title} className="host-card">
            <span className="host-card__eyebrow">{panel.title}</span>
            <p className="host-card__description">{panel.description}</p>
            <ul>
              {(panel.items.length > 0 ? panel.items : ['review queue is empty']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="runtime-strip" aria-label="浏览器平台能力">
        <div>
          <p className="runtime-strip__label">平台能力矩阵</p>
          <h2>{runtime.platform} runtime adapter</h2>
        </div>
        <ul>
          {(['workspace', 'database', 'sync', 'notification', 'auth', 'secure-store'] as const).map((capability) => (
            <li key={capability} data-enabled={runtime.capabilityHost.has(capability)}>
              <span>{capability}</span>
              <strong>{runtime.capabilityHost.has(capability) ? '可接入' : '暂不暴露'}</strong>
            </li>
          ))}
          <li data-enabled={supportsWorkspace}>
            <span>capability list</span>
            <strong>{capabilityList.join(', ') || 'none'}</strong>
          </li>
        </ul>
      </section>

      <section className="next-steps" aria-label="兼容宿主说明">
        <div>
          <p className="next-steps__label">Compatibility notes</p>
          <h2>{activeProject?.title ?? workbenchModule.shell.title}</h2>
        </div>
        <ol>
          {[
            '继续把浏览器路由、会话恢复与 PWA 生命周期保持在宿主壳层。',
            '等桌面 P0 画面稳定后，再把真实数据接入同一 shell input。',
            '移动端和 iOS 继续复用同一 deterministic seed 与 shell contract。'
          ].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
