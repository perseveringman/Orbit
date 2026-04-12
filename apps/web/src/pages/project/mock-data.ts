// ─── Project Tasks Page — Types & Mock Data ─────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface TaskItem {
  id: string;
  title: string;
  project: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  progress: number;
  assignee: { name: string; avatar?: string };
  attachments: number;
  comments: number;
  flagColor?: string;
}

export interface CalendarTask {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  color: string;
  variant: 'filled' | 'outlined' | 'subtle';
}

export interface TaskStats {
  totalTasks: number;
  completed: number;
  pending: number;
  upcomingDeadlines: number;
  statusBreakdown: {
    todo: number;
    inProgress: number;
    inReview: number;
    completed: number;
  };
}

// ─── Status Config ───────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; dot: string }
> = {
  todo: { label: '待办', color: '#f97316', dot: 'bg-orange-500' },
  in_progress: { label: '进行中', color: '#eab308', dot: 'bg-yellow-500' },
  in_review: { label: '审核中', color: '#6366f1', dot: 'bg-indigo-500' },
  completed: { label: '已完成', color: '#22c55e', dot: 'bg-green-500' },
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

// ─── Mock Stats ──────────────────────────────────────────────────────

export const MOCK_STATS: TaskStats = {
  totalTasks: 46,
  completed: 128,
  pending: 47,
  upcomingDeadlines: 15,
  statusBreakdown: {
    todo: 12,
    inProgress: 15,
    inReview: 6,
    completed: 13,
  },
};

// ─── Mock Tasks ──────────────────────────────────────────────────────

export const MOCK_TASKS: TaskItem[] = [
  {
    id: 'pt-1',
    title: '撰写客户提案',
    project: 'Orion 移动应用',
    status: 'todo',
    priority: 'high',
    dueDate: '2025-10-02',
    progress: 0,
    assignee: { name: '张三' },
    attachments: 2,
    comments: 0,
  },
  {
    id: 'pt-2',
    title: '设计登录流程',
    project: 'Orion 移动应用',
    status: 'todo',
    priority: 'medium',
    dueDate: '2025-10-05',
    progress: 0,
    assignee: { name: '李四' },
    attachments: 1,
    comments: 3,
  },
  {
    id: 'pt-3',
    title: '搭建项目脚手架',
    project: 'Atlas 仪表盘',
    status: 'todo',
    priority: 'low',
    dueDate: '2025-10-08',
    progress: 0,
    assignee: { name: '王五' },
    attachments: 0,
    comments: 1,
  },
  {
    id: 'pt-4',
    title: '原型测试',
    project: 'Atlas 仪表盘',
    status: 'in_progress',
    priority: 'urgent',
    dueDate: '2025-09-30',
    progress: 35,
    assignee: { name: '张三' },
    attachments: 1,
    comments: 7,
  },
  {
    id: 'pt-5',
    title: '完善 UI 界面',
    project: 'Orion 移动应用',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2025-09-28',
    progress: 60,
    assignee: { name: '李四' },
    attachments: 3,
    comments: 5,
  },
  {
    id: 'pt-6',
    title: '编写 API 文档',
    project: 'Atlas 仪表盘',
    status: 'in_progress',
    priority: 'medium',
    dueDate: '2025-10-01',
    progress: 20,
    assignee: { name: '赵六' },
    attachments: 0,
    comments: 2,
  },
  {
    id: 'pt-7',
    title: '设计评审 — Beta 项目',
    project: 'Atlas 仪表盘',
    status: 'in_review',
    priority: 'high',
    dueDate: '2025-10-01',
    progress: 80,
    assignee: { name: '王五' },
    attachments: 2,
    comments: 4,
  },
  {
    id: 'pt-8',
    title: '代码安全审查',
    project: 'Orion 移动应用',
    status: 'in_review',
    priority: 'urgent',
    dueDate: '2025-09-29',
    progress: 90,
    assignee: { name: '张三' },
    attachments: 1,
    comments: 6,
  },
  {
    id: 'pt-9',
    title: '完成 UI 界面定稿',
    project: 'Epsilon 网站',
    status: 'completed',
    priority: 'medium',
    dueDate: '2025-09-25',
    progress: 100,
    assignee: { name: '李四' },
    attachments: 4,
    comments: 8,
  },
  {
    id: 'pt-10',
    title: '部署生产环境',
    project: 'Epsilon 网站',
    status: 'completed',
    priority: 'high',
    dueDate: '2025-09-20',
    progress: 100,
    assignee: { name: '赵六' },
    attachments: 2,
    comments: 3,
  },
];

// ─── Mock Calendar Tasks ─────────────────────────────────────────────

export const MOCK_CALENDAR_TASKS: CalendarTask[] = [
  {
    id: 'cal-1',
    title: '撰写客户提案',
    date: '2025-09-11',
    endDate: '2025-09-13',
    color: '#f97316',
    variant: 'subtle',
  },
  {
    id: 'cal-2',
    title: '客户反馈会议',
    date: '2025-09-13',
    color: '#44403c',
    variant: 'filled',
  },
  {
    id: 'cal-3',
    title: 'UI 测试',
    date: '2025-09-13',
    endDate: '2025-09-15',
    color: '#6366f1',
    variant: 'subtle',
  },
  {
    id: 'cal-4',
    title: '提交最终设计稿',
    date: '2025-09-14',
    endDate: '2025-09-15',
    color: '#eab308',
    variant: 'subtle',
  },
  {
    id: 'cal-5',
    title: '原型测试',
    date: '2025-09-15',
    color: '#22c55e',
    variant: 'outlined',
  },
  {
    id: 'cal-6',
    title: '完善 UI 界面',
    date: '2025-09-16',
    endDate: '2025-09-17',
    color: '#6366f1',
    variant: 'subtle',
  },
  {
    id: 'cal-7',
    title: '更新样式规范',
    date: '2025-09-17',
    color: '#f97316',
    variant: 'subtle',
  },
];

// ─── Calendar Dates (week of Sep 11 – Sep 18) ────────────────────────

export const CALENDAR_WEEK = [
  '2025-09-11',
  '2025-09-12',
  '2025-09-13',
  '2025-09-14',
  '2025-09-15',
  '2025-09-16',
  '2025-09-17',
  '2025-09-18',
];

export const TODAY = '2025-09-15';
