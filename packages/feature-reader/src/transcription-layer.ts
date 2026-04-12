// ── Transcription Layer Skeleton ────────────────────────────

// ── Transcript segment ─────────────────────────────────────

export interface TranscriptSegment {
  readonly startTime: number;
  readonly endTime: number;
  readonly speaker: string | null;
  readonly text: string;
  readonly confidence: number;
}

// ── Speaker profile ────────────────────────────────────────

export interface SpeakerProfile {
  readonly id: string;
  readonly label: string;
  readonly color: string;
}

// ── Transcript ─────────────────────────────────────────────

export interface Transcript {
  readonly segments: readonly TranscriptSegment[];
  readonly speakers: readonly SpeakerProfile[];
  readonly duration: number;
  readonly language: string;
}

export function createTranscript(
  segments: readonly TranscriptSegment[],
  speakers: readonly SpeakerProfile[],
  language: string,
): Transcript {
  const duration =
    segments.length > 0
      ? Math.max(...segments.map((s) => s.endTime))
      : 0;

  return { segments, speakers, duration, language };
}

// ── Query helpers ──────────────────────────────────────────

export function getSegmentAtTime(
  transcript: Transcript,
  timeSeconds: number,
): TranscriptSegment | undefined {
  return transcript.segments.find(
    (s) => timeSeconds >= s.startTime && timeSeconds < s.endTime,
  );
}

export function searchTranscript(
  transcript: Transcript,
  query: string,
): readonly TranscriptSegment[] {
  const lowerQuery = query.toLowerCase();
  return transcript.segments.filter((s) =>
    s.text.toLowerCase().includes(lowerQuery),
  );
}
