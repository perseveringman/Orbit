import type { Link, ObjectReference, ObjectUid } from './types.js';

// ── Graph node ──

export type ObjectGraphNode = ObjectReference & Record<string, unknown>;

// ── In-memory graph index ──

export interface ObjectGraphIndex {
  readonly nodes: ReadonlyMap<ObjectUid, ObjectGraphNode>;
  readonly outlinks: ReadonlyMap<ObjectUid, readonly Link[]>;
  readonly backlinks: ReadonlyMap<ObjectUid, readonly Link[]>;
}

// ── Builder ──

export function buildObjectGraphIndex(
  nodes: readonly ObjectGraphNode[],
  links: readonly Link[],
): ObjectGraphIndex {
  const nodeMap = new Map<ObjectUid, ObjectGraphNode>();
  const outlinkMap = new Map<ObjectUid, Link[]>();
  const backlinkMap = new Map<ObjectUid, Link[]>();

  for (const node of nodes) {
    nodeMap.set(node.objectUid, node);
  }

  for (const link of links) {
    const out = outlinkMap.get(link.sourceUid);
    if (out) {
      out.push(link);
    } else {
      outlinkMap.set(link.sourceUid, [link]);
    }

    const back = backlinkMap.get(link.targetUid);
    if (back) {
      back.push(link);
    } else {
      backlinkMap.set(link.targetUid, [link]);
    }
  }

  return { nodes: nodeMap, outlinks: outlinkMap, backlinks: backlinkMap };
}

// ── Query helpers ──

export function getOutlinks(index: ObjectGraphIndex, uid: ObjectUid): readonly Link[] {
  return index.outlinks.get(uid) ?? [];
}

export function getBacklinks(index: ObjectGraphIndex, uid: ObjectUid): readonly Link[] {
  return index.backlinks.get(uid) ?? [];
}

export function getNeighborUids(index: ObjectGraphIndex, uid: ObjectUid): ObjectUid[] {
  const neighbors = new Set<ObjectUid>();

  for (const link of getOutlinks(index, uid)) {
    neighbors.add(link.targetUid);
  }
  for (const link of getBacklinks(index, uid)) {
    neighbors.add(link.sourceUid);
  }

  return [...neighbors];
}

/**
 * Breadth-first traversal collecting all nodes within `maxHops` of `startUid`.
 * Returns the set of reached UIDs (excluding the start).
 */
export function collectNeighborhood(
  index: ObjectGraphIndex,
  startUid: ObjectUid,
  maxHops: number,
): Set<ObjectUid> {
  const visited = new Set<ObjectUid>([startUid]);
  let frontier: ObjectUid[] = [startUid];

  for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
    const next: ObjectUid[] = [];
    for (const uid of frontier) {
      for (const neighbor of getNeighborUids(index, uid)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  visited.delete(startUid);
  return visited;
}

/**
 * Find orphan nodes — nodes with no links (no outlinks and no backlinks).
 */
export function findOrphanNodes(index: ObjectGraphIndex): ObjectUid[] {
  const orphans: ObjectUid[] = [];
  for (const uid of index.nodes.keys()) {
    if (getOutlinks(index, uid).length === 0 && getBacklinks(index, uid).length === 0) {
      orphans.push(uid);
    }
  }
  return orphans;
}

/**
 * Filter links by status and origin for the correction view.
 */
export function findRejectedAiLinks(links: readonly Link[]): Link[] {
  return links.filter((l) => l.origin === 'ai' && l.status === 'rejected');
}
