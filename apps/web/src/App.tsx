import type { ReaderArticleSummary, WorkspaceSection } from '@orbit/app-viewmodels';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { createWebRuntimeAdapter } from '@orbit/platform-web';

const runtime = createWebRuntimeAdapter();

const seedArticles: ReaderArticleSummary[] = [
  {
    id: 'article-host-shell',
    title: 'Web 宿主只负责装配，不重复实现共享工作台。',
    excerpt: 'Browser host 提供容器、路由入口与浏览器能力边界，DOM 工作台由共享包统一输出。',
    isRead: false,
    updatedAt: '2026-04-09T10:00:00.000Z'
  },
  {
    id: 'article-runtime-boundary',
    title: '平台差异进入 @orbit/platform-web，不进入业务壳层。',
    excerpt: '通知、分享、剪贴板、PWA 生命周期等能力通过平台适配层向上暴露。',
    isRead: true,
    updatedAt: '2026-04-08T08:30:00.000Z'
  }
];

const initialSection: WorkspaceSection = 'inbox';
const capabilityList = runtime.capabilityHost.list();
const supportsWorkspace = runtime.capabilityHost.has('workspace');

const workbenchModule = createWorkbenchDomModule({
  host: {
    kind: 'web',
    containerId: 'orbit-root'
  },
  locale: 'zh-CN',
  activeSection: initialSection,
  searchQuery: '',
  draft: '# Orbit Web Host\n\n这里保留给浏览器侧路由、会话恢复、分享落地页与 PWA 接入。',
  articles: [...seedArticles]
});

const mountedWorkbench = mountWorkbench({
  host: {
    kind: 'web',
    containerId: 'orbit-root'
  },
  locale: 'zh-CN',
  activeSection: initialSection,
  searchQuery: '',
  draft: 'Web host bootstrap ready.',
  articles: [...seedArticles]
});

const hostPanels = [
  {
    title: '宿主职责',
    description:
      'Browser host 负责路由、会话恢复、PWA 生命周期和浏览器权限装配；平台差异通过 @orbit/platform-web 暴露。',
    items: [
      `runtime = ${runtime.platform}`,
      `capabilities = ${capabilityList.join(', ') || 'none'}`,
      `workspace capability = ${supportsWorkspace ? 'enabled' : 'disabled'}`
    ]
  },
  {
    title: '共享工作台能力',
    description: 'Web 只挂载共享 DOM workbench，不在应用壳层复制业务实现。',
    items: workbenchModule.shell.sections.map((section) => section.label)
  }
] as const;

export default function App(): JSX.Element {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero__eyebrow">Orbit / Browser Host</p>
        <div className="hero__content">
          <div>
            <h1>为共享 DOM workbench 预留清晰、稳定、可扩展的 Web 宿主入口。</h1>
            <p className="hero__body">
              当前阶段只完成宿主壳层脚手架：约束浏览器平台边界、保留后续路由与会话接线位置，并最小化挂载
              @orbit/feature-workbench 与 @orbit/platform-web 的 public API。
            </p>
          </div>

          <dl className="hero__facts" aria-label="Web 宿主摘要">
            <div>
              <dt>挂载节点</dt>
              <dd>{mountedWorkbench.mountTarget}</dd>
            </div>
            <div>
              <dt>运行模式</dt>
              <dd>client-side</dd>
            </div>
            <div>
              <dt>共享模块标题</dt>
              <dd>{workbenchModule.shell.title}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="workspace-overview" aria-label="宿主布局概览">
        <article className="workspace-overview__pane workspace-overview__pane--nav">
          <span className="pane__label">工作台导航</span>
          <h2>{workbenchModule.shell.searchPlaceholder}</h2>
          <ul className="pane__list">
            {workbenchModule.shell.sections.map((section) => (
              <li key={section.id} className={section.id === initialSection ? 'is-active' : ''}>
                <strong>{section.label}</strong>
                <span>{section.count} 篇候选内容</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="workspace-overview__pane workspace-overview__pane--content">
          <span className="pane__label">宿主预览</span>
          <h2>共享工作台在 Web 的最小挂载结果</h2>
          <p>
            hostKind = <strong>{mountedWorkbench.hostKind}</strong>，articleCount ={' '}
            <strong>{String(mountedWorkbench.shell.filteredArticles.length).padStart(2, '0')}</strong>
          </p>
          <div className="article-stack">
            {workbenchModule.shell.filteredArticles.map((article) => (
              <article key={article.id} className="article-card">
                <div className="article-card__meta">
                  <span>{article.isRead ? '已读' : '待读'}</span>
                  <span>{new Date(article.updatedAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="host-grid" aria-label="Web 宿主边界与扩展点">
        {hostPanels.map((panel) => (
          <article key={panel.title} className="host-card">
            <span className="host-card__eyebrow">{panel.title}</span>
            <p className="host-card__description">{panel.description}</p>
            <ul>
              {panel.items.map((item) => (
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
        </ul>
      </section>

      <section className="next-steps" aria-label="后续迭代入口">
        <div>
          <p className="next-steps__label">下一阶段</p>
          <h2>把宿主脚手架继续长成真正的 Browser host。</h2>
        </div>
        <ol>
          {[
            '接入浏览器路由与 URL 状态同步。',
            '补上会话恢复、分享落地页、离线缓存与 PWA 安装入口。',
            '把真实浏览器能力通过 @orbit/platform-web 持续收口。'
          ].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
