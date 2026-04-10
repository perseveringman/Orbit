import { describe, expect, it } from 'vitest';

import {
  buildObjectGraphIndex,
  createObjectEdge,
  createObjectReference,
  listConnectedSources,
  listConnectedTargets,
} from '../src/index';

describe('object-graph', () => {
  const article = {
    kind: 'article',
    id: 'art_1',
    workspaceId: 'ws_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: '一篇文章',
    feedId: 'feed_1',
    status: 'unread',
    sourceUrl: 'https://orbit.dev/articles/1',
  } as const;

  const highlight = {
    kind: 'highlight',
    id: 'hl_1',
    workspaceId: 'ws_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    articleId: 'art_1',
    quote: 'Orbit 是本地优先阅读器',
    color: 'yellow',
  } as const;

  const project = {
    kind: 'project',
    id: 'proj_1',
    workspaceId: 'ws_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'P0 桌面切片',
    status: 'active',
  } as const;

  const task = {
    kind: 'task',
    id: 'task_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: '接线 Today / Focus 视图',
    status: 'todo',
  } as const;

  it('建立对象图索引并返回连通节点', () => {
    const edge = createObjectEdge('annotates', createObjectReference('article', 'art_1'), createObjectReference('highlight', 'hl_1'));
    const index = buildObjectGraphIndex([article, highlight], [edge]);

    expect(index.nodesByKey['article:art_1']).toEqual(article);
    expect(listConnectedTargets(index, createObjectReference('article', 'art_1'))).toEqual([createObjectReference('highlight', 'hl_1')]);
  });

  it('表达项目到任务的双向关系', () => {
    const edge = createObjectEdge('contains', createObjectReference('project', 'proj_1'), createObjectReference('task', 'task_1'));
    const index = buildObjectGraphIndex([project, task], [edge]);

    expect(listConnectedTargets(index, createObjectReference('project', 'proj_1'))).toEqual([
      createObjectReference('task', 'task_1'),
    ]);
    expect(listConnectedSources(index, createObjectReference('task', 'task_1'))).toEqual([
      createObjectReference('project', 'proj_1'),
    ]);
  });
});
