import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchShellViewModel } from '../src/index.ts';

test('app-viewmodels：生成不依赖宿主 API 的工作台视图模型', () => {
  const viewModel = createWorkbenchShellViewModel({
    locale: 'zh-CN',
    activeSection: 'inbox',
    searchQuery: 'Orbit',
    articles: [
      {
        id: 'a-1',
        title: 'Orbit 发布节奏',
        excerpt: '记录本地优先产品设计。',
        isRead: false,
        updatedAt: '2026-02-10T10:00:00.000Z'
      },
      {
        id: 'a-2',
        title: '第二篇笔记',
        excerpt: '与搜索词无关。',
        isRead: true,
        updatedAt: '2026-02-09T10:00:00.000Z'
      }
    ]
  });

  assert.equal(viewModel.title, 'Orbit 工作台');
  assert.deepEqual(viewModel.sections[0], {
    id: 'inbox',
    label: '收件箱',
    count: 1,
    active: true
  });
  assert.equal(viewModel.filteredArticles.length, 1);
  assert.equal(viewModel.filteredArticles[0]?.id, 'a-1');
});
