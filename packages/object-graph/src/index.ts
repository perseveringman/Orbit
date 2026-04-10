import type { DomainObject, OrbitEntityId, OrbitObjectKind } from '@orbit/domain';

export const OBJECT_EDGE_TYPES = ['contains', 'annotates', 'labels', 'references', 'belongs-to'] as const;

export type ObjectEdgeType = (typeof OBJECT_EDGE_TYPES)[number];

export interface ObjectReference {
  readonly kind: OrbitObjectKind;
  readonly id: OrbitEntityId;
}

export type ObjectGraphNode = DomainObject | (ObjectReference & Record<string, unknown>);

export interface ObjectEdge {
  readonly type: ObjectEdgeType;
  readonly from: ObjectReference;
  readonly to: ObjectReference;
}

export interface ObjectGraphIndex {
  readonly nodesByKey: Readonly<Record<string, ObjectGraphNode>>;
  readonly outgoingByKey: Readonly<Record<string, readonly ObjectEdge[]>>;
  readonly incomingByKey: Readonly<Record<string, readonly ObjectEdge[]>>;
}

export function createObjectReference(kind: OrbitObjectKind, id: OrbitEntityId): ObjectReference {
  return { kind, id };
}

export function createObjectEdge(type: ObjectEdgeType, from: ObjectReference, to: ObjectReference): ObjectEdge {
  return { type, from, to };
}

export function toObjectGraphKey(reference: ObjectReference): string {
  return `${reference.kind}:${reference.id}`;
}

export function buildObjectGraphIndex(
  nodes: readonly ObjectGraphNode[],
  edges: readonly ObjectEdge[],
): ObjectGraphIndex {
  const nodesByKey: Record<string, ObjectGraphNode> = {};
  const outgoingByKey: Record<string, ObjectEdge[]> = {};
  const incomingByKey: Record<string, ObjectEdge[]> = {};

  for (const node of nodes) {
    nodesByKey[toObjectGraphKey(node)] = node;
  }

  for (const edge of edges) {
    const fromKey = toObjectGraphKey(edge.from);
    const toKey = toObjectGraphKey(edge.to);

    outgoingByKey[fromKey] ??= [];
    outgoingByKey[fromKey].push(edge);

    incomingByKey[toKey] ??= [];
    incomingByKey[toKey].push(edge);
  }

  return { nodesByKey, outgoingByKey, incomingByKey };
}

export function listConnectedTargets(index: ObjectGraphIndex, from: ObjectReference): ObjectReference[] {
  return (index.outgoingByKey[toObjectGraphKey(from)] ?? []).map((edge) => edge.to);
}

export function listConnectedSources(index: ObjectGraphIndex, to: ObjectReference): ObjectReference[] {
  return (index.incomingByKey[toObjectGraphKey(to)] ?? []).map((edge) => edge.from);
}
