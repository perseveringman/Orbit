import { describe, expect, it } from 'vitest';

import { buildObjectGraphIndex, createObjectEdge, createObjectReference, listConnectedTargets } from '../src/index';

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

  it('建立对象图索引并返回连通节点', () => {
    const edge = createObjectEdge('annotates', createObjectReference('article', 'art_1'), createObjectReference('highlight', 'hl_1'));
    const index = buildObjectGraphIndex([article, highlight], [edge]);

    expect(index.nodesByKey['article:art_1']).toEqual(article);
    expect(listConnectedTargets(index, createObjectReference('article', 'art_1'))).toEqual([createObjectReference('highlight', 'hl_1')]);
  });
});
