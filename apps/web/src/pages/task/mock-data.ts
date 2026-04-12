// ─── Task Status Types ───────────────────────────────────────────────
export type TaskStatus =
  | 'captured'
  | 'clarifying'
  | 'ready'
  | 'scheduled'
  | 'focused'
  | 'done'
  | 'blocked'
  | 'dropped';

export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';
export type MilestoneStatus = 'planned' | 'active' | 'done' | 'dropped';
export type EnergyLevel = 'high' | 'medium' | 'low';

// ─── Valid Transitions ───────────────────────────────────────────────
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  captured: ['clarifying', 'ready', 'dropped'],
  clarifying: ['ready', 'blocked', 'dropped'],
  ready: ['scheduled', 'focused', 'blocked', 'dropped'],
  scheduled: ['focused', 'ready', 'blocked', 'dropped'],
  focused: ['done', 'blocked', 'ready'],
  done: [],
  blocked: ['ready', 'clarifying', 'dropped'],
  dropped: [],
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  captured: '已捕获',
  clarifying: '待澄清',
  ready: '已就绪',
  scheduled: '已排期',
  focused: '专注中',
  done: '已完成',
  blocked: '受阻',
  dropped: '已放弃',
};

export const STATUS_DESCRIPTIONS: Record<TaskStatus, string> = {
  captured: '刚记录下来，尚未整理',
  clarifying: '需要进一步明确目标或范围',
  ready: '已明确，可以开始执行',
  scheduled: '已安排到具体时间段',
  focused: '正在专注执行中',
  done: '已完成',
  blocked: '遇到障碍，暂时无法推进',
  dropped: '决定不做了',
};

export type StatusColor =
  | 'default'
  | 'warning'
  | 'success'
  | 'accent'
  | 'danger';

export const STATUS_COLORS: Record<TaskStatus, StatusColor> = {
  captured: 'default',
  clarifying: 'warning',
  ready: 'success',
  scheduled: 'accent',
  focused: 'accent',
  done: 'success',
  blocked: 'warning',
  dropped: 'danger',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '进行中',
  paused: '已暂停',
  done: '已完成',
  archived: '已归档',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, StatusColor> = {
  active: 'accent',
  paused: 'warning',
  done: 'success',
  archived: 'default',
};

// ─── Data Interfaces ─────────────────────────────────────────────────
export interface SupportLink {
  id: string;
  label: string;
  url: string;
  kind: 'reading' | 'research' | 'writing';
}

export interface TaskEvent {
  id: string;
  taskId: string;
  type: 'status_change' | 'assignment' | 'comment';
  from?: string;
  to?: string;
  note?: string;
  timestamp: string;
}

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  body?: string;
  status: TaskStatus;
  projectId: string | null;
  milestoneId: string | null;
  dueDate: string | null;
  focusRank: number | null;
  completionDefinition?: string;
  subtasks: SubTask[];
  supportLinks: SupportLink[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  status: MilestoneStatus;
  dueDate: string | null;
  completionDefinition: string;
  taskIds: string[];
}

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  alignment: string;
  visionLink: string | null;
  milestoneIds: string[];
  lastReviewedAt: string | null;
  createdAt: string;
}

export interface ScheduledBlock {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string;
}

export interface TodayRecommendation {
  taskId: string;
  reasoning: string;
  urgency: number;
  importance: number;
  contextFit: number;
}

export interface TodayPlan {
  primary: TodayRecommendation;
  alternatives: TodayRecommendation[];
  scheduledBlocks: ScheduledBlock[];
  carryForward: string[];
}

// ─── Mock Projects ───────────────────────────────────────────────────
export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-orbit-mvp',
    title: 'Orbit MVP 发布',
    status: 'active',
    alignment: '构建个人生产力系统核心',
    visionLink: '/vision/orbit-v1',
    milestoneIds: ['ms-shell', 'ms-task-engine', 'ms-review'],
    lastReviewedAt: '2026-04-08T18:00:00Z',
    createdAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'proj-reading',
    title: '深度阅读计划',
    status: 'active',
    alignment: '持续学习与知识内化',
    visionLink: null,
    milestoneIds: ['ms-books-q2'],
    lastReviewedAt: '2026-04-07T20:00:00Z',
    createdAt: '2026-03-15T09:00:00Z',
  },
  {
    id: 'proj-health',
    title: '健康管理',
    status: 'paused',
    alignment: '身心可持续发展',
    visionLink: null,
    milestoneIds: ['ms-routine'],
    lastReviewedAt: '2026-04-01T08:00:00Z',
    createdAt: '2026-02-01T09:00:00Z',
  },
];

