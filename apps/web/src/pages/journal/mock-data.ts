// Journal mock data — self-contained, no runtime imports from @orbit/feature-journal

export type Surface = 'reader' | 'task' | 'writing' | 'research' | 'journal' | 'app';

export interface ActionLog {
  id: string;
  surface: Surface;
  title: string;
  subtitle: string;
  isMajor: boolean;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  relatedObjects: string[];
  aggregatedCount?: number;
}

export interface DayNote {
  id: string;
  date: string;
  content: string;
  privacyLevel: 'normal' | 'sensitive' | 'sealed';
  savedAt: string;
}

export type SummaryScope = 'day' | 'week' | 'month';

export interface Summary {
  id: string;
  scope: SummaryScope;
  date: string;
  body: string;
  generatedBy: 'system' | 'agent' | 'user_edited';
  version: number;
  sourceCount: number;
}

export type InsightType = 'focus_pattern' | 'input_to_output' | 'project_drift' | 'review_gap';

export interface BehaviorInsight {
  id: string;
  type: InsightType;
  statement: string;
  evidence: string;
  confidence: number;
  expiresInDays: number;
  dismissed: boolean;
  dismissReason?: string;
}

export interface CalendarDayInfo {
  date: string;
  hasEntry: boolean;
  hasInsight: boolean;
}

// --------------- Dates ---------------

const today = new Date();
const fmt = (d: Date): string => d.toISOString().slice(0, 10);

export const TODAY = fmt(today);

function offsetDate(days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return fmt(d);
}

export const YESTERDAY = offsetDate(-1);
export const TWO_DAYS_AGO = offsetDate(-2);

// --------------- Day Notes ---------------

export const dayNotes: DayNote[] = [
  {
    id: 'note-today',
    date: TODAY,
    content: '今天把阅读器的解析模块重构了，性能提升明显。下午准备继续写周报。',
    privacyLevel: 'normal',
    savedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 32).toISOString(),
  },
  {
    id: 'note-yesterday',
    date: YESTERDAY,
    content: '完成了任务系统的拖拽排序功能，测试覆盖率达到 85%。晚上读了两篇关于 CRDT 的论文。',
    privacyLevel: 'normal',
    savedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 22, 10).toISOString(),
  },
];

// --------------- Action Logs ---------------

