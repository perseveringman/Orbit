import type {
  ContextBundle,
  EvidenceTraceResult,
  IsoDateTimeString,
  Link,
  ObjectReference,
  ObjectUid,
  WorkChainResult,
} from './types.js';

/**
 * Six cross-object query patterns derived from the Object Network spec §8.
 *
 * 1. Context Bundle   — 2-hop neighbors (notes, research, AI chats, drafts, logs)
 * 2. Work Chain       — trace article → highlight → note → … → output chain
 * 3. Orphan Detection — objects with no active relations in last N days
 * 4. Evidence Trace   — backward traversal through provenance relations
 * 5. Time Reverse     — all `reflects_on` (or any relation) links in last N days
 * 6. Correction View  — AI-generated links that were rejected
 */
export interface CrossObjectQueryService {
  /** Pull all linked objects within `maxHops` (default 2) of `objectUid`. */
  getContextBundle(objectUid: ObjectUid, maxHops?: number): Promise<ContextBundle>;

  /** Forward-trace the work chain starting from `startUid`. */
  traceWorkChain(startUid: ObjectUid): Promise<WorkChainResult>;

  /** Find objects created since `since` with no active relations. */
  findOrphans(since: IsoDateTimeString): Promise<ObjectReference[]>;

  /** Backward-trace provenance from an output artifact. */
  traceEvidence(outputUid: ObjectUid): Promise<EvidenceTraceResult>;

  /** Find all links of `relation` pointing at `objectUid` created since `since`. */
  timeReverseLookup(
    objectUid: ObjectUid,
    relation: string,
    since: IsoDateTimeString,
  ): Promise<Link[]>;

  /** List all AI-generated links with status 'rejected'. */
  listCorrectionCandidates(): Promise<Link[]>;
}
