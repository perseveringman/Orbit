// ---------------------------------------------------------------------------
// @orbit/agent-core – Built-in Skill Definitions (M12)
// ---------------------------------------------------------------------------

import type { SkillInstallInput, SkillManager } from './types.js';

// ---- Built-in skill definitions ----

/** Planning & task decomposition skill. */
const planningSkill: SkillInstallInput = {
  name: 'orbit:planning',
  description: 'Project planning and task decomposition. Breaks down complex goals into actionable tasks with dependencies and milestones.',
  version: '1.0.0',
  author: 'Orbit',
  instructions: [
    'You are a planning specialist. When activated:',
    '1. Decompose the user\'s goal into concrete, atomic tasks.',
    '2. Identify dependencies between tasks and flag potential blockers.',
    '3. Group tasks into logical milestones with clear success criteria.',
    '4. Estimate relative effort (S/M/L) for each task.',
    '5. Produce an execution plan ordered by dependency graph.',
    'Prefer depth-first decomposition — break large tasks further until each is achievable in a single work session.',
  ].join('\n'),
  tools: ['project.create', 'task.create', 'task.list', 'milestone.create'],
  tags: ['planning', 'tasks', 'project-management'],
};

/** Multi-source research & synthesis skill. */
const researchSkill: SkillInstallInput = {
  name: 'orbit:research',
  description: 'Multi-source research and synthesis. Searches, cross-references, and distills information into structured briefs.',
  version: '1.0.0',
  author: 'Orbit',
  instructions: [
    'You are a research specialist. When activated:',
    '1. Formulate precise search queries from the user\'s question.',
    '2. Search multiple sources and collect diverse perspectives.',
    '3. Cross-reference findings to verify accuracy.',
    '4. Synthesize results into a structured research brief with citations.',
    '5. Highlight conflicting information and confidence levels.',
    'Always cite your sources. Prefer primary sources over secondary ones.',
  ].join('\n'),
  tools: ['web_fetch', 'web_search', 'workspace.search'],
  tags: ['research', 'search', 'synthesis'],
};

/** Long-form reading & summarization skill. */
const readingSkill: SkillInstallInput = {
  name: 'orbit:reading',
  description: 'Long-form reading and summarization. Analyzes articles, books, and podcasts, extracting key points and generating summaries.',
  version: '1.0.0',
  author: 'Orbit',
  instructions: [
    'You are a reading and summarization specialist. When activated:',
    '1. Ingest the full content of the provided material.',
    '2. Identify the thesis, key arguments, and supporting evidence.',
    '3. Extract notable quotes and important data points.',
    '4. Generate a structured summary: TL;DR, key takeaways, detailed notes.',
    '5. Tag the content with relevant topics for future retrieval.',
    'Preserve the author\'s nuance — avoid over-simplification.',
  ].join('\n'),
  tools: ['web_fetch', 'file_read'],
  tags: ['reading', 'summarization', 'content'],
};

/** Content creation & editing skill. */
const writingSkill: SkillInstallInput = {
  name: 'orbit:writing',
  description: 'Content creation and editing. Drafts, edits, and refines text with tone matching and structured output.',
  version: '1.0.0',
  author: 'Orbit',
  instructions: [
    'You are a writing and editing specialist. When activated:',
    '1. Match the user\'s desired tone, audience, and format.',
    '2. Produce well-structured drafts with clear headings and flow.',
    '3. When editing, preserve the author\'s voice while improving clarity.',
    '4. Support multiple output formats: prose, bullet points, outlines, markdown.',
    '5. Offer concrete revision suggestions rather than vague feedback.',
    'Default to concise, active voice unless instructed otherwise.',
  ].join('\n'),
  tools: ['file_read', 'file_write'],
  tags: ['writing', 'editing', 'content-creation'],
};

// ---- Exports ----

/** All built-in skill definitions shipped with Orbit. */
export const BUILTIN_SKILLS: readonly SkillInstallInput[] = [
  planningSkill,
  researchSkill,
  readingSkill,
  writingSkill,
] as const;

/** Install all built-in skills into the given manager. */
export function loadBuiltinSkills(manager: SkillManager): void {
  for (const skill of BUILTIN_SKILLS) {
    manager.installFromDefinition(skill, { type: 'builtin' });
  }
}
