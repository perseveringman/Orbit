// ── All Orbit object types ─────────────────────────────────

export const ORBIT_OBJECT_TYPES = [
  // Direction family
  'vision', 'direction', 'theme', 'goal', 'commitment', 'review',
  // Execution family
  'project', 'milestone', 'task', 'directive',
  // Input family
  'article', 'book', 'highlight', 'note', 'asset', 'source_endpoint', 'content_item', 'derivative_asset',
  // Research family
  'research_space', 'research_question', 'source_set', 'research_claim', 'research_gap', 'research_artifact',
  // Output family
  'document', 'draft', 'post', 'voice_profile', 'output_variant',
  // Time family
  'event', 'action_log', 'day_note', 'journal_summary', 'behavior_insight',
  // Agent family
  'agent_session', 'agent_run', 'agent_task', 'capability_call', 'approval_request',
  // Other
  'tag', 'ai_chat',
  // Legacy (backward compat)
  'workspace', 'feed',
] as const;

export type OrbitObjectType = (typeof ORBIT_OBJECT_TYPES)[number];

// ── Object type families ───────────────────────────────────

export const OBJECT_TYPE_FAMILIES = {
  direction: ['vision', 'direction', 'theme', 'goal', 'commitment', 'review'],
  execution: ['project', 'milestone', 'task', 'directive'],
  input: ['article', 'book', 'highlight', 'note', 'asset', 'source_endpoint', 'content_item', 'derivative_asset'],
  research: ['research_space', 'research_question', 'source_set', 'research_claim', 'research_gap', 'research_artifact'],
  output: ['document', 'draft', 'post', 'voice_profile', 'output_variant'],
  time: ['event', 'action_log', 'day_note', 'journal_summary', 'behavior_insight'],
  agent: ['agent_session', 'agent_run', 'agent_task', 'capability_call', 'approval_request'],
  other: ['tag', 'ai_chat', 'workspace', 'feed'],
} as const;

export type ObjectTypeFamily = keyof typeof OBJECT_TYPE_FAMILIES;

// ── Chinese labels ─────────────────────────────────────────

export const OBJECT_TYPE_LABELS: Record<OrbitObjectType, string> = {
  // Direction
  vision: '愿景',
  direction: '方向',
  theme: '主题',
  goal: '阶段目标',
  commitment: '承诺',
  review: '回顾',
  // Execution
  project: '项目',
  milestone: '里程碑',
  task: '任务',
  directive: '指令',
  // Input
  article: '文章',
  book: '书籍',
  highlight: '高亮',
  note: '笔记',
  asset: '资产',
  source_endpoint: '来源端点',
  content_item: '内容条目',
  derivative_asset: '衍生物',
  // Research
  research_space: '研究空间',
  research_question: '研究问题',
  source_set: '来源集',
  research_claim: '研究主张',
  research_gap: '研究缺口',
  research_artifact: '研究产物',
  // Output
  document: '文档',
  draft: '草稿',
  post: '发布',
  voice_profile: '声音档案',
  output_variant: '输出变体',
  // Time
  event: '事件',
  action_log: '行为日志',
  day_note: '日记',
  journal_summary: '日志摘要',
  behavior_insight: '行为洞察',
  // Agent
  agent_session: 'Agent会话',
  agent_run: 'Agent运行',
  agent_task: 'Agent任务',
  capability_call: '能力调用',
  approval_request: '审批请求',
  // Other
  tag: '标签',
  ai_chat: 'AI对话',
  workspace: '工作区',
  feed: '订阅源',
};

// ── Helpers ────────────────────────────────────────────────

export function isOrbitObjectType(value: string): value is OrbitObjectType {
  return (ORBIT_OBJECT_TYPES as readonly string[]).includes(value);
}

export function getObjectTypeLabel(type: OrbitObjectType): string {
  return OBJECT_TYPE_LABELS[type];
}

export function getObjectTypeFamily(type: OrbitObjectType): ObjectTypeFamily | undefined {
  for (const [family, types] of Object.entries(OBJECT_TYPE_FAMILIES)) {
    if ((types as readonly string[]).includes(type)) {
      return family as ObjectTypeFamily;
    }
  }
  return undefined;
}
