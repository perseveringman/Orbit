import type { LocaleCode } from './messages';

export interface TermEntry {
  readonly conceptId: string;
  readonly preferredTerms: Readonly<Record<LocaleCode, string>>;
  readonly aliases: readonly string[];
  readonly forbiddenTerms: readonly string[];
  readonly domain: 'planning' | 'reading' | 'research' | 'writing' | 'general';
  readonly description?: string;
}

export interface Termbase {
  readonly entries: readonly TermEntry[];
  lookup(conceptId: string): TermEntry | undefined;
  preferred(conceptId: string, locale: LocaleCode): string | undefined;
  search(query: string): readonly TermEntry[];
}

export function createTermbase(entries: readonly TermEntry[]): Termbase {
  const byId = new Map<string, TermEntry>();
  for (const entry of entries) {
    byId.set(entry.conceptId, entry);
  }

  return {
    entries,

    lookup(conceptId: string): TermEntry | undefined {
      return byId.get(conceptId);
    },

    preferred(conceptId: string, locale: LocaleCode): string | undefined {
      return byId.get(conceptId)?.preferredTerms[locale];
    },

    search(query: string): readonly TermEntry[] {
      const q = query.toLowerCase();
      return entries.filter(entry =>
        entry.conceptId.toLowerCase().includes(q) ||
        Object.values(entry.preferredTerms).some(t => t.toLowerCase().includes(q)) ||
        entry.aliases.some(a => a.toLowerCase().includes(q)) ||
        (entry.description?.toLowerCase().includes(q) ?? false)
      );
    }
  };
}

export const orbitSeedEntries: readonly TermEntry[] = [
  {
    conceptId: 'project',
    preferredTerms: { 'en-US': 'Project', 'zh-CN': '项目', 'zh-TW': '專案' },
    aliases: ['initiative', '工程'],
    forbiddenTerms: ['folder'],
    domain: 'planning',
    description: 'A top-level container for related tasks and goals'
  },
  {
    conceptId: 'task',
    preferredTerms: { 'en-US': 'Task', 'zh-CN': '任务', 'zh-TW': '任務' },
    aliases: ['todo', 'action item', '待办'],
    forbiddenTerms: ['ticket', 'issue'],
    domain: 'planning',
    description: 'An actionable unit of work within a project'
  },
  {
    conceptId: 'vision',
    preferredTerms: { 'en-US': 'Vision', 'zh-CN': '愿景', 'zh-TW': '願景' },
    aliases: ['north star', '目标'],
    forbiddenTerms: [],
    domain: 'planning',
    description: 'A long-term aspirational goal guiding direction'
  },
  {
    conceptId: 'note',
    preferredTerms: { 'en-US': 'Note', 'zh-CN': '笔记', 'zh-TW': '筆記' },
    aliases: ['memo', '记录'],
    forbiddenTerms: [],
    domain: 'writing',
    description: 'A freeform text capture for thoughts and ideas'
  },
  {
    conceptId: 'highlight',
    preferredTerms: { 'en-US': 'Highlight', 'zh-CN': '高亮', 'zh-TW': '標註' },
    aliases: ['annotation', '划线'],
    forbiddenTerms: ['underline'],
    domain: 'reading',
    description: 'A marked passage in an article or document'
  },
  {
    conceptId: 'article',
    preferredTerms: { 'en-US': 'Article', 'zh-CN': '文章', 'zh-TW': '文章' },
    aliases: ['post', 'piece', '稿件'],
    forbiddenTerms: [],
    domain: 'reading',
    description: 'An imported or saved reading resource'
  },
  {
    conceptId: 'workspace',
    preferredTerms: { 'en-US': 'Workspace', 'zh-CN': '工作区', 'zh-TW': '工作區' },
    aliases: ['space', '空间'],
    forbiddenTerms: ['folder', 'directory'],
    domain: 'general',
    description: 'An isolated environment containing projects and resources'
  },
  {
    conceptId: 'agent',
    preferredTerms: { 'en-US': 'Agent', 'zh-CN': '智能体', 'zh-TW': '智慧體' },
    aliases: ['assistant', 'AI helper', '助手'],
    forbiddenTerms: ['bot'],
    domain: 'research',
    description: 'An AI-powered assistant that acts on behalf of the user'
  },
  {
    conceptId: 'direction',
    preferredTerms: { 'en-US': 'Direction', 'zh-CN': '方向', 'zh-TW': '方向' },
    aliases: ['theme', 'area', '主题'],
    forbiddenTerms: [],
    domain: 'planning',
    description: 'A thematic grouping of projects under a vision'
  },
  {
    conceptId: 'review',
    preferredTerms: { 'en-US': 'Review', 'zh-CN': '回顾', 'zh-TW': '回顧' },
    aliases: ['retrospective', 'reflection', '复盘'],
    forbiddenTerms: [],
    domain: 'planning',
    description: 'A periodic reflection on completed work and next steps'
  }
];
