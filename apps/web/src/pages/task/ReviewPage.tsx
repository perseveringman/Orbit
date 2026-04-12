import { useState, type ReactElement } from 'react';
import { Card, Chip, Button, Tabs, Separator } from '@heroui/react';
import {
  Check,
  ArrowRight,
  BarChart3,
  CalendarDays,
  FolderOpen,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import {
  MOCK_TASKS,
  MOCK_PROJECTS,
  STATUS_LABELS,
  STATUS_COLORS,
  getTask,
  getProject,
  getTasksForProject,
  getMilestonesForProject,
  type Task,
  type Project,
} from './mock-data';

// ─── Daily Review ────────────────────────────────────────────────────

function DailyReview(): ReactElement {
  const [decision, setDecision] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationMsg, setValidationMsg] = useState('');

  const completedToday = MOCK_TASKS.filter(
    (t) => t.completedAt && t.completedAt.startsWith('2026-04-09'),
  );
  const carryForward = MOCK_TASKS.filter(
    (t) => t.status !== 'done' && t.status !== 'dropped' && t.dueDate && t.dueDate <= '2026-04-09',
  );

  const handleSubmit = () => {
    if (!decision.trim()) {
      setValidationMsg('请至少记录一条决策或反思');
      return;
    }
    setValidationMsg('');
    setSubmitted(true);
  };

  return (
    <div className="space-y-6">
      {/* Completed */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Check size={18} className="text-success" /> 今日完成
          <Chip variant="soft" color="success" size="sm">
            {completedToday.length}
          </Chip>
        </h3>
        {completedToday.length === 0 ? (
          <p className="text-sm text-muted">今天还没有完成的任务</p>
        ) : (
          <div className="space-y-2">
            {completedToday.map((t) => (
              <Card key={t.id}>
                <Card.Content>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-success" />
                    <span className="text-sm text-foreground">{t.title}</span>
                    {t.projectId && (
                      <Chip variant="soft" size="sm" className="ml-auto">
                        {getProject(t.projectId)?.title}
                      </Chip>
                    )}
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Carry forward */}
      {carryForward.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <ArrowRight size={18} className="text-warning" /> 需跟进
            <Chip variant="soft" color="warning" size="sm">
              {carryForward.length}
            </Chip>
          </h3>
          <div className="space-y-2">
            {carryForward.map((t) => (
              <Card key={t.id}>
                <Card.Content>
                  <div className="flex items-center gap-2">
                    <ArrowRight size={14} className="text-warning" />
                    <span className="text-sm text-foreground">{t.title}</span>
                    <Chip
                      variant="soft"
                      color={STATUS_COLORS[t.status]}
                      size="sm"
                      className="ml-auto"
                    >
                      {STATUS_LABELS[t.status]}
                    </Chip>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Decision prompt */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageSquare size={18} /> 今日决策与反思
        </h3>
        {submitted ? (
          <Card className="border-l-4 border-success">
            <Card.Content>
              <p className="text-sm text-foreground">{decision}</p>
              <p className="text-xs text-success mt-2">✓ 已提交</p>
            </Card.Content>
          </Card>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              rows={4}
              placeholder="今天做了什么决策？有什么发现或反思？"
              value={decision}
              onChange={(e) => {
                setDecision(e.target.value);
                if (validationMsg) setValidationMsg('');
              }}
            />
            {validationMsg && (
              <p className="text-xs text-danger flex items-center gap-1">
                <AlertTriangle size={12} /> {validationMsg}
              </p>
            )}
            <Button variant="primary" size="sm" onPress={handleSubmit}>
              提交
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Weekly Review ───────────────────────────────────────────────────

function WeeklyReview(): ReactElement {
  const totalTasks = MOCK_TASKS.length;
  const doneTasks = MOCK_TASKS.filter((t) => t.status === 'done').length;
  const focusedTasks = MOCK_TASKS.filter((t) => t.status === 'focused').length;
  const blockedTasks = MOCK_TASKS.filter((t) => t.status === 'blocked').length;

  return (
    <div className="space-y-6">
      {/* Weekly stats */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 size={18} /> 本周统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '总任务', value: totalTasks, color: 'default' as const },
            { label: '已完成', value: doneTasks, color: 'success' as const },
            { label: '专注中', value: focusedTasks, color: 'accent' as const },
            { label: '受阻', value: blockedTasks, color: 'warning' as const },
          ].map((stat) => (
            <Card key={stat.label}>
              <Card.Content>
                <p className="text-xs text-muted">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
                <Chip variant="soft" color={stat.color} size="sm">
                  {stat.label}
                </Chip>
              </Card.Content>
            </Card>
          ))}
        </div>
      </div>

      {/* Project progress deltas */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp size={18} /> 项目进度
        </h3>
        <div className="space-y-3">
          {MOCK_PROJECTS.filter((p) => p.status === 'active').map((p) => {
            const tasks = getTasksForProject(p.id);
            const done = tasks.filter((t) => t.status === 'done').length;
            const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
            return (
              <Card key={p.id}>
                <Card.Content>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {p.title}
                    </span>
                    <span className="text-xs text-muted">{pct}%</span>
                  </div>
                  <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {done}/{tasks.length} 任务完成
                  </p>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Insights placeholder */}
      <Card className="border-l-4 border-accent">
        <Card.Content>
          <p className="text-sm text-muted">
            📓 本周日记洞察：持续推进 Orbit MVP 开发，任务引擎核心模块进展顺利。建议下周重点关注回顾系统和意图解析功能。
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}

// ─── Project Retrospective ───────────────────────────────────────────

function ProjectRetrospective(): ReactElement {
  const [selectedProject, setSelectedProject] = useState<string | null>(
    MOCK_PROJECTS[0].id,
  );
  const [decision, setDecision] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationMsg, setValidationMsg] = useState('');

  const project = selectedProject ? getProject(selectedProject) : null;
  const milestones = project ? getMilestonesForProject(project.id) : [];
  const tasks = project ? getTasksForProject(project.id) : [];
  const blockedItems = tasks.filter((t) => t.status === 'blocked');

  const handleSubmit = () => {
    if (!decision.trim()) {
      setValidationMsg('请至少记录一条决策');
      return;
    }
    setValidationMsg('');
    setSubmitted(true);
  };

  return (
    <div className="space-y-6">
      {/* Project selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {MOCK_PROJECTS.map((p) => (
          <Button
            key={p.id}
            variant={selectedProject === p.id ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => {
              setSelectedProject(p.id);
              setSubmitted(false);
              setDecision('');
            }}
          >
            <FolderOpen size={14} /> {p.title}
          </Button>
        ))}
      </div>

      {project && (
        <>
          {/* Milestone status */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-3">
              里程碑状态
            </h3>
            <div className="space-y-2">
              {milestones.map((ms) => {
                const msTasks = MOCK_TASKS.filter((t) => t.milestoneId === ms.id);
                const done = msTasks.filter((t) => t.status === 'done').length;
                return (
                  <Card key={ms.id}>
                    <Card.Content>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {ms.title}
                        </span>
                        <Chip
                          variant="soft"
                          color={
                            ms.status === 'done'
                              ? 'success'
                              : ms.status === 'active'
                                ? 'accent'
                                : 'default'
                          }
                          size="sm"
                        >
                          {ms.status === 'done'
                            ? '已完成'
                            : ms.status === 'active'
                              ? '进行中'
                              : ms.status === 'dropped'
                                ? '已放弃'
                                : '计划中'}
                        </Chip>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {done}/{msTasks.length} 任务完成
                      </p>
                    </Card.Content>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Blocked items */}
          {blockedItems.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" /> 受阻事项
              </h3>
              <div className="space-y-2">
                {blockedItems.map((t) => (
                  <Card key={t.id}>
                    <Card.Content>
                      <div className="flex items-center gap-2">
                        <Chip variant="soft" color="warning" size="sm">
                          受阻
                        </Chip>
                        <span className="text-sm text-foreground">
                          {t.title}
                        </span>
                      </div>
                    </Card.Content>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Decision prompts */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <MessageSquare size={18} /> 复盘决策
            </h3>
            {submitted ? (
              <Card className="border-l-4 border-success">
                <Card.Content>
                  <p className="text-sm text-foreground">{decision}</p>
                  <p className="text-xs text-success mt-2">✓ 已提交</p>
                </Card.Content>
              </Card>
            ) : (
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={4}
                  placeholder="这个项目目前的方向对吗？需要调整什么？"
                  value={decision}
                  onChange={(e) => {
                    setDecision(e.target.value);
                    if (validationMsg) setValidationMsg('');
                  }}
                />
                {validationMsg && (
                  <p className="text-xs text-danger flex items-center gap-1">
                    <AlertTriangle size={12} /> {validationMsg}
                  </p>
                )}
                <Button variant="primary" size="sm" onPress={handleSubmit}>
                  提交
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ReviewPage ──────────────────────────────────────────────────────

export function ReviewPage(): ReactElement {
  return (
    <div className="max-w-3xl mx-auto p-6 overflow-y-auto h-full">
      <h2 className="text-2xl font-bold text-foreground mb-6">回顾</h2>

      <Tabs>
        <Tabs.List aria-label="回顾标签">
          <Tabs.Tab id="daily">
            <CalendarDays size={14} className="inline mr-1" />
            日回顾
          </Tabs.Tab>
          <Tabs.Tab id="weekly">
            <BarChart3 size={14} className="inline mr-1" />
            周回顾
          </Tabs.Tab>
          <Tabs.Tab id="project">
            <FolderOpen size={14} className="inline mr-1" />
            项目复盘
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="daily" className="pt-6">
          <DailyReview />
        </Tabs.Panel>

        <Tabs.Panel id="weekly" className="pt-6">
          <WeeklyReview />
        </Tabs.Panel>

        <Tabs.Panel id="project" className="pt-6">
          <ProjectRetrospective />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
