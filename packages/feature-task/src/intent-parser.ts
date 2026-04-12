import type { Project, Milestone, Task } from '@orbit/domain';

// ── Interfaces ─────────────────────────────────────────────

export interface ParsedIntent {
  readonly suggestedTitle: string;
  readonly suggestedBody: string | null;
  readonly suggestedProject: string | null;
  readonly suggestedMilestone: string | null;
  readonly subtasks: readonly string[];
  readonly confidence: number;
}

export interface IntentParserConfig {
  readonly existingProjects: readonly Project[];
  readonly existingMilestones: readonly Milestone[];
  readonly existingTasks: readonly Task[];
}

// ── Core parsing ───────────────────────────────────────────

export function parseUserIntent(
  rawInput: string,
  config?: IntentParserConfig,
): ParsedIntent {
  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return {
      suggestedTitle: '',
      suggestedBody: null,
      suggestedProject: null,
      suggestedMilestone: null,
      subtasks: [],
      confidence: 0,
    };
  }

  const subtasks = splitIntoSubtasks(trimmed);
  const hasSubtasks = subtasks.length > 1;

  // Extract first line as title, rest as body
  const lines = trimmed.split('\n');
  const suggestedTitle = lines[0].replace(/^[-*\d.)\]]+\s*/, '').trim();
  const bodyLines = lines.slice(1).filter((l) => l.trim().length > 0);
  const suggestedBody = bodyLines.length > 0 ? bodyLines.join('\n') : null;

  const suggestedProject = config
    ? suggestProject({ suggestedTitle, suggestedBody, suggestedProject: null, suggestedMilestone: null, subtasks, confidence: 0 }, config.existingProjects)
    : null;

  // Confidence heuristics
  let confidence = 0.5;
  if (suggestedTitle.length > 5) confidence += 0.1;
  if (suggestedTitle.length > 20) confidence += 0.1;
  if (suggestedProject !== null) confidence += 0.15;
  if (hasSubtasks) confidence += 0.1;
  if (suggestedTitle.length <= 3) confidence = 0.2;
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    suggestedTitle,
    suggestedBody,
    suggestedProject,
    suggestedMilestone: null,
    subtasks: hasSubtasks ? subtasks : [],
    confidence,
  };
}

// ── Auto-classify gate ─────────────────────────────────────

export function shouldAutoClassify(intent: ParsedIntent): boolean {
  return intent.confidence >= 0.7;
}

// ── Subtask splitting ──────────────────────────────────────

export function splitIntoSubtasks(input: string): readonly string[] {
  const trimmed = input.trim();

  // Numbered lists: "1. foo\n2. bar"
  const numberedPattern = /^\d+[.)]\s+/;
  const lines = trimmed.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length > 1 && lines.every((l) => numberedPattern.test(l))) {
    return lines.map((l) => l.replace(numberedPattern, '').trim());
  }

  // Bullet lists: "- foo\n- bar" or "* foo\n* bar"
  const bulletPattern = /^[-*•]\s+/;
  if (lines.length > 1 && lines.every((l) => bulletPattern.test(l))) {
    return lines.map((l) => l.replace(bulletPattern, '').trim());
  }

  // "and then" / "then" patterns
  const thenPattern = /\s+(?:and then|then|,\s*then)\s+/i;
  if (thenPattern.test(trimmed)) {
    return trimmed.split(thenPattern).map((s) => s.trim()).filter((s) => s.length > 0);
  }

  return [trimmed];
}

// ── Project suggestion ─────────────────────────────────────

export function suggestProject(
  intent: ParsedIntent,
  existingProjects: readonly Project[],
): string | null {
  if (existingProjects.length === 0) return null;

  const titleLower = intent.suggestedTitle.toLowerCase();
  const titleWords = titleLower.split(/\s+/).filter((w) => w.length > 2);

  let bestMatch: Project | null = null;
  let bestScore = 0;

  for (const project of existingProjects) {
    if (project.status === 'archived') continue;
    const projectLower = project.title.toLowerCase();
    let score = 0;
    for (const word of titleWords) {
      if (projectLower.includes(word)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = project;
    }
  }

  return bestScore > 0 ? bestMatch!.id : null;
}
