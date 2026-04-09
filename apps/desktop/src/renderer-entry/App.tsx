import type { ReaderArticleSummary, WorkspaceSection } from '@orbit/app-viewmodels';
import { createWorkbenchDomModule, mountWorkbench } from '@orbit/feature-workbench';
import { createElectronRuntimeAdapter } from '@orbit/platform-electron';

import {
  createDesktopShellDescriptor,
  createFallbackDesktopBridge
} from '../shared/contracts';

export function App() {
  const bridge = window.orbitDesktop ?? createFallbackDesktopBridge();
  const shellDescriptor = createDesktopShellDescriptor();
  const runtime = createElectronRuntimeAdapter();
  const seedArticles: ReaderArticleSummary[] = [
    {
      id: 'desktop-workspace-shell',
      title: '桌面宿主掌管真实工作区、窗口与本地能力。',
      excerpt: 'Electron host 不承载业务真相，但负责提供文件系统、窗口与常驻任务能力。',
      isRead: false,
      updatedAt: '2026-04-09T10:30:00.000Z'
    },
    {
      id: 'desktop-runtime-boundary',
      title: '平台差异通过 @orbit/platform-electron 暴露给上层。',
      excerpt: 'Renderer 只消费平台适配器，不直接触碰 Electron 原生对象。',
      isRead: true,
      updatedAt: '2026-04-08T09:00:00.000Z'
    }
  ];
  const activeSection: WorkspaceSection = 'inbox';
  const workbench = createWorkbenchDomModule({
    host: {
      kind: 'desktop',
      containerId: shellDescriptor.rendererMountId
    },
    locale: 'zh-CN',
    activeSection,
    searchQuery: '',
    draft: '# Orbit Desktop Host\n\n这里预留给桌面端工作区、窗口布局与命令面板装配。',
    articles: seedArticles
  });
  const mountedWorkbench = mountWorkbench({
    host: {
      kind: 'desktop',
      containerId: shellDescriptor.rendererMountId
    },
    locale: 'zh-CN',
    activeSection,
    searchQuery: '',
    draft: 'Desktop host bootstrap ready.',
    articles: seedArticles
  });
  const capabilities = runtime.capabilityHost.list();

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px',
        background:
          'linear-gradient(180deg, rgba(11,16,32,1) 0%, rgba(18,26,48,1) 100%)',
        color: '#f8fafc',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
      }}
    >
      <section
        style={{
          marginBottom: '24px',
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.72)',
          border: '1px solid rgba(148, 163, 184, 0.2)'
        }}
      >
        <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.08em' }}>
          ORBIT DESKTOP HOST
        </p>
        <h1 style={{ margin: '0 0 12px', fontSize: '28px' }}>
          Electron 宿主只负责装配，不承载业务真相
        </h1>
        <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
          当前 renderer-entry 只做三件事：读取 preload 暴露的安全桥接、注入
          platform-electron 适配器、挂载 feature-workbench 工作台。
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          marginBottom: '24px'
        }}
      >
        {shellDescriptor.layers.map((layer) => (
          <article
            key={layer.id}
            style={{
              padding: '16px',
              borderRadius: '14px',
              background: 'rgba(30, 41, 59, 0.72)',
              border: '1px solid rgba(148, 163, 184, 0.18)'
            }}
          >
            <strong style={{ display: 'block', marginBottom: '8px' }}>{layer.id}</strong>
            <span style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{layer.responsibility}</span>
          </article>
        ))}
      </section>

      <section
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: '1.1fr 1.4fr',
          marginBottom: '24px'
        }}
      >
        <article
          style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.08em' }}>
            WORKBENCH SHELL
          </p>
          <h2 style={{ margin: '0 0 12px' }}>{workbench.shell.title}</h2>
          <p style={{ margin: '0 0 16px', color: '#cbd5e1', lineHeight: 1.6 }}>
            搜索占位：{workbench.shell.searchPlaceholder}
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1' }}>
            {workbench.shell.sections.map((section) => (
              <li key={section.id}>
                {section.label} · {section.count} 项
              </li>
            ))}
          </ul>
        </article>

        <article
          style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.08em' }}>
            HOST RUNTIME
          </p>
          <h2 style={{ margin: '0 0 12px' }}>
            {runtime.platform} / mount = {mountedWorkbench.mountTarget}
          </h2>
          <ul style={{ margin: '0 0 16px', paddingLeft: '18px', color: '#cbd5e1' }}>
            {capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
          <div style={{ display: 'grid', gap: '12px' }}>
            {workbench.shell.filteredArticles.map((article) => (
              <article
                key={article.id}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.72)',
                  border: '1px solid rgba(148, 163, 184, 0.18)'
                }}
              >
                <strong style={{ display: 'block', marginBottom: '8px' }}>{article.title}</strong>
                <span style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{article.excerpt}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <footer style={{ marginTop: '24px', color: '#94a3b8', fontSize: '14px' }}>
        桥接状态：{bridge.host.platform} / Electron {bridge.host.electronVersion} / runtime capabilities ={' '}
        {capabilities.join(', ')}
      </footer>
    </main>
  );
}