function timeStr(hour: number, minute: number): string {
  const d = new Date(today);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const actionLogs: ActionLog[] = [
  // 08:00
  { id: 'a1', surface: 'reader', title: '阅读「Designing Data-Intensive Applications」第 7 章', subtitle: '事务与并发控制', isMajor: true, startTime: timeStr(8, 5), endTime: timeStr(8, 45), durationMinutes: 40, relatedObjects: ['DDIA'] },
  { id: 'a2', surface: 'journal', title: '记录晨间想法', subtitle: '日记条目', isMajor: false, startTime: timeStr(8, 48), endTime: timeStr(8, 55), durationMinutes: 7, relatedObjects: [] },
  // 09:00
  { id: 'a3', surface: 'task', title: '完成拖拽排序功能', subtitle: 'Orbit Task 模块', isMajor: true, startTime: timeStr(9, 0), endTime: timeStr(9, 50), durationMinutes: 50, relatedObjects: ['任务系统', 'DnD'] },
  { id: 'a4', surface: 'task', title: '修复排序 edge case', subtitle: '紧急 bug 修复', isMajor: false, startTime: timeStr(9, 52), endTime: timeStr(9, 58), durationMinutes: 6, relatedObjects: ['任务系统'] },
  // 10:00
  { id: 'a5', surface: 'writing', title: '撰写技术文档：同步协议', subtitle: 'Orbit Sync 文档', isMajor: true, startTime: timeStr(10, 0), endTime: timeStr(10, 40), durationMinutes: 40, relatedObjects: ['Sync 协议', '文档'] },
  { id: 'a6', surface: 'research', title: '调研 CRDT 实现方案', subtitle: 'Automerge vs Yjs 对比', isMajor: true, startTime: timeStr(10, 45), endTime: timeStr(11, 15), durationMinutes: 30, relatedObjects: ['CRDT', 'Automerge'] },
  // 11:00
  { id: 'a7', surface: 'task', title: '代码审查：PR #142', subtitle: '阅读器性能优化', isMajor: false, startTime: timeStr(11, 0), endTime: timeStr(11, 20), durationMinutes: 20, relatedObjects: ['PR #142'] },
  { id: 'a8', surface: 'reader', title: '阅读 React 19 Release Notes', subtitle: '官方文档', isMajor: false, startTime: timeStr(11, 25), endTime: timeStr(11, 50), durationMinutes: 25, relatedObjects: ['React 19'], aggregatedCount: 3 },
  // 13:00
  { id: 'a9', surface: 'writing', title: '编写周报', subtitle: '本周工作总结', isMajor: true, startTime: timeStr(13, 0), endTime: timeStr(13, 30), durationMinutes: 30, relatedObjects: ['周报'] },
  { id: 'a10', surface: 'task', title: '整理 backlog', subtitle: '项目管理', isMajor: false, startTime: timeStr(13, 35), endTime: timeStr(13, 55), durationMinutes: 20, relatedObjects: ['Backlog'], aggregatedCount: 4 },
  // 14:00
  { id: 'a11', surface: 'research', title: '测试 Automerge 集成', subtitle: '原型验证', isMajor: true, startTime: timeStr(14, 0), endTime: timeStr(14, 45), durationMinutes: 45, relatedObjects: ['Automerge', 'Sync'] },
  { id: 'a12', surface: 'reader', title: '阅读「The Art of PostgreSQL」', subtitle: '索引优化章节', isMajor: false, startTime: timeStr(14, 50), endTime: timeStr(15, 10), durationMinutes: 20, relatedObjects: ['PostgreSQL'] },
  // 15:00
  { id: 'a13', surface: 'writing', title: '更新 API 文档', subtitle: 'REST endpoints', isMajor: false, startTime: timeStr(15, 15), endTime: timeStr(15, 35), durationMinutes: 20, relatedObjects: ['API 文档'] },
  { id: 'a14', surface: 'task', title: '部署 staging 环境', subtitle: 'CI/CD', isMajor: true, startTime: timeStr(15, 40), endTime: timeStr(16, 0), durationMinutes: 20, relatedObjects: ['Staging'] },
  // 16:00
  { id: 'a15', surface: 'app', title: '调整系统设置', subtitle: '通知与同步偏好', isMajor: false, startTime: timeStr(16, 5), endTime: timeStr(16, 15), durationMinutes: 10, relatedObjects: [] },
  { id: 'a16', surface: 'journal', title: '记录下午复盘', subtitle: '日记条目', isMajor: false, startTime: timeStr(16, 20), endTime: timeStr(16, 30), durationMinutes: 10, relatedObjects: [] },
  // 17:00
  { id: 'a17', surface: 'reader', title: '阅读团队共享笔记', subtitle: '设计评审准备', isMajor: false, startTime: timeStr(17, 0), endTime: timeStr(17, 25), durationMinutes: 25, relatedObjects: ['设计评审'] },
  { id: 'a18', surface: 'research', title: '探索 WebRTC 数据通道', subtitle: 'P2P 同步可行性', isMajor: false, startTime: timeStr(17, 30), endTime: timeStr(17, 55), durationMinutes: 25, relatedObjects: ['WebRTC', 'P2P'] },
];

// --------------- Summaries ---------------

export const summaries: Summary[] = [
  {
    id: 'sum-day',
    scope: 'day',
    date: TODAY,
    body: '今天的工作重心集中在**任务系统完善**和**同步协议调研**两个方向。上午完成了拖拽排序的核心功能并修复了边界情况，随后投入到技术文档的撰写中。下午的 CRDT 调研取得了阶段性进展，Automerge 的集成原型已通过初步验证。整体节奏紧凑，输入与输出比例较为均衡。',
    generatedBy: 'system',
    version: 1,
    sourceCount: 18,
  },
  {
    id: 'sum-week',
    scope: 'week',
    date: TODAY,
    body: '本周在三个主要方向取得进展：\n1. **任务系统** — 拖拽排序、批量操作、筛选器优化\n2. **同步协议** — CRDT 方案选型完成，原型验证通过\n3. **文档体系** — 完成了 API 文档和内部技术文档的更新\n\n需要关注：项目 B 的 review 进度有所滞后。',
    generatedBy: 'agent',
    version: 2,
    sourceCount: 87,
  },
];

// --------------- Behavior Insights ---------------

export const insights: BehaviorInsight[] = [
  {
    id: 'ins-1',
    type: 'focus_pattern',
    statement: '你在上午 8-11 点的深度工作效率最高',
    evidence: '过去 7 天中，上午时段的平均专注时长为 42 分钟/次，而下午仅为 28 分钟/次。阅读和编码任务集中在上午完成。',
    confidence: 85,
    expiresInDays: 5,
    dismissed: false,
  },
  {
    id: 'ins-2',
    type: 'input_to_output',
    statement: '阅读输入正在有效转化为写作输出',
    evidence: '本周阅读了 3 篇 CRDT 相关论文后，产出了 1 篇技术文档和 1 个集成原型，输入转化率约 67%。',
    confidence: 72,
    expiresInDays: 3,
    dismissed: false,
  },
  {
    id: 'ins-3',
    type: 'project_drift',
    statement: '项目 B 连续 4 天没有活动记录',
    evidence: '项目 B 上次操作是 4 天前的代码审查。当前有 3 个待处理任务和 1 个即将到期的里程碑。',
    confidence: 91,
    expiresInDays: 2,
    dismissed: true,
    dismissReason: '已与团队沟通，本周优先处理项目 A',
  },
];

// --------------- Calendar Data ---------------

export function generateCalendarData(year: number, month: number): CalendarDayInfo[] {
  const days: CalendarDayInfo[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entryDays = new Set([1, 3, 5, 7, 8, 9, 10, 12, 14, 15, 17, 19, 20, 21, 23, 25, 27, 28]);
  const insightDays = new Set([5, 10, 15, 20, 25]);

  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = fmt(new Date(year, month, d));
    const isCurrentMonth = year === todayYear && month === todayMonth;
    days.push({
      date,
      hasEntry: isCurrentMonth ? (d <= todayDate && entryDays.has(d)) : entryDays.has(d),
      hasInsight: isCurrentMonth ? (d <= todayDate && insightDays.has(d)) : insightDays.has(d),
    });
  }
  return days;
}
