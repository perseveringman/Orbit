import type { Vision, VisionVersion } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export interface AgentVisionContext {
  readonly systemPromptPrinciples: string;
  readonly memoryContextSummary: string;
  readonly reviewFullText: string;
}

// ── Layer 1: System Prompt ─────────────────────────────────

export function buildSystemPromptPrinciples(vision: Vision): string {
  const lines = [
    `## User Vision — "${vision.title}" (${vision.scope})`,
    '',
    'You are operating on behalf of a user who has defined a personal vision.',
    'Align all suggestions and decisions with the following guiding principles:',
    '',
    `- Vision scope: ${vision.scope}`,
    `- Reminder posture: ${vision.reminderMode}`,
    `- Status: ${vision.status}`,
    '',
    'Respect the user\'s autonomy. Surface the vision gently when relevant,',
    'never override the user\'s explicit choices.',
  ];

  return lines.join('\n');
}

// ── Layer 2: Memory Context ────────────────────────────────

export function buildMemoryContextSummary(vision: Vision, currentVersion: VisionVersion): string {
  const lines = [
    `[Vision: ${vision.title}]`,
    `Scope: ${vision.scope} | Status: ${vision.status}`,
    `Version: ${currentVersion.versionNo} | Authored: ${currentVersion.authoredBy}`,
    '',
    currentVersion.summaryForAgent,
  ];

  return lines.join('\n');
}

// ── Layer 3: Review Full Text ──────────────────────────────

export function buildReviewFullText(visionVersions: readonly VisionVersion[]): string {
  const sorted = [...visionVersions].sort((a, b) => a.versionNo - b.versionNo);

  const sections = sorted.map((v) => {
    const header = `### Version ${v.versionNo} (${v.createdAt})`;
    const meta = v.changeNote ? `_Change note: ${v.changeNote}_` : '';
    const body = v.bodyMarkdown;
    return [header, meta, '', body].filter(Boolean).join('\n');
  });

  return ['# Vision — Full Review', '', ...sections].join('\n\n');
}

// ── Composite builder ──────────────────────────────────────

export function buildAgentVisionContext(
  vision: Vision,
  versions: readonly VisionVersion[],
): AgentVisionContext {
  const sorted = [...versions].sort((a, b) => a.versionNo - b.versionNo);
  const currentVersion = sorted[sorted.length - 1];

  if (!currentVersion) {
    return {
      systemPromptPrinciples: buildSystemPromptPrinciples(vision),
      memoryContextSummary: `[Vision: ${vision.title}] No versions available.`,
      reviewFullText: '# Vision — Full Review\n\nNo versions available.',
    };
  }

  return {
    systemPromptPrinciples: buildSystemPromptPrinciples(vision),
    memoryContextSummary: buildMemoryContextSummary(vision, currentVersion),
    reviewFullText: buildReviewFullText(versions),
  };
}
