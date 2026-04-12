export type VisionScope = 'life' | 'career' | 'theme';
export type VisionStatus = 'active' | 'archived';
export type ReminderMode = 'gentle' | 'persistent' | 'none';
export type PrivacyLevel = 'local-only' | 'cloud-summary' | 'full-sync';
export type VersionAuthor = 'user' | 'agent-draft';
export type DirectiveStatus = 'active' | 'completed' | 'paused';

export interface Vision {
  id: string;
  title: string;
  scope: VisionScope;
  status: VisionStatus;
  reminderMode: ReminderMode;
  privacyLevel: PrivacyLevel;
  lastReaffirmedAt: Date;
  createdAt: Date;
}

export interface VisionVersion {
  id: string;
  visionId: string;
  versionNo: number;
  body: string;
  authoredBy: VersionAuthor;
  changeNote?: string;
  createdAt: Date;
}

export interface Directive {
  id: string;
  visionId: string;
  title: string;
  body: string;
  status: DirectiveStatus;
  scope: VisionScope;
  createdAt: Date;
}

export const mockVisions: Vision[] = [
  {
    id: 'v1',
    title: '成为技术领域的深度贡献者',
    scope: 'career',
    status: 'active',
    reminderMode: 'gentle',
    privacyLevel: 'cloud-summary',
    lastReaffirmedAt: new Date('2024-01-15'),
    createdAt: new Date('2023-06-01'),
  },
  {
    id: 'v2',
    title: '建立健康、平衡的生活方式',
    scope: 'life',
    status: 'active',
    reminderMode: 'persistent',
    privacyLevel: 'local-only',
    lastReaffirmedAt: new Date('2024-01-20'),
    createdAt: new Date('2023-08-10'),
  },
  {
    id: 'v3',
    title: '深入理解系统思维',
    scope: 'theme',
    status: 'archived',
    reminderMode: 'none',
    privacyLevel: 'full-sync',
    lastReaffirmedAt: new Date('2023-12-01'),
    createdAt: new Date('2023-03-15'),
  },
];

export const mockVersions: VisionVersion[] = [
  {
    id: 'vv1',
    visionId: 'v1',
    versionNo: 3,
    body: '我希望成为技术领域的深度贡献者，不仅仅是解决问题，更要理解问题的本质。通过开源项目和技术写作，分享知识，帮助他人成长。在未来五年内，我要在分布式系统领域建立专业声誉。',
    authoredBy: 'user',
    changeNote: '更新了时间目标和具体领域',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'vv2',
    visionId: 'v1',
    versionNo: 2,
    body: '我希望成为技术领域的深度贡献者，不仅仅是解决问题，更要理解问题的本质。通过开源项目和技术写作，分享知识，帮助他人成长。',
    authoredBy: 'agent-draft',
    changeNote: 'Agent 整理润色',
    createdAt: new Date('2023-10-20'),
  },
  {
    id: 'vv3',
    visionId: 'v1',
    versionNo: 1,
    body: '成为技术专家，做开源贡献，写技术文章。',
    authoredBy: 'user',
    createdAt: new Date('2023-06-01'),
  },
  {
    id: 'vv4',
    visionId: 'v2',
    versionNo: 1,
    body: '建立健康、平衡的生活方式。每天运动至少30分钟，保持充足睡眠，培养深度阅读的习惯。在工作和生活之间找到平衡点，留出时间陪伴家人和朋友。',
    authoredBy: 'user',
    createdAt: new Date('2023-08-10'),
  },
];

export const mockDirectives: Directive[] = [
  {
    id: 'd1',
    visionId: 'v1',
    title: '每周阅读一篇分布式系统论文',
    body: '深入理解分布式系统的核心概念，从经典论文开始，逐步建立知识体系。',
    status: 'active',
    scope: 'career',
    createdAt: new Date('2024-01-10'),
  },
  {
    id: 'd2',
    visionId: 'v1',
    title: '维护一个开源项目',
    body: '选择一个自己感兴趣的方向，创建并持续维护一个开源项目，吸引贡献者。',
    status: 'active',
    scope: 'career',
    createdAt: new Date('2024-01-05'),
  },
  {
    id: 'd3',
    visionId: 'v2',
    title: '建立晨间运动习惯',
    body: '每天早上6:30起床，进行30分钟运动（跑步或瑜伽）。',
    status: 'completed',
    scope: 'life',
    createdAt: new Date('2023-09-01'),
  },
];
