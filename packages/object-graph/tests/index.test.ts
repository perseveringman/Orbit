import { describe, expect, it } from 'vitest';

import {
  buildObjectGraphIndex,
  collectNeighborhood,
  findOrphanNodes,
  findRejectedAiLinks,
  getBacklinks,
  getOutlinks,
  getNeighborUids,
  RELATION_FAMILIES,
} from '../src/index';

import type {
  Link,
  ObjectGraphNode,
  ObjectReference,
} from '../src/index';

// ── Helpers ──

function makeNode(uid: string, type: string, id: string): ObjectGraphNode {
  return { objectUid: uid, objectType: type, objectId: id };
}

function makeLink(
  partial: Partial<Link> & Pick<Link, 'linkId' | 'sourceUid' | 'targetUid'>,
): Link {
  return {
    relationType: 'supports',
    origin: 'human',
    sourceChannel: null,
    status: 'active',
    confidence: null,
    whySummary: null,
    contextJson: null,
    weight: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

// ── Tests ──

describe('object-graph', () => {
  // ── Link creation with proper fields ──

  describe('Link type fields', () => {
    it('creates a link with all required fields', () => {
      const link = makeLink({
        linkId: 'link_1',
        sourceUid: 'article:art_1',
        targetUid: 'highlight:hl_1',
        relationType: 'excerpted_from',
        origin: 'human',
        sourceChannel: 'manual',
        status: 'active',
        confidence: 0.95,
        whySummary: 'User highlighted this passage',
      });

      expect(link.linkId).toBe('link_1');
      expect(link.sourceUid).toBe('article:art_1');
      expect(link.targetUid).toBe('highlight:hl_1');
      expect(link.relationType).toBe('excerpted_from');
      expect(link.origin).toBe('human');
      expect(link.sourceChannel).toBe('manual');
      expect(link.status).toBe('active');
      expect(link.confidence).toBe(0.95);
      expect(link.whySummary).toBe('User highlighted this passage');
    });

    it('supports AI-generated proposed links', () => {
      const link = makeLink({
        linkId: 'link_2',
        sourceUid: 'note:n_1',
        targetUid: 'task:t_1',
        relationType: 'suggests',
        origin: 'ai',
        sourceChannel: 'agent_chat',
        status: 'proposed',
        confidence: 0.72,
        whySummary: 'Note mentions task deliverable',
      });

      expect(link.origin).toBe('ai');
      expect(link.status).toBe('proposed');
      expect(link.confidence).toBe(0.72);
    });
  });

  // ── Graph index building & traversal ──

  describe('buildObjectGraphIndex', () => {
    it('indexes nodes by UID', () => {
      const article = makeNode('article:art_1', 'article', 'art_1');
      const highlight = makeNode('highlight:hl_1', 'highlight', 'hl_1');

      const index = buildObjectGraphIndex([article, highlight], []);

      expect(index.nodes.get('article:art_1')).toEqual(article);
      expect(index.nodes.get('highlight:hl_1')).toEqual(highlight);
      expect(index.nodes.size).toBe(2);
    });

    it('builds outlinks and backlinks maps', () => {
      const article = makeNode('article:art_1', 'article', 'art_1');
      const highlight = makeNode('highlight:hl_1', 'highlight', 'hl_1');
      const link = makeLink({
        linkId: 'l1',
        sourceUid: 'article:art_1',
        targetUid: 'highlight:hl_1',
        relationType: 'excerpted_from',
      });

      const index = buildObjectGraphIndex([article, highlight], [link]);

      expect(index.outlinks.get('article:art_1')).toEqual([link]);
      expect(index.backlinks.get('highlight:hl_1')).toEqual([link]);
    });
  });

  // ── Backlinks / outlinks queries ──

  describe('getOutlinks / getBacklinks', () => {
    const nodes = [
      makeNode('project:p1', 'project', 'p1'),
      makeNode('task:t1', 'task', 't1'),
      makeNode('task:t2', 'task', 't2'),
    ];
    const links = [
      makeLink({ linkId: 'l1', sourceUid: 'project:p1', targetUid: 'task:t1', relationType: 'contains' }),
      makeLink({ linkId: 'l2', sourceUid: 'project:p1', targetUid: 'task:t2', relationType: 'contains' }),
    ];
    const index = buildObjectGraphIndex(nodes, links);

    it('returns outlinks from a source UID', () => {
      const out = getOutlinks(index, 'project:p1');
      expect(out).toHaveLength(2);
      expect(out.map((l) => l.targetUid)).toEqual(['task:t1', 'task:t2']);
    });

    it('returns backlinks to a target UID', () => {
      const back = getBacklinks(index, 'task:t1');
      expect(back).toHaveLength(1);
      expect(back[0].sourceUid).toBe('project:p1');
    });

    it('returns empty array for nodes with no links', () => {
      expect(getOutlinks(index, 'task:t1')).toEqual([]);
      expect(getBacklinks(index, 'project:p1')).toEqual([]);
    });
  });

  // ── Neighbor UIDs ──

  describe('getNeighborUids', () => {
    it('returns all directly connected UIDs', () => {
      const nodes = [
        makeNode('note:n1', 'note', 'n1'),
        makeNode('task:t1', 'task', 't1'),
        makeNode('article:a1', 'article', 'a1'),
      ];
      const links = [
        makeLink({ linkId: 'l1', sourceUid: 'note:n1', targetUid: 'task:t1' }),
        makeLink({ linkId: 'l2', sourceUid: 'article:a1', targetUid: 'note:n1' }),
      ];
      const index = buildObjectGraphIndex(nodes, links);

      const neighbors = getNeighborUids(index, 'note:n1');
      expect(neighbors).toContain('task:t1');
      expect(neighbors).toContain('article:a1');
      expect(neighbors).toHaveLength(2);
    });
  });

  // ── Context bundle assembly (2-hop neighborhood) ──

  describe('collectNeighborhood (context bundle)', () => {
    it('collects 2-hop neighborhood', () => {
      const nodes = [
        makeNode('task:t1', 'task', 't1'),
        makeNode('note:n1', 'note', 'n1'),
        makeNode('article:a1', 'article', 'a1'),
        makeNode('highlight:h1', 'highlight', 'h1'),
        makeNode('unrelated:u1', 'unrelated', 'u1'),
      ];
      const links = [
        makeLink({ linkId: 'l1', sourceUid: 'task:t1', targetUid: 'note:n1' }),
        makeLink({ linkId: 'l2', sourceUid: 'note:n1', targetUid: 'article:a1' }),
        makeLink({ linkId: 'l3', sourceUid: 'article:a1', targetUid: 'highlight:h1' }),
      ];
      const index = buildObjectGraphIndex(nodes, links);

      const hop1 = collectNeighborhood(index, 'task:t1', 1);
      expect(hop1.has('note:n1')).toBe(true);
      expect(hop1.has('article:a1')).toBe(false);

      const hop2 = collectNeighborhood(index, 'task:t1', 2);
      expect(hop2.has('note:n1')).toBe(true);
      expect(hop2.has('article:a1')).toBe(true);
      expect(hop2.has('highlight:h1')).toBe(false); // 3 hops away

      expect(hop2.has('task:t1')).toBe(false); // start node excluded
      expect(hop2.has('unrelated:u1')).toBe(false);
    });

    it('handles zero hops', () => {
      const nodes = [makeNode('x:1', 'x', '1'), makeNode('y:1', 'y', '1')];
      const links = [makeLink({ linkId: 'l1', sourceUid: 'x:1', targetUid: 'y:1' })];
      const index = buildObjectGraphIndex(nodes, links);

      const result = collectNeighborhood(index, 'x:1', 0);
      expect(result.size).toBe(0);
    });
  });

  // ── Orphan detection ──

  describe('findOrphanNodes', () => {
    it('finds nodes with no links', () => {
      const nodes = [
        makeNode('note:n1', 'note', 'n1'),
        makeNode('note:n2', 'note', 'n2'),
        makeNode('task:t1', 'task', 't1'),
      ];
      const links = [
        makeLink({ linkId: 'l1', sourceUid: 'note:n1', targetUid: 'task:t1' }),
      ];
      const index = buildObjectGraphIndex(nodes, links);

      const orphans = findOrphanNodes(index);
      expect(orphans).toEqual(['note:n2']);
    });

    it('returns empty when all nodes are connected', () => {
      const nodes = [makeNode('a:1', 'a', '1'), makeNode('b:1', 'b', '1')];
      const links = [makeLink({ linkId: 'l1', sourceUid: 'a:1', targetUid: 'b:1' })];
      const index = buildObjectGraphIndex(nodes, links);

      expect(findOrphanNodes(index)).toEqual([]);
    });
  });

  // ── Link status transitions ──

  describe('link status transitions', () => {
    it('proposed → active (accept)', () => {
      const proposed = makeLink({
        linkId: 'l1',
        sourceUid: 'a:1',
        targetUid: 'b:1',
        status: 'proposed',
        origin: 'ai',
      });
      const accepted: Link = { ...proposed, status: 'active', updatedAt: '2026-01-02T00:00:00.000Z' };

      expect(proposed.status).toBe('proposed');
      expect(accepted.status).toBe('active');
    });

    it('proposed → rejected', () => {
      const proposed = makeLink({
        linkId: 'l2',
        sourceUid: 'a:1',
        targetUid: 'b:1',
        status: 'proposed',
        origin: 'ai',
      });
      const rejected: Link = { ...proposed, status: 'rejected', updatedAt: '2026-01-02T00:00:00.000Z' };

      expect(rejected.status).toBe('rejected');
    });

    it('active → archived', () => {
      const active = makeLink({
        linkId: 'l3',
        sourceUid: 'a:1',
        targetUid: 'b:1',
        status: 'active',
      });
      const archived: Link = { ...active, status: 'archived', updatedAt: '2026-01-02T00:00:00.000Z' };

      expect(archived.status).toBe('archived');
    });
  });

  // ── Correction view (rejected AI links) ──

  describe('findRejectedAiLinks', () => {
    it('filters to only AI-rejected links', () => {
      const links: Link[] = [
        makeLink({ linkId: 'l1', sourceUid: 'a:1', targetUid: 'b:1', origin: 'ai', status: 'rejected' }),
        makeLink({ linkId: 'l2', sourceUid: 'a:1', targetUid: 'c:1', origin: 'ai', status: 'active' }),
        makeLink({ linkId: 'l3', sourceUid: 'a:1', targetUid: 'd:1', origin: 'human', status: 'rejected' }),
        makeLink({ linkId: 'l4', sourceUid: 'a:1', targetUid: 'e:1', origin: 'ai', status: 'rejected' }),
      ];

      const corrections = findRejectedAiLinks(links);
      expect(corrections).toHaveLength(2);
      expect(corrections.map((l) => l.linkId)).toEqual(['l1', 'l4']);
    });
  });

  // ── Relation families ──

  describe('RELATION_FAMILIES', () => {
    it('contains all expected families', () => {
      expect(Object.keys(RELATION_FAMILIES)).toEqual([
        'structural', 'provenance', 'support', 'execution',
        'output', 'discussion', 'reflection', 'aggregation', 'extra',
      ]);
    });

    it('provenance family has correct relations', () => {
      expect(RELATION_FAMILIES.provenance).toEqual([
        'derived_from', 'excerpted_from', 'annotated_by', 'evidenced_by',
      ]);
    });
  });
});