// ─── Mock Milestones ─────────────────────────────────────────────────
export const MOCK_MILESTONES: Milestone[] = [
  {
    id: 'ms-shell',
    projectId: 'proj-orbit-mvp',
    title: 'Shell 与导航系统',
    status: 'done',
    dueDate: '2026-04-05',
    completionDefinition: '侧边栏导航、主题切换、页面路由全部可用',
    taskIds: ['task-1', 'task-2'],
  },
  {
    id: 'ms-task-engine',
    projectId: 'proj-orbit-mvp',
    title: '任务引擎核心',
    status: 'active',
    dueDate: '2026-04-15',
    completionDefinition: '任务 CRUD、状态流转、专注模式全部可用',
    taskIds: ['task-3', 'task-4', 'task-5', 'task-6', 'task-7'],
  },
  {
    id: 'ms-review',
    projectId: 'proj-orbit-mvp',
    title: '回顾系统',
    status: 'planned',
    dueDate: '2026-04-25',
    completionDefinition: '日回顾、周回顾、项目复盘全部可用',
    taskIds: ['task-8', 'task-9'],
  },
  {
    id: 'ms-books-q2',
    projectId: 'proj-reading',
    title: 'Q2 阅读目标',
    status: 'active',
    dueDate: '2026-06-30',
    completionDefinition: '完成 3 本书的阅读笔记',
    taskIds: ['task-10', 'task-11'],
  },
  {
    id: 'ms-routine',
    projectId: 'proj-health',
    title: '建立晨间例程',
    status: 'planned',
    dueDate: null,
    completionDefinition: '连续 21 天执行晨间例程',
    taskIds: ['task-12'],
  },
];

