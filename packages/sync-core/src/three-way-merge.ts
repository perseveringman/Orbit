export interface DiffHunk {
  readonly type: 'equal' | 'insert' | 'delete';
  readonly oldStart: number;
  readonly oldLength: number;
  readonly newStart: number;
  readonly newLength: number;
  readonly content: string;
}

export interface MergeConflict {
  readonly startLine: number;
  readonly endLine: number;
  readonly localContent: string;
  readonly remoteContent: string;
}

export interface MergeResult {
  readonly success: boolean;
  readonly merged: string;
  readonly hasConflicts: boolean;
  readonly conflicts: readonly MergeConflict[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ChangeRange {
  readonly start: number;  // ancestor line index (inclusive)
  readonly end: number;    // ancestor line index (exclusive)
  readonly replacement: readonly string[];
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split('\n');
}

function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function backtrackLcs(
  dp: number[][],
  a: readonly string[],
  b: readonly string[],
): Array<[number, number]> {
  const matches: Array<[number, number]> = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  matches.reverse();
  return matches;
}

function getChangeRanges(
  ancestorLines: readonly string[],
  editedLines: readonly string[],
): ChangeRange[] {
  const dp = lcsTable(ancestorLines, editedLines);
  const matches = backtrackLcs(dp, ancestorLines, editedLines);

  const ranges: ChangeRange[] = [];
  let ai = 0;
  let bi = 0;

  for (const [ma, mb] of matches) {
    if (ai < ma || bi < mb) {
      ranges.push({ start: ai, end: ma, replacement: editedLines.slice(bi, mb) });
    }
    ai = ma + 1;
    bi = mb + 1;
  }

  if (ai < ancestorLines.length || bi < editedLines.length) {
    ranges.push({
      start: ai,
      end: ancestorLines.length,
      replacement: editedLines.slice(bi),
    });
  }

  return ranges;
}

function rangesOverlap(a: ChangeRange, b: ChangeRange): boolean {
  // Two zero-width insertions at the same point overlap
  if (a.start === a.end && b.start === b.end) {
    return a.start === b.start;
  }
  // An insertion point inside a deletion range overlaps
  if (a.start === a.end) {
    return a.start >= b.start && a.start < b.end;
  }
  if (b.start === b.end) {
    return b.start >= a.start && b.start < a.end;
  }
  return a.start < b.end && b.start < a.end;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function diff(a: string, b: string): readonly DiffHunk[] {
  const aLines = splitLines(a);
  const bLines = splitLines(b);
  const dp = lcsTable(aLines, bLines);
  const matches = backtrackLcs(dp, aLines, bLines);

  const hunks: DiffHunk[] = [];
  let ai = 0;
  let bi = 0;

  for (const [ma, mb] of matches) {
    if (ai < ma) {
      hunks.push({
        type: 'delete',
        oldStart: ai,
        oldLength: ma - ai,
        newStart: bi,
        newLength: 0,
        content: aLines.slice(ai, ma).join('\n'),
      });
    }
    if (bi < mb) {
      hunks.push({
        type: 'insert',
        oldStart: ma,
        oldLength: 0,
        newStart: bi,
        newLength: mb - bi,
        content: bLines.slice(bi, mb).join('\n'),
      });
    }
    hunks.push({
      type: 'equal',
      oldStart: ma,
      oldLength: 1,
      newStart: mb,
      newLength: 1,
      content: aLines[ma],
    });
    ai = ma + 1;
    bi = mb + 1;
  }

  if (ai < aLines.length) {
    hunks.push({
      type: 'delete',
      oldStart: ai,
      oldLength: aLines.length - ai,
      newStart: bi,
      newLength: 0,
      content: aLines.slice(ai).join('\n'),
    });
  }
  if (bi < bLines.length) {
    hunks.push({
      type: 'insert',
      oldStart: aLines.length,
      oldLength: 0,
      newStart: bi,
      newLength: bLines.length - bi,
      content: bLines.slice(bi).join('\n'),
    });
  }

  return hunks;
}

export function threeWayMerge(
  ancestor: string,
  local: string,
  remote: string,
): MergeResult {
  if (local === remote) {
    return { success: true, merged: local, hasConflicts: false, conflicts: [] };
  }
  if (ancestor === local) {
    return { success: true, merged: remote, hasConflicts: false, conflicts: [] };
  }
  if (ancestor === remote) {
    return { success: true, merged: local, hasConflicts: false, conflicts: [] };
  }

  const ancestorLines = splitLines(ancestor);
  const localRanges = getChangeRanges(ancestorLines, splitLines(local));
  const remoteRanges = getChangeRanges(ancestorLines, splitLines(remote));

  const conflicts: MergeConflict[] = [];
  const result: string[] = [];
  let pos = 0;
  let li = 0;
  let ri = 0;

  while (li < localRanges.length || ri < remoteRanges.length) {
    const lr = li < localRanges.length ? localRanges[li] : null;
    const rr = ri < remoteRanges.length ? remoteRanges[ri] : null;

    if (lr && rr && rangesOverlap(lr, rr)) {
      // Expand to capture every mutually-overlapping range from both sides
      let conflictStart = Math.min(lr.start, rr.start);
      let conflictEnd = Math.max(lr.end, rr.end);
      li++;
      ri++;

      let expanded = true;
      while (expanded) {
        expanded = false;
        while (li < localRanges.length && localRanges[li].start < conflictEnd) {
          conflictEnd = Math.max(conflictEnd, localRanges[li].end);
          li++;
          expanded = true;
        }
        while (ri < remoteRanges.length && remoteRanges[ri].start < conflictEnd) {
          conflictEnd = Math.max(conflictEnd, remoteRanges[ri].end);
          ri++;
          expanded = true;
        }
      }

      // Emit unchanged ancestor lines before the conflict region
      while (pos < conflictStart) {
        result.push(ancestorLines[pos]);
        pos++;
      }

      const localContent = lr.replacement.join('\n');
      const remoteContent = rr.replacement.join('\n');

      if (
        localContent === remoteContent &&
        lr.start === rr.start &&
        lr.end === rr.end
      ) {
        // Identical change from both sides — apply once
        result.push(...lr.replacement);
      } else {
        // True conflict — preserve ancestor text in output
        result.push(...ancestorLines.slice(conflictStart, conflictEnd));
        conflicts.push({
          startLine: conflictStart,
          endLine: conflictEnd,
          localContent,
          remoteContent,
        });
      }

      pos = conflictEnd;
    } else if (!rr || (lr && lr.start <= rr.start)) {
      // Apply local-only change
      while (pos < lr!.start) {
        result.push(ancestorLines[pos]);
        pos++;
      }
      result.push(...lr!.replacement);
      pos = lr!.end;
      li++;
    } else {
      // Apply remote-only change
      while (pos < rr!.start) {
        result.push(ancestorLines[pos]);
        pos++;
      }
      result.push(...rr!.replacement);
      pos = rr!.end;
      ri++;
    }
  }

  // Remaining unchanged tail
  while (pos < ancestorLines.length) {
    result.push(ancestorLines[pos]);
    pos++;
  }

  const hasConflicts = conflicts.length > 0;
  return { success: !hasConflicts, merged: result.join('\n'), hasConflicts, conflicts };
}
