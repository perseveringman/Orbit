import type { VisionVersion, VisionAuthoredBy, IsoDateTimeString } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export interface LineDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
}

// ── Append-only versioning ─────────────────────────────────

export function appendVersion(
  existing: readonly VisionVersion[],
  input: {
    readonly id: string;
    readonly visionId: string;
    readonly sourceFileId: string;
    readonly bodyMarkdown: string;
    readonly summaryForAgent: string;
    readonly changeNote: string | null;
    readonly authoredBy: VisionAuthoredBy;
  },
): VisionVersion {
  const maxVersionNo = existing.reduce((max, v) => Math.max(max, v.versionNo), 0);
  const now = new Date().toISOString() as IsoDateTimeString;

  return {
    id: input.id,
    visionId: input.visionId,
    versionNo: maxVersionNo + 1,
    sourceFileId: input.sourceFileId,
    bodyMarkdown: input.bodyMarkdown,
    summaryForAgent: input.summaryForAgent,
    changeNote: input.changeNote,
    authoredBy: input.authoredBy,
    createdAt: now,
  };
}

// ── History retrieval ──────────────────────────────────────

export function getVersionHistory(versions: readonly VisionVersion[]): readonly VisionVersion[] {
  return [...versions].sort((a, b) => a.versionNo - b.versionNo);
}

// ── Line-level diff ────────────────────────────────────────

export function diffVersions(v1: VisionVersion, v2: VisionVersion): LineDiff {
  const lines1 = v1.bodyMarkdown.split('\n');
  const lines2 = v2.bodyMarkdown.split('\n');

  const set1 = new Set(lines1);
  const set2 = new Set(lines2);

  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  for (const line of lines1) {
    if (set2.has(line)) {
      unchanged.push(line);
    } else {
      removed.push(line);
    }
  }

  for (const line of lines2) {
    if (!set1.has(line)) {
      added.push(line);
    }
  }

  return { added, removed, unchanged };
}
