import type { Link, ObjectUid } from './types.js';
import type { ObjectGraphIndex } from './graph-index.js';
import { collectNeighborhood, getBacklinks, getOutlinks } from './graph-index.js';

// ── Density metrics ──

export interface LinkDensityMetrics {
  readonly objectUid: ObjectUid;
  readonly activeLinkCount: number;
  readonly proposedLinkCount: number;
  readonly rejectedLinkCount: number;
  readonly maxLinkConfidence: number;
  readonly avgLinkConfidence: number;
  readonly relationDiversity: number;
  readonly neighborhoodSize: number;
}

export function computeLinkDensity(
  index: ObjectGraphIndex,
  objectUid: ObjectUid,
): LinkDensityMetrics {
  const allLinks: readonly Link[] = [
    ...getOutlinks(index, objectUid),
    ...getBacklinks(index, objectUid),
  ];

  let activeLinkCount = 0;
  let proposedLinkCount = 0;
  let rejectedLinkCount = 0;

  for (const link of allLinks) {
    if (link.status === 'active') activeLinkCount++;
    else if (link.status === 'proposed') proposedLinkCount++;
    else if (link.status === 'rejected') rejectedLinkCount++;
  }

  // Confidence stats from all links that have a confidence value
  let maxLinkConfidence = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const link of allLinks) {
    if (link.confidence != null) {
      if (link.confidence > maxLinkConfidence) maxLinkConfidence = link.confidence;
      confidenceSum += link.confidence;
      confidenceCount++;
    }
  }

  const avgLinkConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;

  // Distinct relation types
  const relationTypes = new Set<string>();
  for (const link of allLinks) {
    relationTypes.add(link.relationType);
  }

  const neighborhoodSize = collectNeighborhood(index, objectUid, 2).size;

  return {
    objectUid,
    activeLinkCount,
    proposedLinkCount,
    rejectedLinkCount,
    maxLinkConfidence,
    avgLinkConfidence,
    relationDiversity: relationTypes.size,
    neighborhoodSize,
  };
}

// ── Feed priority ──

export interface FeedPriorityInput {
  readonly metrics: LinkDensityMetrics;
  readonly sourceQuality: number;
  readonly ageHours: number;
  readonly userInteractionSignal: number;
}

export function computeFeedPriority(input: FeedPriorityInput): number {
  const { metrics, sourceQuality, ageHours, userInteractionSignal } = input;

  const priority =
    metrics.activeLinkCount * 3.0 +
    metrics.proposedLinkCount * 1.0 +
    metrics.maxLinkConfidence * 2.0 +
    sourceQuality * 1.5 +
    userInteractionSignal * 2.0 -
    ageHours * 0.01;

  return Math.max(0, priority);
}
