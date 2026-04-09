import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchDomModule, mountWorkbench } from '../src/index.ts';

test('feature-workbench：组合 Desktop/Web 可挂载的 DOM 工作台模块', () => {
  const module = createWorkbenchDomModule({
    host: { kind: 'desktop', containerId: 'orbit-root' },
    locale: 'zh-CN',
    activeSection: 'inbox',
    searchQuery: '',
    draft: '# 今日摘要',
    articles: [
      {
        id: 'a-1',
        title: '桌面挂载入口',
        excerpt: '桌面壳负责注入容器。',
        isRead: false,
        updatedAt: '2026-02-10T10:00:00.000Z'
      }
    ]
  });

  assert.equal(module.host.kind, 'desktop');
  assert.equal(module.shell.title, 'Orbit 工作台');
  assert.equal(module.editor.kind, 'dom-editor');
});

test('feature-workbench：提供宿主可调用的挂载结果', () => {
  const mounted = mountWorkbench({
    host: { kind: 'web', containerId: 'app-root' },
    locale: 'en-US',
    activeSection: 'library',
    searchQuery: '',
    draft: 'Draft',
    articles: []
  });

  assert.equal(mounted.mountTarget, 'app-root');
  assert.equal(mounted.hostKind, 'web');
  assert.equal(mounted.shell.title, 'Orbit Workbench');
});