// ─── Mock Tasks ──────────────────────────────────────────────────────
export const MOCK_TASKS: Task[] = [
  {
    id: 'task-1',
    title: '实现侧边栏导航组件',
    body: '基于 HeroUI 构建可折叠侧边栏，支持多级导航。',
    status: 'done',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-shell',
    dueDate: '2026-04-03',
    focusRank: null,
    completionDefinition: '侧边栏可渲染、可折叠、可切换页面',
    subtasks: [
      { id: 'st-1a', title: '设计导航数据结构', done: true },
      { id: 'st-1b', title: '实现折叠动画', done: true },
    ],
    supportLinks: [],
    createdAt: '2026-03-20T09:00:00Z',
    updatedAt: '2026-04-03T16:00:00Z',
    completedAt: '2026-04-03T16:00:00Z',
  },
  {
    id: 'task-2',
    title: '主题切换（亮/暗）',
    body: '实现 light/dark 主题切换，持久化用户偏好。',
    status: 'done',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-shell',
    dueDate: '2026-04-04',
    focusRank: null,
    completionDefinition: '点击按钮可在亮/暗主题之间切换',
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-03-21T09:00:00Z',
    updatedAt: '2026-04-04T14:00:00Z',
    completedAt: '2026-04-04T14:00:00Z',
  },
  {
    id: 'task-3',
    title: '构建任务列表视图',
    body: '实现按状态分组的任务列表和看板视图。',
    status: 'focused',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-task-engine',
    dueDate: '2026-04-10',
    focusRank: 1,
    completionDefinition: '支持按状态分组展示和看板拖拽',
    subtasks: [
      { id: 'st-3a', title: '列表视图', done: true },
      { id: 'st-3b', title: '看板视图', done: false },
      { id: 'st-3c', title: '筛选功能', done: false },
    ],
    supportLinks: [
      { id: 'sl-1', label: 'HeroUI Card 文档', url: 'https://heroui.com/docs/react/components/card', kind: 'reading' },
    ],
    createdAt: '2026-04-05T09:00:00Z',
    updatedAt: '2026-04-09T10:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-4',
    title: '任务状态流转引擎',
    body: '实现有限状态机，定义任务状态间的合法流转。',
    status: 'ready',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-task-engine',
    dueDate: '2026-04-11',
    focusRank: 2,
    completionDefinition: '所有状态流转路径通过单测验证',
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-04-05T09:00:00Z',
    updatedAt: '2026-04-08T12:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-5',
    title: '专注模式 UI',
    body: '构建沉浸式单任务专注视图，包含计时器和材料面板。',
    status: 'scheduled',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-task-engine',
    dueDate: '2026-04-12',
    focusRank: 3,
    completionDefinition: '专注页面可渲染，计时器正常运行',
    subtasks: [
      { id: 'st-5a', title: '计时器组件', done: false },
      { id: 'st-5b', title: '材料面板', done: false },
    ],
    supportLinks: [
      { id: 'sl-2', label: '深度工作法笔记', url: '/notes/deep-work', kind: 'research' },
    ],
    createdAt: '2026-04-06T09:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-6',
    title: '快速捕获输入框',
    body: '实现意图解析的快速任务捕获。',
    status: 'captured',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-task-engine',
    dueDate: null,
    focusRank: null,
    completionDefinition: '输入意图后可解析并创建任务',
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-04-08T14:00:00Z',
    updatedAt: '2026-04-08T14:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-7',
    title: '任务详情面板',
    body: '右侧滑出面板显示任务详情、子任务、材料和历史。',
    status: 'clarifying',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-task-engine',
    dueDate: '2026-04-13',
    focusRank: null,
    completionDefinition: '面板可展示所有任务维度信息',
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-04-07T10:00:00Z',
    updatedAt: '2026-04-09T09:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-8',
    title: '日回顾界面',
    body: '构建每日回顾页面，包含完成列表和决策记录。',
    status: 'ready',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-review',
    dueDate: '2026-04-20',
    focusRank: null,
    completionDefinition: '日回顾页面可渲染并提交决策',
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-04-08T09:00:00Z',
    updatedAt: '2026-04-08T09:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-9',
    title: '周回顾与项目复盘',
    body: '实现周回顾统计和项目复盘功能。',
    status: 'captured',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-review',
    dueDate: null,
    focusRank: null,
    completionDefinition: '周回顾和复盘页面功能完整',
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-04-08T09:30:00Z',
    updatedAt: '2026-04-08T09:30:00Z',
    completedAt: null,
  },
  {
    id: 'task-10',
    title: '阅读《深度工作》并写笔记',
    body: '完成 Cal Newport 的《Deep Work》阅读，输出结构化笔记。',
    status: 'focused',
    projectId: 'proj-reading',
    milestoneId: 'ms-books-q2',
    dueDate: '2026-04-20',
    focusRank: 4,
    completionDefinition: '完成全书阅读 + 至少 5 条关键笔记',
    subtasks: [
      { id: 'st-10a', title: '第一部分阅读', done: true },
      { id: 'st-10b', title: '第二部分阅读', done: true },
      { id: 'st-10c', title: '写总结笔记', done: false },
    ],
    supportLinks: [
      { id: 'sl-3', label: '深度工作 PDF', url: '/files/deep-work.pdf', kind: 'reading' },
      { id: 'sl-4', label: '阅读笔记草稿', url: '/notes/deep-work-draft', kind: 'writing' },
    ],
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-04-09T07:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-11',
    title: '阅读《原子习惯》',
    body: '阅读 James Clear 的《Atomic Habits》。',
    status: 'ready',
    projectId: 'proj-reading',
    milestoneId: 'ms-books-q2',
    dueDate: '2026-05-15',
    focusRank: null,
    completionDefinition: '完成阅读并输出 3 条应用计划',
    subtasks: [],
    supportLinks: [
      { id: 'sl-5', label: 'Atomic Habits 概要', url: '/notes/atomic-habits-summary', kind: 'research' },
    ],
    createdAt: '2026-03-20T09:00:00Z',
    updatedAt: '2026-04-05T12:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-12',
    title: '设计晨间例程流程',
    body: '定义每日早晨固定流程：冥想、运动、阅读。',
    status: 'blocked',
    projectId: 'proj-health',
    milestoneId: 'ms-routine',
    dueDate: null,
    focusRank: null,
    completionDefinition: '流程文档完成，并试运行 3 天',
    subtasks: [
      { id: 'st-12a', title: '列出候选活动', done: true },
      { id: 'st-12b', title: '确定时间分配', done: false },
    ],
    supportLinks: [],
    createdAt: '2026-02-15T09:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-13',
    title: '整理 Orbit 文档结构',
    status: 'captured',
    projectId: 'proj-orbit-mvp',
    milestoneId: null,
    dueDate: null,
    focusRank: null,
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-04-09T11:00:00Z',
    updatedAt: '2026-04-09T11:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-14',
    title: '调研 AI 意图解析方案',
    body: '研究 NLP 方案，用于快速捕获时的意图理解。',
    status: 'scheduled',
    projectId: 'proj-orbit-mvp',
    milestoneId: 'ms-task-engine',
    dueDate: '2026-04-14',
    focusRank: 5,
    subtasks: [],
    supportLinks: [
      { id: 'sl-6', label: 'OpenAI Function Calling 文档', url: 'https://platform.openai.com/docs/guides/function-calling', kind: 'research' },
    ],
    createdAt: '2026-04-08T16:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
    completedAt: null,
  },
  {
    id: 'task-15',
    title: '记录本周学习心得',
    status: 'done',
    projectId: null,
    milestoneId: null,
    dueDate: '2026-04-09',
    focusRank: null,
    subtasks: [],
    supportLinks: [],
    createdAt: '2026-04-07T09:00:00Z',
    updatedAt: '2026-04-09T10:00:00Z',
    completedAt: '2026-04-09T10:00:00Z',
  },
];

// ─── Mock Task Events ────────────────────────────────────────────────
export const MOCK_TASK_EVENTS: TaskEvent[] = [
  { id: 'evt-1', taskId: 'task-3', type: 'status_change', from: 'ready', to: 'focused', timestamp: '2026-04-09T09:00:00Z' },
  { id: 'evt-2', taskId: 'task-3', type: 'status_change', from: 'scheduled', to: 'ready', timestamp: '2026-04-08T14:00:00Z' },
  { id: 'evt-3', taskId: 'task-3', type: 'status_change', from: 'captured', to: 'scheduled', timestamp: '2026-04-06T10:00:00Z' },
  { id: 'evt-4', taskId: 'task-1', type: 'status_change', from: 'focused', to: 'done', timestamp: '2026-04-03T16:00:00Z' },
  { id: 'evt-5', taskId: 'task-12', type: 'status_change', from: 'ready', to: 'blocked', note: '需要先确定运动计划', timestamp: '2026-04-01T08:00:00Z' },
  { id: 'evt-6', taskId: 'task-10', type: 'assignment', note: '设为本周重点任务', timestamp: '2026-04-07T09:00:00Z' },
  { id: 'evt-7', taskId: 'task-15', type: 'status_change', from: 'focused', to: 'done', timestamp: '2026-04-09T10:00:00Z' },
];

// ─── Today Plan ──────────────────────────────────────────────────────
export const MOCK_TODAY_PLAN: TodayPlan = {
  primary: {
    taskId: 'task-3',
    reasoning:
      '这是当前 Orbit MVP 里程碑的关键任务，已在专注中且进度过半。继续推进看板视图可以在今天完成这个里程碑的核心交付。上下文已经加载，切换成本低。',
    urgency: 0.9,
    importance: 0.95,
    contextFit: 0.85,
  },
  alternatives: [
    {
      taskId: 'task-10',
      reasoning:
        '阅读任务适合作为调剂。已完成前两部分，写总结笔记可以在一个番茄钟内完成。',
      urgency: 0.5,
      importance: 0.7,
      contextFit: 0.6,
    },
    {
      taskId: 'task-4',
      reasoning:
        '状态流转引擎是任务列表的前置依赖，实现它能解锁更多功能。但当前已在专注 task-3，建议完成后再开始。',
      urgency: 0.7,
      importance: 0.85,
      contextFit: 0.5,
    },
  ],
  scheduledBlocks: [
    { id: 'sb-1', taskId: 'task-3', startTime: '09:00', endTime: '11:30' },
    { id: 'sb-2', taskId: 'task-10', startTime: '14:00', endTime: '15:00' },
    { id: 'sb-3', taskId: 'task-4', startTime: '15:30', endTime: '17:00' },
    { id: 'sb-4', taskId: 'task-14', startTime: '17:00', endTime: '18:00' },
  ],
  carryForward: ['task-7', 'task-8'],
};

// ─── Helpers ─────────────────────────────────────────────────────────
export function getTask(id: string): Task | undefined {
  return MOCK_TASKS.find((t) => t.id === id);
}

export function getProject(id: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === id);
}

export function getMilestone(id: string): Milestone | undefined {
  return MOCK_MILESTONES.find((m) => m.id === id);
}

export function getTasksForProject(projectId: string): Task[] {
  return MOCK_TASKS.filter((t) => t.projectId === projectId);
}

export function getTasksForMilestone(milestoneId: string): Task[] {
  return MOCK_TASKS.filter((t) => t.milestoneId === milestoneId);
}

export function getMilestonesForProject(projectId: string): Milestone[] {
  return MOCK_MILESTONES.filter((m) => m.projectId === projectId);
}

export function getEventsForTask(taskId: string): TaskEvent[] {
  return MOCK_TASK_EVENTS.filter((e) => e.taskId === taskId);
}
